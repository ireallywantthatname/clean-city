/**
 * POST /api/ai/run-weekly-insights — generate weekly analytics insights
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseRoute } from "@/lib/supabase/server";
import { requireRole } from "@/lib/session";
import { aiText } from "@/lib/ai/openaiClient";
import { checkUserRateLimit } from "@/lib/ai/rate-limit";
import { serverError } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole("ops");

    const rl = checkUserRateLimit(user.id);
    if (!rl.allowed) return NextResponse.json({ title: "Rate Limited", status: 429 }, { status: 429 });

    const supabase = await getSupabaseRoute();

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: reports, error: reportsErr } = await supabase
      .from("reports")
      .select("type, status, priority, notes, created_at")
      .gte("created_at", since);
    if (reportsErr) return serverError(reportsErr.message);

    const { count: totalCount } = await supabase
      .from("reports")
      .select("*", { count: "exact", head: true })
      .gte("created_at", since);

    const typeCounts: Record<string, number> = {};
    (reports || []).forEach((r) => {
      typeCounts[r.type] = (typeCounts[r.type] || 0) + 1;
    });

    const openReports = (reports || []).filter((r) =>
      ["NEW", "TRIAGED", "ASSIGNED", "IN_PROGRESS", "BLOCKED"].includes(r.status),
    );

    const summaryText = `
Weekly CleanCity Report Summary:
- Total reports: ${totalCount || 0}
- Open reports: ${openReports.length}
- By type: ${Object.entries(typeCounts).map(([k, v]) => `${k}: ${v}`).join(", ")}
- Top notes themes: ${(reports || []).slice(0, 20).map((r) => r.notes).filter(Boolean).join(" | ")}
`.trim();

    const result = await aiText({
      systemInstruction: `You are a municipal data analyst for CleanCity. Analyze the weekly report data and provide:
1. A 2-3 sentence executive summary
2. Top 3 issues as JSON array [{title, count, trend}]
3. 3-5 actionable recommendations as string array
4. 2-3 risk areas as string array

Output valid JSON: { "summary": string, "top_issues": [{title, count, trend}], "recommendations": string[], "risk_areas": string[] }`,
      userPrompt: summaryText,
      temperature: 0.3,
      maxOutputTokens: 1024,
    });

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(result.content);
    } catch {
      parsed = {
        summary: result.content,
        top_issues: [],
        recommendations: [],
        risk_areas: [],
      };
    }

    const now = new Date();
    await supabase.from("ai_weekly_insights").insert({
      summary: (parsed.summary as string) || result.content,
      top_issues: (parsed.top_issues as unknown) || [],
      recommendations: (parsed.recommendations as string[]) || [],
      risk_areas: (parsed.risk_areas as string[]) || [],
      model: result.model,
      generated_by: user.id,
      period_start: since,
      period_end: now.toISOString(),
      total_reports: totalCount || 0,
      created_at: now.toISOString(),
    });

    return NextResponse.json({ insight: parsed, model: result.model });
  } catch (err) {
    if (err instanceof Response) throw err;
    console.error("POST /api/ai/run-weekly-insights:", err);
    return serverError();
  }
}
