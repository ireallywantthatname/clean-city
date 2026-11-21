import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { garbageLabelValidator } from "./schema";

const cachedImageValidator = v.object({
  image_hash: v.string(),
  label: v.union(garbageLabelValidator, v.null()),
  confidence: v.union(v.number(), v.null()),
  reason: v.union(v.string(), v.null()),
  garbage_types: v.union(v.array(v.string()), v.null()),
  needs_human_review: v.union(v.boolean(), v.null()),
  model: v.union(v.string(), v.null()),
  prompt_version: v.union(v.string(), v.null()),
  provider: v.union(v.string(), v.null()),
  created_at: v.string(),
});

export const getCache = query({
  args: {
    imageHash: v.string(),
  },
  returns: v.union(cachedImageValidator, v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("ai_image_cache")
      .withIndex("by_imageHash", (q) => q.eq("imageHash", args.imageHash))
      .unique();
    if (!row) return null;

    return {
      image_hash: row.imageHash,
      label: row.label ?? null,
      confidence: row.confidence ?? null,
      reason: row.reason ?? null,
      garbage_types: row.garbageTypes ?? null,
      needs_human_review: row.needsHumanReview ?? null,
      model: row.model ?? null,
      prompt_version: row.promptVersion ?? null,
      provider: row.provider ?? null,
      created_at: row.createdAt,
    };
  },
});

export const setCache = mutation({
  args: {
    imageHash: v.string(),
    label: v.optional(garbageLabelValidator),
    confidence: v.optional(v.number()),
    reason: v.optional(v.string()),
    garbageTypes: v.optional(v.array(v.string())),
    needsHumanReview: v.optional(v.boolean()),
    model: v.optional(v.string()),
    promptVersion: v.optional(v.string()),
    provider: v.string(),
    createdAt: v.string(),
  },
  returns: v.id("ai_image_cache"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("ai_image_cache")
      .withIndex("by_imageHash", (q) => q.eq("imageHash", args.imageHash))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        label: args.label,
        confidence: args.confidence,
        reason: args.reason,
        garbageTypes: args.garbageTypes,
        needsHumanReview: args.needsHumanReview,
        model: args.model,
        promptVersion: args.promptVersion,
        provider: args.provider,
        createdAt: args.createdAt,
      });
      return existing._id;
    }

    return await ctx.db.insert("ai_image_cache", {
      imageHash: args.imageHash,
      label: args.label,
      confidence: args.confidence,
      reason: args.reason,
      garbageTypes: args.garbageTypes,
      needsHumanReview: args.needsHumanReview,
      model: args.model,
      promptVersion: args.promptVersion,
      provider: args.provider,
      createdAt: args.createdAt,
    });
  },
});

export const logRun = mutation({
  args: {
    action: v.string(),
    reportId: v.string(),
    userId: v.string(),
    model: v.string(),
    promptVersion: v.string(),
    durationMs: v.number(),
    status: v.union(
      v.literal("success"),
      v.literal("error"),
      v.literal("timeout"),
      v.literal("cached"),
    ),
    error: v.optional(v.string()),
    provider: v.string(),
    createdAt: v.string(),
  },
  returns: v.union(v.id("ai_runs"), v.null()),
  handler: async (ctx, args) => {
    const normalizedReportId = ctx.db.normalizeId("reports", args.reportId);
    if (!normalizedReportId) return null;

    return await ctx.db.insert("ai_runs", {
      action: args.action,
      reportId: normalizedReportId,
      userId: args.userId,
      model: args.model,
      promptVersion: args.promptVersion,
      durationMs: args.durationMs,
      status: args.status,
      error: args.error,
      provider: args.provider,
      createdAt: args.createdAt,
    });
  },
});

export const saveWeeklyInsight = mutation({
  args: {
    periodStart: v.string(),
    periodEnd: v.string(),
    summary: v.string(),
    topIssues: v.array(
      v.object({
        title: v.string(),
        count: v.number(),
        trend: v.optional(v.string()),
      }),
    ),
    riskAreas: v.array(v.string()),
    recommendations: v.array(v.string()),
    totalReports: v.number(),
    model: v.string(),
    generatedBy: v.optional(v.string()),
    createdAt: v.string(),
  },
  returns: v.id("ai_weekly_insights"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("ai_weekly_insights", args);
  },
});
