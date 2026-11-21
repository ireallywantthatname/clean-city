import { api } from "../../../convex/_generated/api";
import { getConvexClient } from "@/lib/convex/server";
import { haversineDistance } from "@/lib/geo";
import { aiVisionJson, aiTextJson, getAiProvider } from "@/lib/ai/openaiClient";
import {
  downloadImage,
  sha256,
  resolvePhotoPath,
  getCachedResult,
  setCachedResult,
} from "@/lib/ai/cache";
import { logAiRun } from "@/lib/ai/ledger";
import {
  garbageDetectorResultSchema,
  visionTriageResultSchema,
  crewBriefResultSchema,
  duplicateResultSchema,
  resolutionNoteResultSchema,
  type GarbageDetectorResult,
  type VisionTriageResult,
  type CrewBriefResult,
  type DuplicateResult,
  type ResolutionNoteResult,
} from "@/lib/ai/schemas";
import {
  GARBAGE_DETECTOR_SYSTEM,
  GARBAGE_DETECTOR_USER,
  GARBAGE_DETECTOR_PROMPT_VERSION,
  VISION_TRIAGE_SYSTEM,
  buildVisionTriageUser,
  VISION_TRIAGE_PROMPT_VERSION,
  CREW_BRIEF_SYSTEM,
  buildCrewBriefUser,
  CREW_BRIEF_PROMPT_VERSION,
  DUPLICATES_SYSTEM,
  buildDuplicatesUser,
  DUPLICATES_PROMPT_VERSION,
  RESOLUTION_NOTE_SYSTEM,
  buildResolutionNoteUser,
  RESOLUTION_NOTE_PROMPT_VERSION,
} from "@/lib/ai/prompts";

function provider() {
  return getAiProvider();
}

export interface ProcessReportResult {
  garbageDetector: GarbageDetectorResult | null;
  visionTriage: VisionTriageResult | null;
  crewBrief: CrewBriefResult | null;
  duplicates: DuplicateResult | null;
  errors: string[];
}

export async function processReport(
  reportId: string,
): Promise<ProcessReportResult> {
  const convex = getConvexClient();

  const reportData = await convex.query(api.reports.getById, { id: reportId });
  if (!reportData) throw new Error("Report not found");

  const initialAi = reportData.ai ?? { status: "PENDING" as const };
  await convex.mutation(api.reports.update, {
    id: reportId,
    ai: { ...initialAi, status: "PROCESSING" },
  });

  const result: ProcessReportResult = {
    garbageDetector: null,
    visionTriage: null,
    crewBrief: null,
    duplicates: null,
    errors: [],
  };

  let imageBase64: string | null = null;
  let imageMimeType = "image/jpeg";
  let imageHash = "";
  let storagePath = "";

  try {
    storagePath = resolvePhotoPath(
      reportId,
      reportData as unknown as Record<string, unknown>,
    );
    const { buffer, mimeType } = await downloadImage(
      reportData.beforePhotoUrl,
    );
    imageBase64 = buffer.toString("base64");
    imageMimeType = mimeType;
    imageHash = sha256(buffer);
  } catch (err) {
    result.errors.push(
      `Image download failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const now = new Date().toISOString();
  const aiUpdates: Record<string, unknown> = {};
  const reportType = reportData.type || "OVERFLOW";
  const reportNotes = reportData.notes || "";
  const lat = reportData.lat;
  const lng = reportData.lng;

  if (imageBase64) {
    const startTime = Date.now();
    try {
      const cached = await getCachedResult(imageHash);
      if (cached && cached.label) {
        result.garbageDetector = {
          label: cached.label as GarbageDetectorResult["label"],
          confidence: cached.confidence as number,
          reason: cached.reason as string,
          garbageTypes: (cached.garbage_types as string[]) || [],
          needsHumanReview: cached.needs_human_review as boolean,
        };
        aiUpdates["garbageDetector"] = {
          ...result.garbageDetector,
          model: (cached.model as string) ?? undefined,
          promptVersion: (cached.prompt_version as string) ?? undefined,
          createdAt: now,
          imageHash,
          cached: true,
        };
        logAiRun({
          action: "garbage_detector",
          reportId,
          userId: "system",
          model: (cached.model as string) || "cached",
          promptVersion:
            (cached.prompt_version as string) ||
            GARBAGE_DETECTOR_PROMPT_VERSION,
          durationMs: Date.now() - startTime,
          status: "cached",
          provider: provider(),
        }).catch(() => {});
      } else {
        const userPrompt = `${GARBAGE_DETECTOR_USER}

Report metadata (use if image is unavailable):
Type: ${reportType}
Notes: ${reportNotes}
Location: ${lat}, ${lng}`;

        const { data, model } = await aiVisionJson({
          systemInstruction: GARBAGE_DETECTOR_SYSTEM,
          userPrompt,
          imageBase64,
          imageMimeType,
          temperature: 0.2,
          maxOutputTokens: 512,
          validate: (raw) => garbageDetectorResultSchema.safeParse(raw),
        });
        result.garbageDetector = data;
        const doc = {
          ...data,
          model,
          promptVersion: GARBAGE_DETECTOR_PROMPT_VERSION,
          createdAt: now,
          imageHash,
        };
        aiUpdates["garbageDetector"] = doc;
        setCachedResult(imageHash, {
          label: data.label,
          confidence: data.confidence,
          reason: data.reason,
          garbage_types: data.garbageTypes,
          needs_human_review: data.needsHumanReview,
          model,
          prompt_version: GARBAGE_DETECTOR_PROMPT_VERSION,
        }).catch(() => {});
        logAiRun({
          action: "garbage_detector",
          reportId,
          userId: "system",
          model,
          promptVersion: GARBAGE_DETECTOR_PROMPT_VERSION,
          durationMs: Date.now() - startTime,
          status: "success",
          provider: provider(),
        }).catch(() => {});
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Garbage detector: ${msg}`);
      logAiRun({
        action: "garbage_detector",
        reportId,
        userId: "system",
        model: "unknown",
        promptVersion: GARBAGE_DETECTOR_PROMPT_VERSION,
        durationMs: Date.now() - startTime,
        status: "error",
        error: msg,
        provider: provider(),
      }).catch(() => {});
    }
  }

  if (imageBase64) {
    const startTime = Date.now();
    try {
      const { data, model } = await aiVisionJson({
        systemInstruction: VISION_TRIAGE_SYSTEM,
        userPrompt: buildVisionTriageUser({
          reportType,
          notes: reportNotes,
          lat,
          lng,
        }),
        imageBase64,
        imageMimeType,
        temperature: 0.2,
        maxOutputTokens: 1024,
        validate: (raw) => visionTriageResultSchema.safeParse(raw),
      });
      result.visionTriage = data;
      aiUpdates["visionTriage"] = {
        ...data,
        model,
        promptVersion: VISION_TRIAGE_PROMPT_VERSION,
        createdAt: now,
      };
      logAiRun({
        action: "vision_triage",
        reportId,
        userId: "system",
        model,
        promptVersion: VISION_TRIAGE_PROMPT_VERSION,
        durationMs: Date.now() - startTime,
        status: "success",
        provider: provider(),
      }).catch(() => {});
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Vision triage: ${msg}`);
      logAiRun({
        action: "vision_triage",
        reportId,
        userId: "system",
        model: "unknown",
        promptVersion: VISION_TRIAGE_PROMPT_VERSION,
        durationMs: Date.now() - startTime,
        status: "error",
        error: msg,
        provider: provider(),
      }).catch(() => {});
    }
  }

  {
    const startTime = Date.now();
    try {
      const { data, model } = await aiTextJson({
        systemInstruction: CREW_BRIEF_SYSTEM,
        userPrompt: buildCrewBriefUser({
          reportType,
          notes: reportNotes,
          priority:
            result.visionTriage?.priority || reportData.priority || "MEDIUM",
          status: reportData.status || "NEW",
          garbageTypes: result.garbageDetector?.garbageTypes,
          hazards: result.visionTriage?.hazards?.filter((h) => h !== "NONE"),
          estimatedVolume: result.visionTriage?.estimatedVolume,
        }),
        temperature: 0.3,
        maxOutputTokens: 512,
        validate: (raw) => crewBriefResultSchema.safeParse(raw),
      });
      result.crewBrief = data;
      aiUpdates["crewBrief"] = {
        ...data,
        model,
        promptVersion: CREW_BRIEF_PROMPT_VERSION,
        createdAt: now,
      };
      logAiRun({
        action: "crew_brief",
        reportId,
        userId: "system",
        model,
        promptVersion: CREW_BRIEF_PROMPT_VERSION,
        durationMs: Date.now() - startTime,
        status: "success",
        provider: provider(),
      }).catch(() => {});
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Crew brief: ${msg}`);
      logAiRun({
        action: "crew_brief",
        reportId,
        userId: "system",
        model: "unknown",
        promptVersion: CREW_BRIEF_PROMPT_VERSION,
        durationMs: Date.now() - startTime,
        status: "error",
        error: msg,
        provider: provider(),
      }).catch(() => {});
    }
  }

  {
    const startTime = Date.now();
    try {
      const sourceCreatedAt = new Date(reportData.createdAt);
      const cutoff = new Date(
        sourceCreatedAt.getTime() - 168 * 60 * 60 * 1000,
      );
      const recentReports = await convex.query(api.reports.listRecentSince, {
        since: cutoff.toISOString(),
        limit: 100,
      });

      const candidates = recentReports
        .filter((d) => d.id !== reportId)
        .filter((d) => d.status !== "REJECTED")
        .filter((d) => haversineDistance(lat, lng, d.lat, d.lng) <= 500)
        .map((d) => {
          const created = new Date(d.createdAt);
          return {
            id: d.id,
            type: d.type,
            notes: d.notes || "",
            distanceMeters: Math.round(
              haversineDistance(lat, lng, d.lat, d.lng),
            ),
            ageHoursApart:
              Math.round(
                (Math.abs(sourceCreatedAt.getTime() - created.getTime()) /
                  3600_000) *
                  10,
              ) / 10,
          };
        })
        .slice(0, 15);

      if (candidates.length > 0) {
        const { data, model } = await aiTextJson({
          systemInstruction: DUPLICATES_SYSTEM,
          userPrompt: buildDuplicatesUser({
            target: {
              id: reportId,
              type: reportType,
              notes: reportNotes,
              lat,
              lng,
              createdAt: sourceCreatedAt.toISOString(),
            },
            candidates,
          }),
          temperature: 0.2,
          maxOutputTokens: 1024,
          validate: (raw) => duplicateResultSchema.safeParse(raw),
        });
        const validIds = new Set(candidates.map((c) => c.id));
        data.rankedCandidates = data.rankedCandidates.filter((c) =>
          validIds.has(c.reportId),
        );
        result.duplicates = data;
        aiUpdates["duplicates"] = {
          ...data,
          model,
          promptVersion: DUPLICATES_PROMPT_VERSION,
          createdAt: now,
        };
        logAiRun({
          action: "duplicates",
          reportId,
          userId: "system",
          model,
          promptVersion: DUPLICATES_PROMPT_VERSION,
          durationMs: Date.now() - startTime,
          status: "success",
          provider: provider(),
        }).catch(() => {});
      } else {
        result.duplicates = { rankedCandidates: [] };
        aiUpdates["duplicates"] = {
          rankedCandidates: [],
          model: "n/a",
          promptVersion: DUPLICATES_PROMPT_VERSION,
          createdAt: now,
        };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Duplicates: ${msg}`);
    }
  }

  const existingAi = reportData.ai ?? { status: "PENDING" as const };
  const hasAnyResult =
    result.garbageDetector || result.visionTriage || result.crewBrief;
  const finalAi = {
    ...existingAi,
    ...aiUpdates,
    status: (hasAnyResult ? "COMPLETE" : "FAILED") as "COMPLETE" | "FAILED",
    processedAt: now,
    errors: result.errors.length > 0 ? result.errors : undefined,
  };

  await convex.mutation(api.reports.update, {
    id: reportId,
    ai: finalAi,
    beforePhotoPath: storagePath || undefined,
  });

  return result;
}

export interface ProcessCompletionResult {
  resolutionNote: ResolutionNoteResult | null;
  errors: string[];
}

export async function processCompletion(
  reportId: string,
): Promise<ProcessCompletionResult> {
  const convex = getConvexClient();

  const reportData = await convex.query(api.reports.getById, { id: reportId });
  if (!reportData) throw new Error("Report not found");

  const result: ProcessCompletionResult = { resolutionNote: null, errors: [] };
  const startTime = Date.now();
  const now = new Date().toISOString();

  try {
    const garbageTypes = reportData.ai?.garbageDetector?.garbageTypes || [];

    const { data, model } = await aiTextJson({
      systemInstruction: RESOLUTION_NOTE_SYSTEM,
      userPrompt: buildResolutionNoteUser({
        reportType: reportData.type || "OVERFLOW",
        notes: reportData.notes || "",
        completionNotes: reportData.completionNotes || "",
        status: reportData.status || "DONE",
        garbageTypes,
        priority: reportData.priority,
      }),
      temperature: 0.3,
      maxOutputTokens: 512,
      validate: (raw) => resolutionNoteResultSchema.safeParse(raw),
    });

    result.resolutionNote = data;

    const existingAi = reportData.ai ?? { status: "COMPLETE" as const };
    await convex.mutation(api.reports.update, {
      id: reportId,
      ai: {
        ...existingAi,
        resolutionNote: {
          ...data,
          model,
          promptVersion: RESOLUTION_NOTE_PROMPT_VERSION,
          createdAt: now,
        },
      },
    });

    logAiRun({
      action: "resolution_note",
      reportId,
      userId: "system",
      model,
      promptVersion: RESOLUTION_NOTE_PROMPT_VERSION,
      durationMs: Date.now() - startTime,
      status: "success",
      provider: provider(),
    }).catch(() => {});
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Resolution note: ${msg}`);
    logAiRun({
      action: "resolution_note",
      reportId,
      userId: "system",
      model: "unknown",
      promptVersion: RESOLUTION_NOTE_PROMPT_VERSION,
      durationMs: Date.now() - startTime,
      status: "error",
      error: msg,
      provider: provider(),
    }).catch(() => {});
  }

  return result;
}
