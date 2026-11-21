import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../convex/_generated/api";
import { getConvexClient } from "@/lib/convex/server";
import { uploadFileToConvex } from "@/lib/convex/storage";
import { getSessionUser } from "@/lib/session";
import { createReportSchema } from "@/lib/schemas";
import { encodeGeohash } from "@/lib/geo";
import { logActivity } from "@/lib/activities";
import { badRequest, serverError, unauthorized } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const type = formData.get("type") as string;
    const latRaw = formData.get("lat") as string;
    const lngRaw = formData.get("lng") as string;
    const notes = (formData.get("notes") as string) || "";

    const parsed = createReportSchema.safeParse({
      type,
      lat: latRaw,
      lng: lngRaw,
      notes,
    });
    if (!parsed.success) return badRequest(parsed.error.message);

    const file = formData.get("photo") as File | null;
    if (!file) return badRequest("Photo is required");

    const convex = getConvexClient();
    const buffer = Buffer.from(await file.arrayBuffer());
    const { storageId } = await uploadFileToConvex(buffer, file.type);

    const reportId = await convex.mutation(api.reports.create, {
      type: parsed.data.type,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      notes: parsed.data.notes,
      geohash: encodeGeohash(parsed.data.lat, parsed.data.lng, 7),
      beforePhotoStorageId: storageId,
    });

    const ext = file.name.split(".").pop() || "jpg";
    const storagePath = `reports/${reportId}/before.${ext}`;
    await convex.mutation(api.reports.update, {
      id: reportId,
      beforePhotoPath: storagePath,
    });

    await logActivity(
      reportId,
      "CREATED",
      `Report submitted: ${parsed.data.type}`,
      "system",
      "System",
    );

    const aiSecret = process.env.INTERNAL_AI_SECRET || "";
    fetch(`${request.nextUrl.origin}/api/ai/process-report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-ai-secret": aiSecret,
      },
      body: JSON.stringify({ reportId }),
    }).catch(() => {});

    return NextResponse.json({ id: reportId }, { status: 201 });
  } catch (err) {
    console.error("POST /api/reports:", err);
    return serverError();
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const convex = getConvexClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? undefined;
    const type = searchParams.get("type") ?? undefined;
    const priority = searchParams.get("priority") ?? undefined;
    const assignedTo = searchParams.get("assignedTo") ?? undefined;
    const cursor = searchParams.get("cursor") ?? undefined;
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "50", 10),
      100,
    );

    const data = await convex.query(api.reports.list, {
      status,
      type,
      priority,
      assignedTo,
      cursor,
      limit,
    });

    return NextResponse.json(data);
  } catch (err) {
    console.error("GET /api/reports:", err);
    return serverError();
  }
}
