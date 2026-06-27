import { z } from "zod/v4";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export const reportTypeEnum = z.enum([
  "OVERFLOW",
  "ILLEGAL_DUMP",
  "MISSED_PICKUP",
]);

export const reportStatusEnum = z.enum([
  "NEW",
  "TRIAGED",
  "ASSIGNED",
  "IN_PROGRESS",
  "BLOCKED",
  "DONE",
  "REJECTED",
]);

export const priorityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export const activityTypeEnum = z.enum([
  "CREATED",
  "TRIAGED",
  "ASSIGNED",
  "UNASSIGNED",
  "STATUS_CHANGE",
  "COMPLETED",
  "MERGED",
  "COMMENT",
]);

// ---------------------------------------------------------------------------
// Status-transition rules
// ---------------------------------------------------------------------------
export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  NEW: ["TRIAGED", "REJECTED"],
  TRIAGED: ["ASSIGNED", "REJECTED"],
  ASSIGNED: ["IN_PROGRESS", "BLOCKED", "TRIAGED"],
  IN_PROGRESS: ["BLOCKED", "DONE"],
  BLOCKED: ["IN_PROGRESS", "ASSIGNED"],
  DONE: [],
  REJECTED: [],
};

const OPS_CAN_SET = ["TRIAGED", "ASSIGNED", "REJECTED"];
const CREW_CAN_SET = ["IN_PROGRESS", "BLOCKED", "DONE"];

export function isValidTransition(from: string, to: string): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function canRoleSetStatus(role: string, toStatus: string): boolean {
  if (role === "ops") return OPS_CAN_SET.includes(toStatus);
  if (role === "crew") return CREW_CAN_SET.includes(toStatus);
  return false;
}

// ---------------------------------------------------------------------------
// SLA rules (hours until due, by priority)
// ---------------------------------------------------------------------------
export const SLA_HOURS: Record<string, number> = {
  CRITICAL: 4,
  HIGH: 24,
  MEDIUM: 72,
  LOW: 168, // 7 days
};

export function computeSlaDueAt(
  priority: string,
  baseDate: Date = new Date(),
): Date {
  const hours = SLA_HOURS[priority] ?? SLA_HOURS.MEDIUM;
  return new Date(baseDate.getTime() + hours * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------
export const createReportSchema = z.object({
  type: reportTypeEnum,
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  notes: z.string().optional().default(""),
});

export const assignReportSchema = z.object({
  assignedToUserId: z.string().min(1, "User ID is required"),
  assignedToName: z.string().optional().default(""),
});

export const completeReportSchema = z.object({
  completionNotes: z.string().optional().default(""),
});

export const triageSchema = z.object({
  priority: priorityEnum,
  notes: z.string().optional().default(""),
});

export const statusChangeSchema = z.object({
  status: reportStatusEnum,
  notes: z.string().optional().default(""),
});

export const mergeReportSchema = z.object({
  targetReportId: z.string().min(1, "Target report ID is required"),
});

export const reportFormSchema = z.object({
  type: reportTypeEnum,
  lat: z.number().min(-90, "Invalid latitude").max(90, "Invalid latitude"),
  lng: z.number().min(-180, "Invalid longitude").max(180, "Invalid longitude"),
  notes: z.string().default(""),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;
export type AssignReportInput = z.infer<typeof assignReportSchema>;
export type CompleteReportInput = z.infer<typeof completeReportSchema>;
export type ReportFormInput = z.infer<typeof reportFormSchema>;
export type TriageInput = z.infer<typeof triageSchema>;
export type StatusChangeInput = z.infer<typeof statusChangeSchema>;
export type MergeReportInput = z.infer<typeof mergeReportSchema>;
