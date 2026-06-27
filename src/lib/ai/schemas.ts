/**
 * Zod schemas for all AI response validation — Gemini only.
 */
import { z } from "zod/v4";

export const aiStatusEnum = z.enum(["PENDING", "PROCESSING", "COMPLETE", "FAILED"]);
export type AiStatus = z.infer<typeof aiStatusEnum>;

// 1. Garbage Detector (vision)
export const garbageDetectorLabelEnum = z.enum(["GARBAGE", "NOT_GARBAGE", "UNCERTAIN"]);
export type GarbageDetectorLabel = z.infer<typeof garbageDetectorLabelEnum>;

export const garbageDetectorResultSchema = z.object({
  label: garbageDetectorLabelEnum,
  confidence: z.number().min(0).max(1),
  reason: z.string().max(200),
  garbageTypes: z.array(z.string().max(50)).max(5),
  needsHumanReview: z.boolean(),
});
export type GarbageDetectorResult = z.infer<typeof garbageDetectorResultSchema>;

export const garbageDetectorDocSchema = garbageDetectorResultSchema.extend({
  model: z.string(),
  promptVersion: z.string(),
  createdAt: z.string(),
  imageHash: z.string(),
});
export type GarbageDetectorDoc = z.infer<typeof garbageDetectorDocSchema>;

// 2. Vision Triage
export const normalizedTypeEnum = z.enum([
  "OVERFLOW", "ILLEGAL_DUMP", "MISSED_PICKUP", "HAZARDOUS_WASTE", "DEAD_ANIMAL", "OTHER",
]);
export const hazardEnum = z.enum(["SHARP_OBJECTS", "BIOHAZARD", "CHEMICAL", "ASBESTOS", "HEAVY_ITEMS", "TRAFFIC", "NONE"]);
export const volumeEnum = z.enum(["SMALL", "MEDIUM", "LARGE"]);
export const crewTypeEnum = z.enum(["GENERAL", "BULKY_WASTE", "HAZMAT", "ANIMAL_CONTROL"]);
export const priorityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export const visionTriageResultSchema = z.object({
  normalizedType: normalizedTypeEnum,
  hazards: z.array(hazardEnum).max(7),
  estimatedVolume: volumeEnum,
  recommendedCrewType: crewTypeEnum,
  priority: priorityEnum,
  recommendedActions: z.array(z.string().max(200)).max(5),
  ppe: z.array(z.string().max(60)).max(6),
  confidence: z.number().min(0).max(1),
  needsHumanReview: z.boolean(),
  explanations: z.array(z.object({ claim: z.string().max(200), evidence: z.string().max(200) })).max(5),
});
export type VisionTriageResult = z.infer<typeof visionTriageResultSchema>;

export const visionTriageDocSchema = visionTriageResultSchema.extend({
  model: z.string(), promptVersion: z.string(), createdAt: z.string(),
});
export type VisionTriageDoc = z.infer<typeof visionTriageDocSchema>;

// 3. Crew Brief
export const crewBriefResultSchema = z.object({
  summary: z.string().max(240),
  checklist: z.array(z.string().max(100)).max(6),
  warnings: z.array(z.string().max(150)).max(5),
});
export type CrewBriefResult = z.infer<typeof crewBriefResultSchema>;

export const crewBriefDocSchema = crewBriefResultSchema.extend({
  model: z.string(), promptVersion: z.string(), createdAt: z.string(),
});
export type CrewBriefDoc = z.infer<typeof crewBriefDocSchema>;

// 4. Duplicate Ranking
export const duplicateCandidateSchema = z.object({
  reportId: z.string(), similarity: z.number().min(0).max(1), reason: z.string().max(300),
});
export const duplicateResultSchema = z.object({ rankedCandidates: z.array(duplicateCandidateSchema) });
export type DuplicateResult = z.infer<typeof duplicateResultSchema>;

export const duplicateDocSchema = duplicateResultSchema.extend({
  model: z.string(), promptVersion: z.string(), createdAt: z.string(),
});
export type DuplicateDoc = z.infer<typeof duplicateDocSchema>;

// 5. Resolution Note
export const resolutionNoteResultSchema = z.object({
  publicNote: z.string().max(200), internalSummary: z.string().max(400),
});
export type ResolutionNoteResult = z.infer<typeof resolutionNoteResultSchema>;

export const resolutionNoteDocSchema = resolutionNoteResultSchema.extend({
  model: z.string(), promptVersion: z.string(), createdAt: z.string(),
});
export type ResolutionNoteDoc = z.infer<typeof resolutionNoteDocSchema>;

// Legacy compat schemas
export const aiReportTypeEnum = z.enum(["OVERFLOW", "ILLEGAL_DUMP", "MISSED_PICKUP", "HAZARDOUS_WASTE", "OTHER"]);
export const aiSeverityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export const aiPriorityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export const aiTriageResultSchema = z.object({
  suggestedType: aiReportTypeEnum, severity: aiSeverityEnum, priority: aiPriorityEnum,
  recommendedAction: z.string().max(300), tags: z.array(z.string().max(50)).max(10),
  needsHumanReview: z.boolean(), confidence: z.number().min(0).max(1),
});
export type AiTriageResult = z.infer<typeof aiTriageResultSchema>;

export const aiTriageDocSchema = aiTriageResultSchema.extend({
  model: z.string(), promptVersion: z.string(), createdAt: z.string(), createdByUserId: z.string(),
});
export type AiTriageDoc = z.infer<typeof aiTriageDocSchema>;

export const aiDuplicateCandidateSchema = z.object({
  reportId: z.string(), similarity: z.number().min(0).max(1), reason: z.string().max(300),
});
export const aiDuplicateResultSchema = z.object({ rankedCandidates: z.array(aiDuplicateCandidateSchema) });
export type AiDuplicateResult = z.infer<typeof aiDuplicateResultSchema>;

export const aiDuplicateDocSchema = aiDuplicateResultSchema.extend({
  model: z.string(), promptVersion: z.string(), createdAt: z.string(), createdByUserId: z.string(),
});
export type AiDuplicateDoc = z.infer<typeof aiDuplicateDocSchema>;

export const aiCrewBriefResultSchema = z.object({
  summary: z.string().max(500), whatToBring: z.array(z.string().max(80)).max(10),
  hazards: z.array(z.string().max(120)).max(5),
});
export type AiCrewBriefResult = z.infer<typeof aiCrewBriefResultSchema>;

export const aiCrewBriefDocSchema = aiCrewBriefResultSchema.extend({
  model: z.string(), promptVersion: z.string(), createdAt: z.string(), createdByUserId: z.string(),
});
export type AiCrewBriefDoc = z.infer<typeof aiCrewBriefDocSchema>;

export const aiPublicNoteResultSchema = z.object({ note: z.string().max(500) });
export type AiPublicNoteResult = z.infer<typeof aiPublicNoteResultSchema>;

export const aiPublicNoteDocSchema = aiPublicNoteResultSchema.extend({
  model: z.string(), promptVersion: z.string(), createdAt: z.string(), createdByUserId: z.string(),
});
export type AiPublicNoteDoc = z.infer<typeof aiPublicNoteDocSchema>;

// Request body schemas
export const aiReportIdBodySchema = z.object({ reportId: z.string().min(1, "reportId is required") });
export const garbageCheckBodySchema = z.object({
  reportId: z.string().min(1, "reportId is required"), force: z.boolean().optional().default(false),
});

// AI run audit log
export const aiRunLogSchema = z.object({
  provider: z.string(), action: z.string(), reportId: z.string(), actorUserId: z.string(),
  model: z.string(), durationMs: z.number(), success: z.boolean(), error: z.string().optional(),
});
export type AiRunLog = z.infer<typeof aiRunLogSchema>;

export const garbageDetectorCacheSchema = garbageDetectorDocSchema.extend({ provider: z.literal("gemini") });
export type GarbageDetectorCacheDoc = z.infer<typeof garbageDetectorCacheSchema>;
