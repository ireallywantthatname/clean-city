/**
 * AI Pipeline Orchestrator — server-side only.
 *
 * Runs the full AI pipeline for a report or completion event.
 * Called by /api/ai/process-report and /api/ai/process-completion.
 */
import { getSupabaseRoute } from "@/lib/supabase/server";
import { haversineDistance } from "@/lib/geo";
import { aiVisionJson, aiTextJson, getAiProvider } from "@/lib/ai/openaiClient";
import { downloadImage, sha256, resolvePhotoPath, getCachedResult, setCachedResult } from "@/lib/ai/cache";
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
  GARBAGE_DETECTOR_SYSTEM, GARBAGE_DETECTOR_USER, GARBAGE_DETECTOR_PROMPT_VERSION,
  VISION_TRIAGE_SYSTEM, buildVisionTriageUser, VISION_TRIAGE_PROMPT_VERSION,
  CREW_BRIEF_SYSTEM, buildCrewBriefUser, CREW_BRIEF_PROMPT_VERSION,
  DUPLICATES_SYSTEM, buildDuplicatesUser, DUPLICATES_PROMPT_VERSION,
  RESOLUTION_NOTE_SYSTEM, buildResolutionNoteUser, RESOLUTION_NOTE_PROMPT_VERSION,
} from "@/lib/ai/prompts";

function supabase() {
  return getSupabaseRoute();
}

function provider() {
  return getAiProvider();
}

// ---------------------------------------------------------------------------
// Report creation pipeline
// ---------------------------------------------------------------------------
export interface ProcessReportResult {
  garbageDetector: GarbageDetectorResult | null;
  visionTriage: VisionTriageResult | null;
  crewBrief: CrewBriefResult | null;
  duplicates: DuplicateResult | null;
  errors: string[];
}

export async function processReport(reportId: string): Promise<ProcessReportResult> {
  const db = await supabase();

  const { data: reportData, error: fetchErr } = await db
    .from("reports")
    .select("*")
    .eq("id", reportId)
    .single();
  if (fetchErr || !reportData) throw new Error("Report not found");

  await db.from("reports").update({
    ai: { ...(reportData.ai || {}), status: "PROCESSING" },
  }).eq("id", reportId);

  const result: ProcessReportResult = {
    garbageDetector: null, visionTriage: null, crewBrief: null, duplicates: null, errors: [],
  };

  let imageBase64: string | null = null;
  let imageMimeType = "image/jpeg";
  let imageHash = "";
  let storagePath = "";

  try {
    storagePath = resolvePhotoPath(reportId, reportData);
    const { buffer, mimeType } = await downloadImage(storagePath);
    imageBase64 = buffer.toString("base64");
    imageMimeType = mimeType;
    imageHash = sha256(buffer);
  } catch (err) {
    result.errors.push(`Image download failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  const now = new Date().toISOString();
  const aiUpdates: Record<string, unknown> = {};
  const reportType = (reportData.type as string) || "UNKNOWN";
  const reportNotes = (reportData.notes as string) || "";
  const lat = reportData.lat as number;
  const lng = reportData.lng as number;

  // 1. Garbage Detection
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
          model: cached.model,
          promptVersion: cached.prompt_version,
          createdAt: now,
          imageHash,
          cached: true,
        };
        logAiRun({
          action: "garbage_detector", reportId, userId: "system",
          model: (cached.model as string) || "cached",
          promptVersion: (cached.prompt_version as string) || GARBAGE_DETECTOR_PROMPT_VERSION,
          durationMs: Date.now() - startTime, status: "cached", provider: provider(),
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
          action: "garbage_detector", reportId, userId: "system",
          model, promptVersion: GARBAGE_DETECTOR_PROMPT_VERSION,
          durationMs: Date.now() - startTime, status: "success", provider: provider(),
        }).catch(() => {});
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Garbage detector: ${msg}`);
      logAiRun({
        action: "garbage_detector", reportId, userId: "system",
        model: "unknown", promptVersion: GARBAGE_DETECTOR_PROMPT_VERSION,
        durationMs: Date.now() - startTime, status: "error", error: msg, provider: provider(),
      }).catch(() => {});
    }
  }

  // 2. Vision Triage
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
        action: "vision_triage", reportId, userId: "system",
        model, promptVersion: VISION_TRIAGE_PROMPT_VERSION,
        durationMs: Date.now() - startTime, status: "success", provider: provider(),
      }).catch(() => {});
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Vision triage: ${msg}`);
      logAiRun({
        action: "vision_triage", reportId, userId: "system",
        model: "unknown", promptVersion: VISION_TRIAGE_PROMPT_VERSION,
        durationMs: Date.now() - startTime, status: "error", error: msg, provider: provider(),
      }).catch(() => {});
    }
  }

  // 3. Crew Brief
  {
    const startTime = Date.now();
    try {
      const { data, model } = await aiTextJson({
        systemInstruction: CREW_BRIEF_SYSTEM,
        userPrompt: buildCrewBriefUser({
          reportType,
          notes: reportNotes,
          priority: (result.visionTriage?.priority || (reportData.priority as string) || "MEDIUM"),
          status: (reportData.status as string) || "NEW",
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
        action: "crew_brief", reportId, userId: "system",
        model, promptVersion: CREW_BRIEF_PROMPT_VERSION,
        durationMs: Date.now() - startTime, status: "success", provider: provider(),
      }).catch(() => {});
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Crew brief: ${msg}`);
      logAiRun({
        action: "crew_brief", reportId, userId: "system",
        model: "unknown", promptVersion: CREW_BRIEF_PROMPT_VERSION,
        durationMs: Date.now() - startTime, status: "error", error: msg, provider: provider(),
      }).catch(() => {});
    }
  }

  // 4. Duplicates
  {
    const startTime = Date.now();
    try {
      const sourceCreatedAt = new Date(reportData.created_at as string);
      const cutoff = new Date(sourceCreatedAt.getTime() - 168 * 60 * 60 * 1000);
      const { data: recentReports } = await db
        .from("reports")
        .select("id, type, notes, lat, lng, created_at, status")
        .gte("created_at", cutoff.toISOString())
        .order("created_at", { ascending: false })
        .limit(100);

      const candidates = (recentReports || [])
        .filter((d) => d.id !== reportId)
        .filter((d) => d.status !== "REJECTED")
        .filter((d) => {
          return haversineDistance(lat, lng, d.lat as number, d.lng as number) <= 500;
        })
        .map((d) => {
          const created = new Date(d.created_at as string);
          return {
            id: d.id,
            type: d.type as string,
            notes: (d.notes as string) || "",
            distanceMeters: Math.round(haversineDistance(lat, lng, d.lat as number, d.lng as number)),
            ageHoursApart: Math.round(
              (Math.abs(sourceCreatedAt.getTime() - created.getTime()) / 3600_000) * 10,
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
        data.rankedCandidates = data.rankedCandidates.filter((c) => validIds.has(c.reportId));
        result.duplicates = data;
        aiUpdates["duplicates"] = {
          ...data,
          model,
          promptVersion: DUPLICATES_PROMPT_VERSION,
          createdAt: now,
        };
        logAiRun({
          action: "duplicates", reportId, userId: "system",
          model, promptVersion: DUPLICATES_PROMPT_VERSION,
          durationMs: Date.now() - startTime, status: "success", provider: provider(),
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

  const existingAi = (reportData.ai as Record<string, unknown>) || {};
  const hasAnyResult = result.garbageDetector || result.visionTriage || result.crewBrief;
  const finalAi = {
    ...existingAi,
    ...aiUpdates,
    status: hasAnyResult ? "COMPLETE" : "FAILED",
    processedAt: now,
    errors: result.errors.length > 0 ? result.errors : undefined,
  };

  await db.from("reports").update({
    ai: finalAi,
    before_photo_path: storagePath || undefined,
  }).eq("id", reportId);

  return result;
}

// ---------------------------------------------------------------------------
// Completion pipeline
// ---------------------------------------------------------------------------
export interface ProcessCompletionResult {
  resolutionNote: ResolutionNoteResult | null;
  errors: string[];
}

export async function processCompletion(reportId: string): Promise<ProcessCompletionResult> {
  const db = await supabase();

  const { data: reportData, error: fetchErr } = await db
    .from("reports")
    .select("*")
    .eq("id", reportId)
    .single();
  if (fetchErr || !reportData) throw new Error("Report not found");

  const result: ProcessCompletionResult = { resolutionNote: null, errors: [] };
  const startTime = Date.now();
  const now = new Date().toISOString();

  try {
    const aiData = (reportData.ai as Record<string, unknown>) || {};
    const gd = aiData["garbageDetector"] as Record<string, unknown> | undefined;
    const garbageTypes = (gd?.garbageTypes as string[]) || [];

    const { data, model } = await aiTextJson({
      systemInstruction: RESOLUTION_NOTE_SYSTEM,
      userPrompt: buildResolutionNoteUser({
        reportType: (reportData.type as string) || "UNKNOWN",
        notes: (reportData.notes as string) || "",
        completionNotes: (reportData.completion_notes as string) || "",
        status: (reportData.status as string) || "DONE",
        garbageTypes,
        priority: reportData.priority as string | undefined,
      }),
      temperature: 0.3,
      maxOutputTokens: 512,
      validate: (raw) => resolutionNoteResultSchema.safeParse(raw),
    });

    result.resolutionNote = data;

    const existingAi = (reportData.ai as Record<string, unknown>) || {};
    await db.from("reports").update({
      ai: {
        ...existingAi,
        resolutionNote: {
          ...data,
          model,
          promptVersion: RESOLUTION_NOTE_PROMPT_VERSION,
          createdAt: now,
        },
      },
    }).eq("id", reportId);

    logAiRun({
      action: "resolution_note", reportId, userId: "system",
      model, promptVersion: RESOLUTION_NOTE_PROMPT_VERSION,
      durationMs: Date.now() - startTime, status: "success", provider: provider(),
    }).catch(() => {});
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Resolution note: ${msg}`);
    logAiRun({
      action: "resolution_note", reportId, userId: "system",
      model: "unknown", promptVersion: RESOLUTION_NOTE_PROMPT_VERSION,
      durationMs: Date.now() - startTime, status: "error", error: msg, provider: provider(),
    }).catch(() => {});
  }

  return result;
}
