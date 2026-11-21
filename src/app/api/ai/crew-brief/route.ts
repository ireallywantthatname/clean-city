import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import { getConvexClient } from "@/lib/convex/server";
import { requireAnyRole } from "@/lib/session";
import { aiTextJson, getAiProvider } from "@/lib/ai/openaiClient";
import { logAiRun } from "@/lib/ai/ledger";
import { checkUserRateLimit } from "@/lib/ai/rate-limit";
import {
  CREW_BRIEF_SYSTEM,
  buildCrewBriefUser,
  CREW_BRIEF_PROMPT_VERSION,
} from "@/lib/ai/prompts";
import { crewBriefResultSchema } from "@/lib/ai/schemas";
import { badRequest, notFound, serverError } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAnyRole("ops", "crew");

    const rl = checkUserRateLimit(user.id);
    if (!rl.allowed) {
      return NextResponse.json(
        { title: "Rate Limited", status: 429 },
        { status: 429 },
      );
    }

    const { reportId } = await request.json();
    if (!reportId) return badRequest("reportId is required");

    const convex = getConvexClient();
    const report = await convex.query(api.reports.getById, { id: reportId });
    if (!report) return notFound("Report not found");

    const garbageTypes = report.ai?.garbageDetector?.garbageTypes;

    const startTime = Date.now();
    const { data, model } = await aiTextJson({
      systemInstruction: CREW_BRIEF_SYSTEM,
      userPrompt: buildCrewBriefUser({
        reportType: report.type,
        notes: report.notes || "",
        priority: report.priority || "MEDIUM",
        status: report.status,
        garbageTypes,
        hazards: undefined,
        estimatedVolume: undefined,
      }),
      temperature: 0.3,
      maxOutputTokens: 512,
      validate: (raw) => crewBriefResultSchema.safeParse(raw),
    });

    const now = new Date().toISOString();
    const existingAi = report.ai ?? { status: "COMPLETE" as const };
    await convex.mutation(api.reports.update, {
      id: reportId,
      ai: {
        ...existingAi,
        crewBrief: {
          ...data,
          model,
          promptVersion: CREW_BRIEF_PROMPT_VERSION,
          createdAt: now,
        },
      },
    });

    logAiRun({
      action: "crew_brief_manual",
      reportId,
      userId: user.id,
      model,
      promptVersion: CREW_BRIEF_PROMPT_VERSION,
      durationMs: Date.now() - startTime,
      status: "success",
      provider: getAiProvider(),
    }).catch(() => {});

    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof Response) throw err;
    console.error("POST /api/ai/crew-brief:", err);
    return serverError();
  }
}
