/**
 * POST /api/ai/duplicates — AI duplicate detection
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseRoute } from "@/lib/supabase/server";
import { requireRole } from "@/lib/session";
import { geminiTextJson, isAiEnabled } from "@/lib/ai/geminiClient";
import { logAiRun } from "@/lib/ai/ledger";
import { checkUserRateLimit } from "@/lib/ai/rate-limit";
import { haversineDistance } from "@/lib/geo";
import { DUPLICATES_SYSTEM, buildDuplicatesUser, DUPLICATES_PROMPT_VERSION } from "@/lib/ai/prompts";
import { duplicateResultSchema } from "@/lib/ai/schemas";
import { badRequest, notFound, serverError } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole("ops");

    const rl = checkUserRateLimit(user.id);
    if (!rl.allowed) {
      return NextResponse.json({ title: "Rate Limited", status: 429 }, { status: 429 });
    }

    const { reportId } = await request.json();
    if (!reportId) return badRequest("reportId is required");

    const supabase = await getSupabaseRoute();
    const { data: report } = await supabase.from("reports").select("*").eq("id", reportId).single();
    if (!report) return notFound("Report not found");

    if (!isAiEnabled()) return serverError("AI is disabled");

    const sourceCreatedAt = new Date(report.created_at);
    const cutoff = new Date(sourceCreatedAt.getTime() - 168 * 60 * 60 * 1000).toISOString();

    const { data: recentReports } = await supabase
      .from("reports")
      .select("id, type, notes, lat, lng, created_at")
      .gte("created_at", cutoff)
      .neq("id", reportId)
      .neq("status", "REJECTED")
      .limit(100);

    const candidates = (recentReports || [])
      .filter((c) => haversineDistance(report.lat, report.lng, c.lat, c.lng) <= 500)
      .map((c) => {
        const created = new Date(c.created_at);
        return {
          id: c.id,
          type: c.type,
          notes: c.notes || "",
          distanceMeters: Math.round(haversineDistance(report.lat, report.lng, c.lat, c.lng)),
          ageHoursApart: Math.round(Math.abs(sourceCreatedAt.getTime() - created.getTime()) / 36000) / 100,
        };
      })
      .slice(0, 15);

    if (candidates.length === 0) {
      return NextResponse.json({ rankedCandidates: [] });
    }

    const startTime = Date.now();
    const { data, model } = await geminiTextJson({
      systemInstruction: DUPLICATES_SYSTEM,
      userPrompt: buildDuplicatesUser({
        target: { id: reportId, type: report.type, notes: report.notes || "", lat: report.lat, lng: report.lng, createdAt: sourceCreatedAt.toISOString() },
        candidates,
      }),
      temperature: 0.2,
      maxOutputTokens: 1024,
      validate: (raw) => duplicateResultSchema.safeParse(raw),
    });

    const validIds = new Set(candidates.map((c) => c.id));
    data.rankedCandidates = data.rankedCandidates.filter((c) => validIds.has(c.reportId));

    const now = new Date().toISOString();
    const existingAi = report.ai || {};
    await supabase.from("reports").update({
      ai: { ...existingAi, duplicates: { ...data, model, promptVersion: DUPLICATES_PROMPT_VERSION, createdAt: now } },
    }).eq("id", reportId);

    logAiRun({
      action: "duplicates_manual", reportId, userId: user.id,
      model, promptVersion: DUPLICATES_PROMPT_VERSION,
      durationMs: Date.now() - startTime, status: "success", provider: "gemini",
    }).catch(() => {});

    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof Response) throw err;
    console.error("POST /api/ai/duplicates:", err);
    return serverError();
  }
}
