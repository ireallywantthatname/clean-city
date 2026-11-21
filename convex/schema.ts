import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const userRoleValidator = v.union(v.literal("ops"), v.literal("crew"));

export const reportTypeValidator = v.union(
  v.literal("OVERFLOW"),
  v.literal("ILLEGAL_DUMP"),
  v.literal("MISSED_PICKUP"),
);

export const reportStatusValidator = v.union(
  v.literal("NEW"),
  v.literal("TRIAGED"),
  v.literal("ASSIGNED"),
  v.literal("IN_PROGRESS"),
  v.literal("BLOCKED"),
  v.literal("DONE"),
  v.literal("REJECTED"),
);

export const priorityValidator = v.union(
  v.literal("LOW"),
  v.literal("MEDIUM"),
  v.literal("HIGH"),
  v.literal("CRITICAL"),
);

export const activityTypeValidator = v.union(
  v.literal("CREATED"),
  v.literal("TRIAGED"),
  v.literal("ASSIGNED"),
  v.literal("UNASSIGNED"),
  v.literal("STATUS_CHANGE"),
  v.literal("COMPLETED"),
  v.literal("MERGED"),
  v.literal("COMMENT"),
);

export const aiStatusValidator = v.union(
  v.literal("PENDING"),
  v.literal("PROCESSING"),
  v.literal("COMPLETE"),
  v.literal("FAILED"),
);

export const garbageLabelValidator = v.union(
  v.literal("GARBAGE"),
  v.literal("NOT_GARBAGE"),
  v.literal("UNCERTAIN"),
);

export const aiGarbageDetectorValidator = v.object({
  label: garbageLabelValidator,
  confidence: v.number(),
  reason: v.string(),
  garbageTypes: v.array(v.string()),
  needsHumanReview: v.boolean(),
  model: v.optional(v.string()),
  promptVersion: v.optional(v.string()),
  createdAt: v.optional(v.string()),
  imageHash: v.optional(v.string()),
  cached: v.optional(v.boolean()),
});

export const aiVisionTriageValidator = v.object({
  normalizedType: v.string(),
  hazards: v.array(v.string()),
  estimatedVolume: v.string(),
  recommendedCrewType: v.string(),
  priority: v.string(),
  recommendedActions: v.array(v.string()),
  ppe: v.array(v.string()),
  confidence: v.number(),
  needsHumanReview: v.boolean(),
  explanations: v.array(
    v.object({
      claim: v.string(),
      evidence: v.string(),
    }),
  ),
  model: v.optional(v.string()),
  promptVersion: v.optional(v.string()),
  createdAt: v.optional(v.string()),
});

export const aiTriageValidator = v.object({
  suggestedType: v.string(),
  severity: v.string(),
  priority: v.string(),
  recommendedAction: v.string(),
  tags: v.array(v.string()),
  needsHumanReview: v.boolean(),
  confidence: v.number(),
  model: v.optional(v.string()),
  promptVersion: v.optional(v.string()),
  createdAt: v.optional(v.string()),
  createdByUserId: v.optional(v.string()),
});

export const aiCrewBriefValidator = v.object({
  summary: v.string(),
  checklist: v.optional(v.array(v.string())),
  warnings: v.optional(v.array(v.string())),
  whatToBring: v.optional(v.array(v.string())),
  hazards: v.optional(v.array(v.string())),
  model: v.optional(v.string()),
  promptVersion: v.optional(v.string()),
  createdAt: v.optional(v.string()),
  createdByUserId: v.optional(v.string()),
});

export const aiDuplicatesValidator = v.object({
  rankedCandidates: v.array(
    v.object({
      reportId: v.string(),
      similarity: v.number(),
      reason: v.string(),
    }),
  ),
  model: v.optional(v.string()),
  promptVersion: v.optional(v.string()),
  createdAt: v.optional(v.string()),
  createdByUserId: v.optional(v.string()),
});

export const aiResolutionNoteValidator = v.object({
  publicNote: v.string(),
  internalSummary: v.string(),
  model: v.optional(v.string()),
  promptVersion: v.optional(v.string()),
  createdAt: v.optional(v.string()),
});

export const aiPublicNoteValidator = v.object({
  note: v.string(),
  model: v.optional(v.string()),
  promptVersion: v.optional(v.string()),
  createdAt: v.optional(v.string()),
  createdByUserId: v.optional(v.string()),
});

export const reportAiValidator = v.object({
  status: aiStatusValidator,
  garbageDetector: v.optional(v.union(aiGarbageDetectorValidator, v.null())),
  visionTriage: v.optional(v.union(aiVisionTriageValidator, v.null())),
  triage: v.optional(v.union(aiTriageValidator, v.null())),
  crewBrief: v.optional(v.union(aiCrewBriefValidator, v.null())),
  duplicates: v.optional(v.union(aiDuplicatesValidator, v.null())),
  resolutionNote: v.optional(v.union(aiResolutionNoteValidator, v.null())),
  publicNote: v.optional(v.union(aiPublicNoteValidator, v.null())),
  processedAt: v.optional(v.union(v.string(), v.null())),
  errors: v.optional(v.array(v.string())),
});

export default defineSchema({
  users: defineTable({
    email: v.string(),
    name: v.string(),
    role: userRoleValidator,
    passwordHash: v.string(),
    updatedAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_role", ["role"]),

  sessions: defineTable({
    token: v.string(),
    userId: v.id("users"),
    expiresAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_userId", ["userId"]),

  reports: defineTable({
    type: reportTypeValidator,
    status: reportStatusValidator,
    lat: v.number(),
    lng: v.number(),
    notes: v.optional(v.string()),
    beforePhotoStorageId: v.optional(v.id("_storage")),
    afterPhotoStorageId: v.optional(v.id("_storage")),
    beforePhotoPath: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
    createdBy: v.optional(v.string()),
    assignedAt: v.optional(v.string()),
    assignedToUserId: v.optional(v.string()),
    assignedToName: v.optional(v.string()),
    triagedAt: v.optional(v.string()),
    triagedByUserId: v.optional(v.string()),
    resolvedAt: v.optional(v.string()),
    completionNotes: v.optional(v.string()),
    priority: v.optional(priorityValidator),
    slaDueAt: v.optional(v.string()),
    mergedIntoReportId: v.optional(v.id("reports")),
    privacyNote: v.optional(v.string()),
    geohash: v.optional(v.string()),
    ai: v.optional(reportAiValidator),
  })
    .index("by_status", ["status"])
    .index("by_type", ["type"])
    .index("by_priority", ["priority"])
    .index("by_assignedToUserId", ["assignedToUserId"])
    .index("by_createdAt", ["createdAt"]),

  activities: defineTable({
    reportId: v.id("reports"),
    type: activityTypeValidator,
    message: v.string(),
    createdBy: v.optional(v.string()),
    createdByName: v.string(),
    createdAt: v.string(),
  }).index("by_reportId", ["reportId"]),

  ai_runs: defineTable({
    action: v.string(),
    reportId: v.id("reports"),
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
  }).index("by_reportId", ["reportId"]),

  ai_image_cache: defineTable({
    imageHash: v.string(),
    label: v.optional(garbageLabelValidator),
    confidence: v.optional(v.number()),
    reason: v.optional(v.string()),
    garbageTypes: v.optional(v.array(v.string())),
    needsHumanReview: v.optional(v.boolean()),
    model: v.optional(v.string()),
    promptVersion: v.optional(v.string()),
    provider: v.optional(v.string()),
    createdAt: v.string(),
  }).index("by_imageHash", ["imageHash"]),

  ai_weekly_insights: defineTable({
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
  }).index("by_createdAt", ["createdAt"]),
});
