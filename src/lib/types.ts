export type ReportStatus =
  | "NEW"
  | "TRIAGED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "BLOCKED"
  | "DONE"
  | "REJECTED";

export type ReportType = "OVERFLOW" | "ILLEGAL_DUMP" | "MISSED_PICKUP";

export type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type AiStatus = "PENDING" | "PROCESSING" | "COMPLETE" | "FAILED";

export type ActivityType =
  | "CREATED"
  | "TRIAGED"
  | "ASSIGNED"
  | "UNASSIGNED"
  | "STATUS_CHANGE"
  | "COMPLETED"
  | "MERGED"
  | "COMMENT";

// ---------------------------------------------------------------------------
// AI sub-document types (nested under report.ai JSONB)
// ---------------------------------------------------------------------------
export interface AiGarbageDetector {
  label: "GARBAGE" | "NOT_GARBAGE" | "UNCERTAIN";
  confidence: number;
  reason: string;
  garbageTypes: string[];
  needsHumanReview: boolean;
  model: string;
  promptVersion: string;
  createdAt: string;
  imageHash: string;
}

export interface AiVisionTriage {
  normalizedType: string;
  hazards: string[];
  estimatedVolume: string;
  recommendedCrewType: string;
  priority: string;
  recommendedActions: string[];
  ppe: string[];
  confidence: number;
  needsHumanReview: boolean;
  explanations: { claim: string; evidence: string }[];
  model: string;
  promptVersion: string;
  createdAt: string;
}

export interface AiCrewBrief {
  summary: string;
  checklist: string[];
  warnings: string[];
  model: string;
  promptVersion: string;
  createdAt: string;
}

export interface AiDuplicates {
  rankedCandidates: { reportId: string; similarity: number; reason: string }[];
  model: string;
  promptVersion: string;
  createdAt: string;
}

export interface AiResolutionNote {
  publicNote: string;
  internalSummary: string;
  model: string;
  promptVersion: string;
  createdAt: string;
}

export interface ReportAi {
  status: AiStatus;
  garbageDetector?: AiGarbageDetector | null;
  visionTriage?: AiVisionTriage | null;
  crewBrief?: AiCrewBrief | null;
  duplicates?: AiDuplicates | null;
  resolutionNote?: AiResolutionNote | null;
  processedAt?: string | null;
  errors?: string[];
}

// ---------------------------------------------------------------------------

export interface Report {
  id: string;
  type: ReportType;
  status: ReportStatus;
  lat: number;
  lng: number;
  notes?: string;
  beforePhotoUrl: string;
  afterPhotoUrl?: string;
  createdAt: string;
  assignedAt?: string;
  resolvedAt?: string;
  triagedAt?: string;
  triagedByUserId?: string;
  assignedToUserId?: string;
  assignedToName?: string;
  completionNotes?: string;
  priority?: Priority;
  slaDueAt?: string;
  mergedIntoReportId?: string;
  privacyNote?: string;
  geohash?: string;
  ai?: ReportAi | null;
  beforePhotoPath?: string;
}

export interface Activity {
  id: string;
  type: ActivityType;
  message: string;
  createdAt: string;
  createdBy: string;
  createdByName: string;
}

export type UserRole = "ops" | "crew";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface CrewUser {
  id: string;
  name: string;
  email: string;
}

export interface HotspotCell {
  cellId: string;
  centerLat: number;
  centerLng: number;
  count: number;
}

export interface AnalyticsSummary {
  openCount: number;
  overdueCount: number;
  medianCloseHours: number | null;
  topCategory: string | null;
  topCategoryCount: number;
}
