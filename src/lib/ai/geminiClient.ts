/**
 * Unified Gemini AI client — server-side only.
 *
 * Supports text-only and multimodal (text + image) prompts.
 * All AI calls route through this single module.
 */
import { GoogleGenerativeAI, type Part } from "@google/generative-ai";

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  return key;
}

export function getTextModel(): string {
  return process.env.GEMINI_MODEL_TEXT || "gemini-1.5-flash";
}

export function getVisionModel(): string {
  return process.env.GEMINI_MODEL_VISION || "gemini-1.5-flash";
}

export function isAiEnabled(): boolean {
  return process.env.AI_ENABLED !== "false";
}

export function isAutomationOn(): boolean {
  return process.env.AI_AUTOMATION_MODE !== "off";
}

function getTimeoutMs(): number {
  return parseInt(process.env.AI_TIMEOUT_MS || "8000", 10) || 8000;
}

function getMaxRetries(): number {
  return parseInt(process.env.AI_MAX_RETRIES || "1", 10) || 1;
}

let _client: GoogleGenerativeAI | null = null;
function getClient(): GoogleGenerativeAI {
  if (!_client) _client = new GoogleGenerativeAI(getApiKey());
  return _client;
}

export class GeminiQuotaError extends Error {
  retryAfterSeconds: number | null;
  constructor(message: string, retryAfter: number | null = null) {
    super(message);
    this.name = "GeminiQuotaError";
    this.retryAfterSeconds = retryAfter;
  }
}

export class AiDisabledError extends Error {
  constructor() {
    super("AI features are currently disabled");
    this.name = "AiDisabledError";
  }
}

function handleGeminiError(err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("429") || msg.includes("Too Many Requests") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED")) {
    let retryAfter: number | null = null;
    const retryMatch = msg.match(/retry in ([\d.]+)/i);
    if (retryMatch) retryAfter = Math.ceil(parseFloat(retryMatch[1]));
    throw new GeminiQuotaError(
      retryAfter ? `Gemini rate limit reached. Retry in ~${retryAfter}s.` : "Gemini rate limit reached.",
      retryAfter,
    );
  }
  const clean = msg.length > 200 ? msg.slice(0, 200) + "…" : msg;
  throw new Error(`Gemini API error: ${clean}`);
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then((v) => { clearTimeout(timer); resolve(v); }, (e) => { clearTimeout(timer); reject(e); });
  });
}

export interface GeminiTextOptions {
  systemInstruction: string;
  userPrompt: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface GeminiVisionOptions extends GeminiTextOptions {
  imageBase64: string;
  imageMimeType: string;
}

export interface GeminiResult {
  content: string;
  model: string;
}

export async function geminiText(opts: GeminiTextOptions): Promise<GeminiResult> {
  if (!isAiEnabled()) throw new AiDisabledError();
  const client = getClient();
  const modelName = getTextModel();
  const model = client.getGenerativeModel({
    model: modelName,
    systemInstruction: opts.systemInstruction,
    generationConfig: {
      temperature: opts.temperature ?? 0.2,
      maxOutputTokens: opts.maxOutputTokens ?? 1024,
      responseMimeType: "application/json",
    },
  });
  const textPart: Part = { text: opts.userPrompt };
  try {
    const result = await withTimeout(model.generateContent([textPart]), getTimeoutMs(), "geminiText");
    return { content: result.response.text(), model: modelName };
  } catch (err) { handleGeminiError(err); }
}

export async function geminiVision(opts: GeminiVisionOptions): Promise<GeminiResult> {
  if (!isAiEnabled()) throw new AiDisabledError();
  const client = getClient();
  const modelName = getVisionModel();
  const model = client.getGenerativeModel({
    model: modelName,
    systemInstruction: opts.systemInstruction,
    generationConfig: {
      temperature: opts.temperature ?? 0.2,
      maxOutputTokens: opts.maxOutputTokens ?? 1024,
      responseMimeType: "application/json",
    },
  });
  const imagePart: Part = { inlineData: { mimeType: opts.imageMimeType, data: opts.imageBase64 } };
  const textPart: Part = { text: opts.userPrompt };
  try {
    const result = await withTimeout(model.generateContent([textPart, imagePart]), getTimeoutMs(), "geminiVision");
    return { content: result.response.text(), model: modelName };
  } catch (err) { handleGeminiError(err); }
}

export async function geminiTextJson<T>(
  opts: GeminiTextOptions & {
    validate: (raw: unknown) => { success: true; data: T } | { success: false; error: unknown };
  },
): Promise<{ data: T; model: string }> {
  return jsonWithRetry(() => geminiText(opts), opts);
}

export async function geminiVisionJson<T>(
  opts: GeminiVisionOptions & {
    validate: (raw: unknown) => { success: true; data: T } | { success: false; error: unknown };
  },
): Promise<{ data: T; model: string }> {
  return jsonWithRetry(() => geminiVision(opts), opts);
}

async function jsonWithRetry<T>(
  call: () => Promise<GeminiResult>,
  opts: {
    validate: (raw: unknown) => { success: true; data: T } | { success: false; error: unknown };
    userPrompt: string;
    systemInstruction: string;
  },
): Promise<{ data: T; model: string }> {
  let lastResult: GeminiResult | null = null;
  const maxRetries = getMaxRetries();
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await call();
    lastResult = result;
    let parsed: unknown;
    try { parsed = JSON.parse(result.content); } catch {
      if (attempt < maxRetries) continue;
      throw new Error("Gemini returned invalid JSON after retries");
    }
    const validation = opts.validate(parsed);
    if (validation.success) return { data: validation.data, model: result.model };
    if (attempt >= maxRetries) {
      throw new Error(
        `Gemini response failed schema validation: ${JSON.stringify(validation.error).slice(0, 500)}`,
      );
    }
  }
  throw new Error("Gemini returned invalid JSON after retries");
}
