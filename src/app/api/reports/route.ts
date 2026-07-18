/**
 * POST /api/reports — public report submission
 * GET  /api/reports — list reports (paginated, filterable)
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseRoute } from "@/lib/supabase/server";
import { uploadFile } from "@/lib/supabase/storage";
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

    const parsed = createReportSchema.safeParse({ type, lat: latRaw, lng: lngRaw, notes });
    if (!parsed.success) return badRequest(parsed.error.message);

    const file = formData.get("photo") as File | null;
    if (!file) return badRequest("Photo is required");

    const supabase = await getSupabaseRoute();

    // Create report first to get an ID
    const { data: report, error: insertErr } = await supabase
      .from("reports")
      .insert({
        type: parsed.data.type,
        lat: parsed.data.lat,
        lng: parsed.data.lng,
        notes: parsed.data.notes,
        geohash: encodeGeohash(parsed.data.lat, parsed.data.lng, 7),
        status: "NEW",
      })
      .select("id")
      .single();

    if (insertErr || !report) return serverError("Failed to create report");

    const reportId = report.id;
    const ext = file.name.split(".").pop() || "jpg";
    const storagePath = `reports/${reportId}/before.${ext}`;

    // Upload photo
    const buffer = Buffer.from(await file.arrayBuffer());
    const photoUrl = await uploadFile(storagePath, buffer, file.type);

    // Update with photo URL
    await supabase.from("reports").update({
      before_photo_url: photoUrl,
      before_photo_path: storagePath,
    }).eq("id", reportId);

    // Log activity
    await logActivity(reportId, "CREATED", `Report submitted: ${parsed.data.type}`, "system", "System");

    // Fire-and-forget AI pipeline
    const aiSecret = process.env.INTERNAL_AI_SECRET || "";
    fetch(`${request.nextUrl.origin}/api/ai/process-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-ai-secret": aiSecret },
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
    // Staff listing is not anonymously public
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const supabase = await getSupabaseRoute();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const priority = searchParams.get("priority");
    const assignedTo = searchParams.get("assignedTo");
    const cursor = searchParams.get("cursor");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    let query = supabase
      .from("reports")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(limit + 1);

    // Status filter: "open" maps to active statuses
    if (status && status !== "all") {
      if (status === "open") {
        query = query.in("status", ["NEW", "TRIAGED", "ASSIGNED", "IN_PROGRESS", "BLOCKED"]);
      } else {
        query = query.eq("status", status.toUpperCase());
      }
    }
    if (type && type !== "all") {
      query = query.eq("type", type.toUpperCase());
    }
    if (priority && priority !== "all") {
      query = query.eq("priority", priority.toUpperCase());
    }
    if (assignedTo) {
      query = query.eq("assigned_to_user_id", assignedTo);
    }
    if (cursor) {
      query = query.lt("created_at", cursor);
    }

    const { data: reports, count, error } = await query;
    if (error) return serverError(error.message);

    const hasMore = (reports || []).length > limit;
    const items = hasMore ? (reports || []).slice(0, limit) : (reports || []);

    return NextResponse.json({
      reports: items,
      nextCursor: hasMore && items.length > 0 ? items[items.length - 1].created_at : null,
      total: count || 0,
    });
  } catch (err) {
    console.error("GET /api/reports:", err);
    return serverError();
  }
}
