/**
 * POST /api/ai/crew-brief — generate crew briefing
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseRoute } from "@/lib/supabase/server";
import { requireAnyRole } from "@/lib/session";
import { geminiTextJson, isAiEnabled } from "@/lib/ai/geminiClient";
import { logAiRun } from "@/lib/ai/ledger";
import { checkUserRateLimit } from "@/lib/ai/rate-limit";
import { CREW_BRIEF_SYSTEM, buildCrewBriefUser, CREW_BRIEF_PROMPT_VERSION } from "@/lib/ai/prompts";
import { crewBriefResultSchema } from "@/lib/ai/schemas";
import { badRequest, notFound, serverError } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAnyRole("ops", "crew");

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

    const aiData = (report.ai as Record<string, unknown>) || {};
    const gd = aiData["garbageDetector"] as Record<string, unknown> | undefined;

    const startTime = Date.now();
    const { data, model } = await geminiTextJson({
      systemInstruction: CREW_BRIEF_SYSTEM,
      userPrompt: buildCrewBriefUser({
        reportType: report.type,
        notes: report.notes || "",
        priority: (report.priority as string) || "MEDIUM",
        status: report.status,
        garbageTypes: gd?.garbageTypes as string[] | undefined,
        hazards: undefined,
        estimatedVolume: undefined,
      }),
      temperature: 0.3,
      maxOutputTokens: 512,
      validate: (raw) => crewBriefResultSchema.safeParse(raw),
    });

    const now = new Date().toISOString();
    const existingAi = report.ai || {};
    await supabase.from("reports").update({
      ai: { ...existingAi, crewBrief: { ...data, model, promptVersion: CREW_BRIEF_PROMPT_VERSION, createdAt: now } },
    }).eq("id", reportId);

    logAiRun({
      action: "crew_brief_manual", reportId, userId: user.id,
      model, promptVersion: CREW_BRIEF_PROMPT_VERSION,
      durationMs: Date.now() - startTime, status: "success", provider: "gemini",
    }).catch(() => {});

    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof Response) throw err;
    console.error("POST /api/ai/crew-brief:", err);
    return serverError();
  }
}
