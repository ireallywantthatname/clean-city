import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { activityTypeValidator } from "./schema";

export const activityItemValidator = v.object({
  id: v.string(),
  report_id: v.string(),
  reportId: v.string(),
  type: activityTypeValidator,
  message: v.string(),
  created_by: v.union(v.string(), v.null()),
  createdBy: v.string(),
  created_by_name: v.string(),
  createdByName: v.string(),
  created_at: v.string(),
  createdAt: v.string(),
});

export const log = mutation({
  args: {
    reportId: v.string(),
    type: activityTypeValidator,
    message: v.string(),
    createdBy: v.string(),
    createdByName: v.string(),
    createdAt: v.optional(v.string()),
  },
  returns: v.union(v.id("activities"), v.null()),
  handler: async (ctx, args) => {
    const normalizedId = ctx.db.normalizeId("reports", args.reportId);
    if (!normalizedId) return null;

    return await ctx.db.insert("activities", {
      reportId: normalizedId,
      type: args.type,
      message: args.message,
      createdBy: args.createdBy,
      createdByName: args.createdByName,
      createdAt: args.createdAt ?? new Date().toISOString(),
    });
  },
});

export const listByReport = query({
  args: {
    reportId: v.string(),
  },
  returns: v.array(activityItemValidator),
  handler: async (ctx, args) => {
    const normalizedId = ctx.db.normalizeId("reports", args.reportId);
    if (!normalizedId) return [];

    const rows = await ctx.db
      .query("activities")
      .withIndex("by_reportId", (q) => q.eq("reportId", normalizedId))
      .order("desc")
      .take(100);

    return rows.map((row) => ({
      id: row._id,
      report_id: row.reportId,
      reportId: row.reportId,
      type: row.type,
      message: row.message,
      created_by: row.createdBy ?? null,
      createdBy: row.createdBy ?? "",
      created_by_name: row.createdByName,
      createdByName: row.createdByName,
      created_at: row.createdAt,
      createdAt: row.createdAt,
    }));
  },
});
