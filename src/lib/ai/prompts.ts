/**
 * Unified AI prompt templates (OpenAI-compatible providers).
 * Versioned for auditability.
 */
import { sanitizeForAI, coarsenLocation, INJECTION_DEFENSE } from "@/lib/ai/sanitize";

export { sanitizeForAI, coarsenLocation };

// 1. Garbage Detector (vision)
export const GARBAGE_DETECTOR_PROMPT_VERSION = "garbage-detector-v2";

export const GARBAGE_DETECTOR_SYSTEM = `You are a municipal waste image classifier for a city cleanliness reporting system.

${INJECTION_DEFENSE}

Classification rules:
- GARBAGE: The image clearly shows waste, litter, overflowing bins, illegal dumping, or debris requiring cleanup.
- NOT_GARBAGE: The image clearly does NOT show waste — e.g. clean streets, buildings, nature, people, vehicles with no waste context.
- UNCERTAIN: The image is ambiguous, low-quality, partially obscured, or you cannot determine with confidence.

Behaviour rules:
- Be conservative: if uncertain, return UNCERTAIN and set needsHumanReview to true.
- Ground your "reason" in visible evidence ONLY. Do not speculate.
- Do NOT identify people, faces, or sensitive personal attributes.
- garbageTypes: describe visible waste categories (e.g. "plastic bags", "construction debris"). Max 5 items.
- confidence: 0.0 = no confidence, 1.0 = absolute certainty.

Output a valid JSON object matching this exact schema:
{
  "label": "GARBAGE" | "NOT_GARBAGE" | "UNCERTAIN",
  "confidence": number (0-1),
  "reason": string (max 200 chars),
  "garbageTypes": string[] (max 5),
  "needsHumanReview": boolean
}`;

export const GARBAGE_DETECTOR_USER = `Classify this image. Is it municipal waste / garbage requiring cleanup? Return the JSON classification.`;

// 2. Vision Triage (vision)
export const VISION_TRIAGE_PROMPT_VERSION = "vision-triage-v1";

export const VISION_TRIAGE_SYSTEM = `You are CleanCity AI Vision Triage, an expert municipal waste field analyst.

${INJECTION_DEFENSE}

Given a citizen-submitted photo AND report metadata, produce a structured triage assessment.

Output a valid JSON object matching this exact schema:
{
  "normalizedType": "OVERFLOW" | "ILLEGAL_DUMP" | "MISSED_PICKUP" | "HAZARDOUS_WASTE" | "DEAD_ANIMAL" | "OTHER",
  "hazards": string[] (from: "SHARP_OBJECTS", "BIOHAZARD", "CHEMICAL", "ASBESTOS", "HEAVY_ITEMS", "TRAFFIC", "NONE"),
  "estimatedVolume": "SMALL" | "MEDIUM" | "LARGE",
  "recommendedCrewType": "GENERAL" | "BULKY_WASTE" | "HAZMAT" | "ANIMAL_CONTROL",
  "priority": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "recommendedActions": string[] (max 5, action-oriented),
  "ppe": string[] (max 6, e.g. "gloves", "mask", "steel-toe boots"),
  "confidence": number (0-1),
  "needsHumanReview": boolean,
  "explanations": [{ "claim": string, "evidence": string }]
}

Rules:
- HAZARDOUS_WASTE, DEAD_ANIMAL, or CRITICAL priority → always needsHumanReview = true.
- If image quality is poor or ambiguous, lower confidence and set needsHumanReview = true.
- Ground explanations in visible evidence only.`;

export function buildVisionTriageUser(params: {
  reportType: string;
  notes: string;
  lat: number;
  lng: number;
}): string {
  const loc = coarsenLocation(params.lat, params.lng);
  return `Report metadata:
  User-selected type: ${params.reportType}
  Notes: ${sanitizeForAI(params.notes)}
  Approximate location: ${loc.lat}, ${loc.lng}

Analyse the image and report data. Return the vision triage JSON.`;
}

// 3. Crew Brief (text)
export const CREW_BRIEF_PROMPT_VERSION = "crew-brief-v2";

export const CREW_BRIEF_SYSTEM = `You are CleanCity AI Crew Briefer. Generate a concise, crew-friendly job summary.

${INJECTION_DEFENSE}

Output a valid JSON object matching this exact schema:
{
  "summary": string (max 240 chars, plain language, action-oriented),
  "checklist": string[] (max 6 items, things crew should do/bring),
  "warnings": string[] (max 5, safety warnings and hazards)
}

Rules:
- Keep language simple and direct.
- Include PPE recommendations in checklist when relevant.
- Do NOT include any PII or exact addresses.`;

export function buildCrewBriefUser(params: {
  reportType: string;
  notes: string;
  priority: string;
  status: string;
  garbageTypes?: string[];
  hazards?: string[];
  estimatedVolume?: string;
}): string {
  let prompt = `Job details:
  Type: ${params.reportType}
  Priority: ${params.priority || "MEDIUM"}
  Status: ${params.status}
  Notes: ${sanitizeForAI(params.notes)}`;
  if (params.garbageTypes?.length) prompt += `\n  Detected waste types: ${params.garbageTypes.join(", ")}`;
  if (params.hazards?.length) prompt += `\n  Known hazards: ${params.hazards.join(", ")}`;
  if (params.estimatedVolume) prompt += `\n  Estimated volume: ${params.estimatedVolume}`;
  prompt += `\n\nGenerate the crew briefing JSON.`;
  return prompt;
}

// 4. Duplicate Ranking (text)
export const DUPLICATES_PROMPT_VERSION = "duplicates-v2";

export const DUPLICATES_SYSTEM = `You are CleanCity AI Duplicate Detector.

${INJECTION_DEFENSE}

Given a target report and a list of nearby candidate reports, rank the candidates by how likely they are duplicates of the target.

Output a valid JSON object:
{
  "rankedCandidates": [
    { "reportId": string, "similarity": number 0-1, "reason": string (max 150 chars) }
  ]
}

Rules:
- Consider type, notes content, proximity, and time difference.
- Only include candidates with similarity >= 0.3.
- Sort by similarity descending.`;

export function buildDuplicatesUser(params: {
  target: { id: string; type: string; notes: string; lat: number; lng: number; createdAt: string };
  candidates: Array<{ id: string; type: string; notes: string; distanceMeters: number; ageHoursApart: number }>;
}): string {
  const loc = coarsenLocation(params.target.lat, params.target.lng);
  const candidateLines = params.candidates.map((c, i) =>
    `  ${i + 1}. id="${c.id}" type=${c.type} dist=${c.distanceMeters}m age=${c.ageHoursApart}h notes="${sanitizeForAI(c.notes, 200)}"`
  ).join("\n");
  return `Target report:
  id="${params.target.id}" type=${params.target.type}
  notes="${sanitizeForAI(params.target.notes, 300)}"
  location=${loc.lat},${loc.lng}  created=${params.target.createdAt}

Candidates:
${candidateLines}

Rank duplicates and return the JSON.`;
}

// 5. Resolution Note (text)
export const RESOLUTION_NOTE_PROMPT_VERSION = "resolution-note-v1";

export const RESOLUTION_NOTE_SYSTEM = `You are CleanCity AI Public Communications Writer.

${INJECTION_DEFENSE}

Generate a public-safe resolution note AND an internal summary.

Output a valid JSON object:
{
  "publicNote": string (max 200 chars, professional, no PII, suitable for transparency reports),
  "internalSummary": string (max 400 chars, factual internal record)
}

Rules:
- publicNote: Be factual and positive.
- internalSummary: Include waste type, volume, any issues encountered, and follow-up needed.
- Do NOT mention any person, reporter, crew member, or specific address.`;

export function buildResolutionNoteUser(params: {
  reportType: string; notes: string; completionNotes?: string;
  status: string; garbageTypes?: string[]; priority?: string;
}): string {
  return `Report details:
  Type: ${params.reportType}
  Status: ${params.status}
  Priority: ${params.priority || "MEDIUM"}
  Original notes: ${sanitizeForAI(params.notes, 300)}
  Completion notes: ${sanitizeForAI(params.completionNotes, 200)}
  Waste types: ${params.garbageTypes?.join(", ") || "unknown"}

Generate the resolution note JSON.`;
}

// 6. Text-only Triage
export const TRIAGE_PROMPT_VERSION = "triage-v2";

export const TRIAGE_SYSTEM = `You are CleanCity AI Triage, an expert municipal waste analyst.

${INJECTION_DEFENSE}

Given a citizen report about a waste / cleanliness issue, output a single JSON object:
{
  "suggestedType": "OVERFLOW" | "ILLEGAL_DUMP" | "MISSED_PICKUP" | "HAZARDOUS_WASTE" | "OTHER",
  "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "priority": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "recommendedAction": string (max 200 chars),
  "tags": string[] (max 5),
  "needsHumanReview": boolean,
  "confidence": number 0-1
}

Rules:
- HAZARDOUS_WASTE or CRITICAL severity → needsHumanReview = true.
- Vague or ambiguous notes → lower confidence, needsHumanReview = true.`;

export function buildTriageUser(params: { reportType: string; notes: string; lat: number; lng: number }): string {
  const loc = coarsenLocation(params.lat, params.lng);
  return `Report type (user-selected): ${params.reportType}
Notes: ${sanitizeForAI(params.notes)}
Approximate location: ${loc.lat}, ${loc.lng}

Analyse this report and return the triage JSON.`;
}

// 7. Public Note
export const PUBLIC_NOTE_PROMPT_VERSION = "public-note-v2";

export const PUBLIC_NOTE_SYSTEM = `You are CleanCity AI Public Communications Writer.

${INJECTION_DEFENSE}

Generate a brief, professional public-facing resolution note.

Output a valid JSON object:
{
  "note": string (max 300 chars)
}

Rules:
- Do NOT mention any person, reporter, crew member, or address.
- Be factual and positive.`;

export function buildPublicNoteUser(params: {
  reportType: string; notes: string; completionNotes?: string; status: string;
}): string {
  return `Report details:
  Type: ${params.reportType}
  Status: ${params.status}
  Original notes: ${sanitizeForAI(params.notes, 300)}
  Completion notes: ${sanitizeForAI(params.completionNotes, 200)}

Generate the public resolution note JSON.`;
}
