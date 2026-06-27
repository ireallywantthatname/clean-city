/**
 * POST /api/ai/triage — text-only AI triage (no image needed)
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseRoute } from "@/lib/supabase/server";
import { requireRole } from "@/lib/session";
import { geminiTextJson, isAiEnabled } from "@/lib/ai/geminiClient";
import { logAiRun } from "@/lib/ai/ledger";
import { checkUserRateLimit } from "@/lib/ai/rate-limit";
import { TRIAGE_SYSTEM, buildTriageUser, TRIAGE_PROMPT_VERSION } from "@/lib/ai/prompts";
import { aiTriageResultSchema } from "@/lib/ai/schemas";
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

    const startTime = Date.now();
    const { data, model } = await geminiTextJson({
      systemInstruction: TRIAGE_SYSTEM,
      userPrompt: buildTriageUser({
        reportType: report.type,
        notes: report.notes || "",
        lat: report.lat,
        lng: report.lng,
      }),
      temperature: 0.2,
      maxOutputTokens: 512,
      validate: (raw) => aiTriageResultSchema.safeParse(raw),
    });

    const now = new Date().toISOString();
    const existingAi = report.ai || {};

    await supabase.from("reports").update({
      ai: { ...existingAi, triage: { ...data, model, promptVersion: TRIAGE_PROMPT_VERSION, createdAt: now, createdByUserId: user.id } },
    }).eq("id", reportId);

    logAiRun({
      action: "triage", reportId, userId: user.id,
      model, promptVersion: TRIAGE_PROMPT_VERSION,
      durationMs: Date.now() - startTime, status: "success", provider: "gemini",
    }).catch(() => {});

    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof Response) throw err;
    console.error("POST /api/ai/triage:", err);
    return serverError();
  }
}
