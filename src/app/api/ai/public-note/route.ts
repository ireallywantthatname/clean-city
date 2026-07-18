/**
 * POST /api/ai/public-note — generate public resolution note
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseRoute } from "@/lib/supabase/server";
import { requireRole } from "@/lib/session";
import { aiTextJson, getAiProvider } from "@/lib/ai/openaiClient";
import { logAiRun } from "@/lib/ai/ledger";
import { checkUserRateLimit } from "@/lib/ai/rate-limit";
import { PUBLIC_NOTE_SYSTEM, buildPublicNoteUser, PUBLIC_NOTE_PROMPT_VERSION } from "@/lib/ai/prompts";
import { aiPublicNoteResultSchema } from "@/lib/ai/schemas";
import { badRequest, notFound, serverError } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole("ops");

    const rl = checkUserRateLimit(user.id);
    if (!rl.allowed) return NextResponse.json({ title: "Rate Limited", status: 429 }, { status: 429 });

    const { reportId } = await request.json();
    if (!reportId) return badRequest("reportId is required");

    const supabase = await getSupabaseRoute();
    const { data: report } = await supabase.from("reports").select("*").eq("id", reportId).single();
    if (!report) return notFound("Report not found");

    const startTime = Date.now();
    const { data, model } = await aiTextJson({
      systemInstruction: PUBLIC_NOTE_SYSTEM,
      userPrompt: buildPublicNoteUser({
        reportType: report.type,
        notes: report.notes || "",
        completionNotes: report.completion_notes || undefined,
        status: report.status,
      }),
      temperature: 0.3,
      maxOutputTokens: 512,
      validate: (raw) => aiPublicNoteResultSchema.safeParse(raw),
    });

    const now = new Date().toISOString();
    const existingAi = report.ai || {};
    await supabase.from("reports").update({
      ai: {
        ...existingAi,
        publicNote: {
          ...data,
          model,
          promptVersion: PUBLIC_NOTE_PROMPT_VERSION,
          createdAt: now,
          createdByUserId: user.id,
        },
      },
    }).eq("id", reportId);

    logAiRun({
      action: "public_note", reportId, userId: user.id,
      model, promptVersion: PUBLIC_NOTE_PROMPT_VERSION,
      durationMs: Date.now() - startTime, status: "success", provider: getAiProvider(),
    }).catch(() => {});

    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof Response) throw err;
    console.error("POST /api/ai/public-note:", err);
    return serverError();
  }
}
