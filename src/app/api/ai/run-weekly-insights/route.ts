import { NextRequest, NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import { getConvexClient } from "@/lib/convex/server";
import { requireRole } from "@/lib/session";
import { aiText } from "@/lib/ai/openaiClient";
import { checkUserRateLimit } from "@/lib/ai/rate-limit";
import { serverError } from "@/lib/errors";

export async function POST(_request: NextRequest) {
  try {
    const user = await requireRole("ops");

    const rl = checkUserRateLimit(user.id);
    if (!rl.allowed) {
      return NextResponse.json(
        { title: "Rate Limited", status: 429 },
        { status: 429 },
      );
    }

    const convex = getConvexClient();
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const reports = await convex.query(api.reports.listRecentSince, {
      since,
      limit: 500,
    });

    const totalCount = reports.length;
    const typeCounts: Record<string, number> = {};
    for (const r of reports) {
      typeCounts[r.type] = (typeCounts[r.type] || 0) + 1;
    }

    const openReports = reports.filter((r) =>
      ["NEW", "TRIAGED", "ASSIGNED", "IN_PROGRESS", "BLOCKED"].includes(
        r.status,
      ),
    );

    const summaryText = `
Weekly CleanCity Report Summary:
- Total reports: ${totalCount}
- Open reports: ${openReports.length}
- By type: ${Object.entries(typeCounts)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ")}
- Top notes themes: ${reports
      .slice(0, 20)
      .map((r) => r.notes)
      .filter(Boolean)
      .join(" | ")}
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

    const rawTopIssues = Array.isArray(parsed.top_issues)
      ? parsed.top_issues
      : [];
    const topIssues = rawTopIssues.map((item) => {
      const obj = (item || {}) as Record<string, unknown>;
      return {
        title: typeof obj.title === "string" ? obj.title : "Issue",
        count: typeof obj.count === "number" ? obj.count : 0,
        trend: typeof obj.trend === "string" ? obj.trend : undefined,
      };
    });

    const now = new Date();
    await convex.mutation(api.ai.saveWeeklyInsight, {
      summary:
        typeof parsed.summary === "string" ? parsed.summary : result.content,
      topIssues,
      recommendations: Array.isArray(parsed.recommendations)
        ? (parsed.recommendations as string[])
        : [],
      riskAreas: Array.isArray(parsed.risk_areas)
        ? (parsed.risk_areas as string[])
        : [],
      model: result.model,
      generatedBy: user.id,
      periodStart: since,
      periodEnd: now.toISOString(),
      totalReports: totalCount,
      createdAt: now.toISOString(),
    });

    return NextResponse.json({ insight: parsed, model: result.model });
  } catch (err) {
    if (err instanceof Response) throw err;
    console.error("POST /api/ai/run-weekly-insights:", err);
    return serverError();
  }
}
