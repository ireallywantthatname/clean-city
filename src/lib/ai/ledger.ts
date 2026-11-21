import { api } from "../../../convex/_generated/api";
import { getConvexClient } from "@/lib/convex/server";
import { getAiProvider } from "@/lib/ai/openaiClient";

export interface AiRunEntry {
  action: string;
  reportId: string;
  userId: string;
  model: string;
  promptVersion: string;
  durationMs: number;
  status: "success" | "error" | "timeout" | "cached";
  error?: string;
  provider?: string;
}

export async function logAiRun(entry: AiRunEntry): Promise<string | null> {
  try {
    const convex = getConvexClient();
    const id = await convex.mutation(api.ai.logRun, {
      action: entry.action,
      reportId: entry.reportId,
      userId: entry.userId,
      model: entry.model,
      promptVersion: entry.promptVersion,
      durationMs: entry.durationMs,
      status: entry.status,
      error: entry.error,
      provider: entry.provider || getAiProvider(),
      createdAt: new Date().toISOString(),
    });
    return id;
  } catch (e) {
    console.error("[AI Ledger] Failed to write ai_runs:", e);
    return null;
  }
}
