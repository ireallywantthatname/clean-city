/**
 * AI run ledger — server-side only.
 * Every AI invocation recorded in `ai_runs` for traceability.
 */
import { getSupabaseRoute } from "@/lib/supabase/server";

export interface AiRunEntry {
  action: string;
  reportId: string;
  userId: string;
  model: string;
  promptVersion: string;
  durationMs: number;
  status: "success" | "error" | "timeout" | "cached";
  error?: string;
  provider: "gemini";
}

export async function logAiRun(entry: AiRunEntry): Promise<string | null> {
  try {
    const supabase = await getSupabaseRoute();
    const { data, error } = await supabase.from("ai_runs").insert({
      action: entry.action,
      report_id: entry.reportId,
      user_id: entry.userId,
      model: entry.model,
      prompt_version: entry.promptVersion,
      duration_ms: entry.durationMs,
      status: entry.status,
      error: entry.error || null,
      provider: entry.provider,
      created_at: new Date().toISOString(),
    }).select("id").single();

    if (error) throw error;
    return data.id;
  } catch (e) {
    console.error("[AI Ledger] Failed to write ai_runs:", e);
    return null;
  }
}
