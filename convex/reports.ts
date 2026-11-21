import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";
import {
  priorityValidator,
  reportAiValidator,
  reportStatusValidator,
  reportTypeValidator,
} from "./schema";
import { activityItemValidator } from "./activities";

export const reportResponseValidator = v.object({
  id: v.string(),
  type: reportTypeValidator,
  status: reportStatusValidator,
  lat: v.number(),
  lng: v.number(),
  notes: v.optional(v.string()),
  beforePhotoUrl: v.string(),
  before_photo_url: v.string(),
  afterPhotoUrl: v.optional(v.string()),
  after_photo_url: v.optional(v.string()),
  beforePhotoPath: v.optional(v.string()),
  before_photo_path: v.optional(v.string()),
  createdAt: v.string(),
  created_at: v.string(),
  updatedAt: v.string(),
  updated_at: v.string(),
  assignedAt: v.optional(v.string()),
  assigned_at: v.optional(v.string()),
  resolvedAt: v.optional(v.string()),
  resolved_at: v.optional(v.string()),
  triagedAt: v.optional(v.string()),
  triaged_at: v.optional(v.string()),
  triagedByUserId: v.optional(v.string()),
  triaged_by_user_id: v.optional(v.string()),
  assignedToUserId: v.optional(v.string()),
  assigned_to_user_id: v.optional(v.string()),
  assignedToName: v.optional(v.string()),
  assigned_to_name: v.optional(v.string()),
  completionNotes: v.optional(v.string()),
  completion_notes: v.optional(v.string()),
  priority: v.optional(priorityValidator),
  slaDueAt: v.optional(v.string()),
  sla_due_at: v.optional(v.string()),
  mergedIntoReportId: v.optional(v.string()),
  merged_into_report_id: v.optional(v.string()),
  privacyNote: v.optional(v.string()),
  privacy_note: v.optional(v.string()),
  geohash: v.optional(v.string()),
  ai: v.optional(v.union(reportAiValidator, v.null())),
});

async function serializeReport(ctx: QueryCtx, doc: Doc<"reports">) {
  const beforePhotoUrl = doc.beforePhotoStorageId
    ? ((await ctx.storage.getUrl(doc.beforePhotoStorageId)) ?? "")
    : "";
  const afterPhotoUrl = doc.afterPhotoStorageId
    ? ((await ctx.storage.getUrl(doc.afterPhotoStorageId)) ?? undefined)
    : undefined;

  return {
    id: String(doc._id),
    type: doc.type,
    status: doc.status,
    lat: doc.lat,
    lng: doc.lng,
    notes: doc.notes,
    beforePhotoUrl,
    before_photo_url: beforePhotoUrl,
    afterPhotoUrl,
    after_photo_url: afterPhotoUrl,
    beforePhotoPath: doc.beforePhotoPath,
    before_photo_path: doc.beforePhotoPath,
    createdAt: doc.createdAt,
    created_at: doc.createdAt,
    updatedAt: doc.updatedAt,
    updated_at: doc.updatedAt,
    assignedAt: doc.assignedAt,
    assigned_at: doc.assignedAt,
    resolvedAt: doc.resolvedAt,
    resolved_at: doc.resolvedAt,
    triagedAt: doc.triagedAt,
    triaged_at: doc.triagedAt,
    triagedByUserId: doc.triagedByUserId,
    triaged_by_user_id: doc.triagedByUserId,
    assignedToUserId: doc.assignedToUserId,
    assigned_to_user_id: doc.assignedToUserId,
    assignedToName: doc.assignedToName,
    assigned_to_name: doc.assignedToName,
    completionNotes: doc.completionNotes,
    completion_notes: doc.completionNotes,
    priority: doc.priority,
    slaDueAt: doc.slaDueAt,
    sla_due_at: doc.slaDueAt,
    mergedIntoReportId: doc.mergedIntoReportId,
    merged_into_report_id: doc.mergedIntoReportId,
    privacyNote: doc.privacyNote,
    privacy_note: doc.privacyNote,
    geohash: doc.geohash,
    ai: doc.ai ?? null,
  };
}

export const create = mutation({
  args: {
    type: reportTypeValidator,
    lat: v.number(),
    lng: v.number(),
    notes: v.string(),
    geohash: v.string(),
    beforePhotoStorageId: v.optional(v.id("_storage")),
    beforePhotoPath: v.optional(v.string()),
  },
  returns: v.id("reports"),
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    return await ctx.db.insert("reports", {
      type: args.type,
      status: "NEW",
      lat: args.lat,
      lng: args.lng,
      notes: args.notes,
      geohash: args.geohash,
      beforePhotoStorageId: args.beforePhotoStorageId,
      beforePhotoPath: args.beforePhotoPath,
      createdAt: now,
      updatedAt: now,
      ai: { status: "PENDING" },
    });
  },
});

export const getById = query({
  args: {
    id: v.string(),
    includeActivities: v.optional(v.boolean()),
  },
  returns: v.union(
    reportResponseValidator.extend({
      activities: v.optional(v.array(activityItemValidator)),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const normalizedId = ctx.db.normalizeId("reports", args.id);
    if (!normalizedId) return null;

    const doc = await ctx.db.get(normalizedId);
    if (!doc) return null;

    const base = await serializeReport(ctx, doc);
    if (!args.includeActivities) {
      return base;
    }

    const activityRows = await ctx.db
      .query("activities")
      .withIndex("by_reportId", (q) => q.eq("reportId", normalizedId))
      .order("desc")
      .take(100);

    const activities = activityRows.map((row) => ({
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

    return {
      ...base,
      activities,
    };
  },
});

export const list = query({
  args: {
    status: v.optional(v.string()),
    type: v.optional(v.string()),
    priority: v.optional(v.string()),
    assignedTo: v.optional(v.string()),
    cursor: v.optional(v.string()),
    limit: v.number(),
  },
  returns: v.object({
    reports: v.array(reportResponseValidator),
    nextCursor: v.union(v.string(), v.null()),
    total: v.number(),
  }),
  handler: async (ctx, args) => {
    const cursorValue = args.cursor;
    const rows = await ctx.db
      .query("reports")
      .withIndex("by_createdAt", (q) =>
        cursorValue ? q.lt("createdAt", cursorValue) : q,
      )
      .order("desc")
      .take(500);

    const openStatuses = new Set([
      "NEW",
      "TRIAGED",
      "ASSIGNED",
      "IN_PROGRESS",
      "BLOCKED",
    ]);

    const filtered = rows.filter((r) => {
      if (args.status && args.status !== "all") {
        if (args.status === "open") {
          if (!openStatuses.has(r.status)) return false;
        } else if (r.status !== args.status.toUpperCase()) {
          return false;
        }
      }
      if (args.type && args.type !== "all") {
        if (r.type !== args.type.toUpperCase()) return false;
      }
      if (args.priority && args.priority !== "all") {
        if (r.priority !== args.priority.toUpperCase()) return false;
      }
      if (args.assignedTo) {
        if (r.assignedToUserId !== args.assignedTo) return false;
      }
      return true;
    });

    const limit = Math.min(Math.max(args.limit, 1), 5000);
    const hasMore = filtered.length > limit;
    const pageRows = hasMore ? filtered.slice(0, limit) : filtered;
    const serialized = await Promise.all(
      pageRows.map((row) => serializeReport(ctx, row)),
    );

    return {
      reports: serialized,
      nextCursor:
        hasMore && serialized.length > 0
          ? serialized[serialized.length - 1].createdAt
          : null,
      total: filtered.length,
    };
  },
});

export const listRecentSince = query({
  args: {
    since: v.string(),
    type: v.optional(reportTypeValidator),
    limit: v.optional(v.number()),
  },
  returns: v.array(reportResponseValidator),
  handler: async (ctx, args) => {
    const maxItems = Math.min(args.limit ?? 200, 500);
    const rows = await ctx.db
      .query("reports")
      .withIndex("by_createdAt", (q) => q.gte("createdAt", args.since))
      .order("desc")
      .take(maxItems);

    const filtered = args.type
      ? rows.filter((r) => r.type === args.type)
      : rows;

    return await Promise.all(filtered.map((row) => serializeReport(ctx, row)));
  },
});

export const listPendingAi = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      id: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const maxItems = Math.min(args.limit ?? 50, 100);
    const rows = await ctx.db
      .query("reports")
      .withIndex("by_createdAt")
      .order("desc")
      .take(200);

    return rows
      .filter((r) => {
        const st = r.ai?.status ?? "PENDING";
        return st === "PENDING" || st === "FAILED";
      })
      .slice(0, maxItems)
      .map((r) => ({ id: r._id }));
  },
});

export const update = mutation({
  args: {
    id: v.string(),
    status: v.optional(reportStatusValidator),
    priority: v.optional(priorityValidator),
    slaDueAt: v.optional(v.string()),
    triagedAt: v.optional(v.string()),
    triagedByUserId: v.optional(v.string()),
    assignedToUserId: v.optional(v.string()),
    assignedToName: v.optional(v.string()),
    assignedAt: v.optional(v.string()),
    completionNotes: v.optional(v.string()),
    resolvedAt: v.optional(v.string()),
    beforePhotoStorageId: v.optional(v.id("_storage")),
    beforePhotoPath: v.optional(v.string()),
    afterPhotoStorageId: v.optional(v.id("_storage")),
    mergedIntoReportId: v.optional(v.string()),
    ai: v.optional(reportAiValidator),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const normalizedId = ctx.db.normalizeId("reports", args.id);
    if (!normalizedId) return false;

    const existing = await ctx.db.get(normalizedId);
    if (!existing) return false;

    const patch: Partial<Doc<"reports">> = {
      updatedAt: new Date().toISOString(),
    };

    if (args.status !== undefined) patch.status = args.status;
    if (args.priority !== undefined) patch.priority = args.priority;
    if (args.slaDueAt !== undefined) patch.slaDueAt = args.slaDueAt;
    if (args.triagedAt !== undefined) patch.triagedAt = args.triagedAt;
    if (args.triagedByUserId !== undefined)
      patch.triagedByUserId = args.triagedByUserId;
    if (args.assignedToUserId !== undefined)
      patch.assignedToUserId = args.assignedToUserId;
    if (args.assignedToName !== undefined)
      patch.assignedToName = args.assignedToName;
    if (args.assignedAt !== undefined) patch.assignedAt = args.assignedAt;
    if (args.completionNotes !== undefined)
      patch.completionNotes = args.completionNotes;
    if (args.resolvedAt !== undefined) patch.resolvedAt = args.resolvedAt;
    if (args.beforePhotoStorageId !== undefined)
      patch.beforePhotoStorageId = args.beforePhotoStorageId;
    if (args.beforePhotoPath !== undefined)
      patch.beforePhotoPath = args.beforePhotoPath;
    if (args.afterPhotoStorageId !== undefined)
      patch.afterPhotoStorageId = args.afterPhotoStorageId;
    if (args.mergedIntoReportId !== undefined) {
      const targetId = ctx.db.normalizeId("reports", args.mergedIntoReportId);
      if (targetId) patch.mergedIntoReportId = targetId;
    }
    if (args.ai !== undefined) patch.ai = args.ai;

    await ctx.db.patch(normalizedId, patch);
    return true;
  },
});

export const getAnalyticsSummary = query({
  args: {
    since: v.string(),
    nowIso: v.string(),
  },
  returns: v.object({
    openCount: v.number(),
    overdueCount: v.number(),
    medianCloseHours: v.union(v.number(), v.null()),
    topCategory: v.union(v.string(), v.null()),
    topCategoryCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("reports")
      .withIndex("by_createdAt")
      .order("desc")
      .take(1000);

    const openStatuses = new Set([
      "NEW",
      "TRIAGED",
      "ASSIGNED",
      "IN_PROGRESS",
      "BLOCKED",
    ]);

    let openCount = 0;
    let overdueCount = 0;
    const closeHours: number[] = [];
    const typeCounts: Record<string, number> = {};

    for (const r of rows) {
      if (openStatuses.has(r.status)) {
        openCount++;
        if (r.slaDueAt && r.slaDueAt < args.nowIso) {
          overdueCount++;
        }
      }
      if (r.createdAt >= args.since) {
        typeCounts[r.type] = (typeCounts[r.type] || 0) + 1;
        if (r.status === "DONE" && r.resolvedAt) {
          const hrs =
            (new Date(r.resolvedAt).getTime() -
              new Date(r.createdAt).getTime()) /
            3_600_000;
          closeHours.push(hrs);
        }
      }
    }

    let medianCloseHours: number | null = null;
    if (closeHours.length > 0) {
      closeHours.sort((a, b) => a - b);
      const mid = Math.floor(closeHours.length / 2);
      medianCloseHours =
        closeHours.length % 2 === 0
          ? (closeHours[mid - 1] + closeHours[mid]) / 2
          : closeHours[mid];
    }

    const top = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];

    return {
      openCount,
      overdueCount,
      medianCloseHours,
      topCategory: top ? top[0] : null,
      topCategoryCount: top ? top[1] : 0,
    };
  },
});

export const getGeohashesSince = query({
  args: {
    since: v.string(),
  },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("reports")
      .withIndex("by_createdAt", (q) => q.gte("createdAt", args.since))
      .order("desc")
      .take(1000);

    const hashes: string[] = [];
    for (const r of rows) {
      if (r.geohash) hashes.push(r.geohash);
    }
    return hashes;
  },
});
