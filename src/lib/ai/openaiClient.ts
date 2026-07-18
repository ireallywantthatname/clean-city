/**
 * OpenAI-compatible AI client — server-side only.
 *
 * Works with DeepSeek, OpenAI, and any /chat/completions-compatible API.
 * Defaults target DeepSeek V4 Pro (vision-capable):
 *   https://api-docs.deepseek.com/quick_start/pricing/
 *
 * Env:
 *   OPENAI_API_KEY or DEEPSEEK_API_KEY
 *   OPENAI_BASE_URL  (default https://api.deepseek.com)
 *   OPENAI_MODEL / OPENAI_VISION_MODEL  (default deepseek-v4-pro)
 */
import OpenAI from "openai";

/** DeepSeek V4 Pro — text + vision, OpenAI-compatible chat completions. */
const DEFAULT_MODEL = "deepseek-v4-pro";

function getApiKey(): string {
  const key =
    process.env.OPENAI_API_KEY?.trim() ||
    process.env.DEEPSEEK_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "OPENAI_API_KEY or DEEPSEEK_API_KEY is not set",
    );
  }
  return key;
}

function getBaseUrl(): string {
  return (
    process.env.OPENAI_BASE_URL?.trim() ||
    process.env.DEEPSEEK_BASE_URL?.trim() ||
    "https://api.deepseek.com"
  );
}

export function getTextModel(): string {
  return (
    process.env.OPENAI_MODEL?.trim() ||
    process.env.OPENAI_MODEL_TEXT?.trim() ||
    process.env.DEEPSEEK_MODEL?.trim() ||
    DEFAULT_MODEL
  );
}

export function getVisionModel(): string {
  return (
    process.env.OPENAI_VISION_MODEL?.trim() ||
    process.env.OPENAI_MODEL_VISION?.trim() ||
    getTextModel()
  );
}

/** Provider label stored in ai_runs / cache (not a hard-coded vendor). */
export function getAiProvider(): string {
  return process.env.AI_PROVIDER?.trim() || "deepseek";
}

/**
 * DeepSeek V4 thinking is enabled by default; disable it for structured JSON
 * so temperature applies and latency/cost stay predictable.
 * @see https://api-docs.deepseek.com/guides/thinking_mode
 */
function deepseekJsonExtras(): Record<string, unknown> {
  const base = getBaseUrl().toLowerCase();
  if (!base.includes("deepseek")) return {};
  return { thinking: { type: "disabled" } };
}

export function isAutomationOn(): boolean {
  return process.env.AI_AUTOMATION_MODE !== "off";
}

function getTimeoutMs(): number {
  return parseInt(process.env.AI_TIMEOUT_MS || "30000", 10) || 30000;
}

function getMaxRetries(): number {
  return parseInt(process.env.AI_MAX_RETRIES || "1", 10) || 1;
}

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: getApiKey(),
      baseURL: getBaseUrl(),
    });
  }
  return _client;
}

export class AiQuotaError extends Error {
  retryAfterSeconds: number | null;
  constructor(message: string, retryAfter: number | null = null) {
    super(message);
    this.name = "AiQuotaError";
    this.retryAfterSeconds = retryAfter;
  }
}

function handleApiError(err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg.includes("429") ||
    msg.includes("Too Many Requests") ||
    msg.includes("rate_limit") ||
    msg.includes("quota")
  ) {
    let retryAfter: number | null = null;
    const retryMatch = msg.match(/retry in ([\d.]+)/i);
    if (retryMatch) retryAfter = Math.ceil(parseFloat(retryMatch[1]));
    throw new AiQuotaError(
      retryAfter
        ? `AI rate limit reached. Retry in ~${retryAfter}s.`
        : "AI rate limit reached.",
      retryAfter,
    );
  }
  const clean = msg.length > 200 ? msg.slice(0, 200) + "…" : msg;
  throw new Error(`AI API error: ${clean}`);
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

export interface AiTextOptions {
  systemInstruction: string;
  userPrompt: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface AiVisionOptions extends AiTextOptions {
  imageBase64: string;
  imageMimeType: string;
}

export interface AiResult {
  content: string;
  model: string;
}

function extractContent(completion: OpenAI.Chat.Completions.ChatCompletion): string {
  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("AI returned empty content");
  return content;
}

export async function aiText(opts: AiTextOptions): Promise<AiResult> {
  const client = getClient();
  const modelName = getTextModel();
  try {
    const completion = await withTimeout(
      client.chat.completions.create({
        model: modelName,
        temperature: opts.temperature ?? 0.2,
        max_tokens: opts.maxOutputTokens ?? 1024,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: opts.systemInstruction },
          { role: "user", content: opts.userPrompt },
        ],
        ...deepseekJsonExtras(),
      } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming),
      getTimeoutMs(),
      "aiText",
    );
    return { content: extractContent(completion), model: modelName };
  } catch (err) {
    handleApiError(err);
  }
}

/**
 * Multimodal call (image + text). Uses OPENAI_VISION_MODEL / OPENAI_MODEL
 * (default deepseek-v4-pro). Falls back to text-only if the provider rejects images.
 */
export async function aiVision(opts: AiVisionOptions): Promise<AiResult> {
  const client = getClient();
  const modelName = getVisionModel();
  const dataUrl = `data:${opts.imageMimeType};base64,${opts.imageBase64}`;

  try {
    const completion = await withTimeout(
      client.chat.completions.create({
        model: modelName,
        temperature: opts.temperature ?? 0.2,
        max_tokens: opts.maxOutputTokens ?? 1024,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: opts.systemInstruction },
          {
            role: "user",
            content: [
              { type: "text", text: opts.userPrompt },
              {
                type: "image_url",
                image_url: { url: dataUrl },
              },
            ],
          },
        ],
        ...deepseekJsonExtras(),
      } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming),
      getTimeoutMs(),
      "aiVision",
    );
    return { content: extractContent(completion), model: modelName };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const visionUnsupported =
      /image|vision|multimodal|unsupported|invalid.*content|unknown.*type/i.test(
        msg,
      );

    if (!visionUnsupported) handleApiError(err);

    // Text-only fallback for providers without vision
    try {
      const fallbackPrompt = `${opts.userPrompt}

[Note: No image analysis is available on this model. Infer the best JSON result from any report metadata in the prompt. If evidence is insufficient, use UNCERTAIN / lower confidence and set needsHumanReview to true.]`;
      const completion = await withTimeout(
        client.chat.completions.create({
          model: getTextModel(),
          temperature: opts.temperature ?? 0.2,
          max_tokens: opts.maxOutputTokens ?? 1024,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: opts.systemInstruction },
            { role: "user", content: fallbackPrompt },
          ],
          ...deepseekJsonExtras(),
        } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming),
        getTimeoutMs(),
        "aiVisionFallback",
      );
      return { content: extractContent(completion), model: getTextModel() };
    } catch (fallbackErr) {
      handleApiError(fallbackErr);
    }
  }
}

export async function aiTextJson<T>(
  opts: AiTextOptions & {
    validate: (raw: unknown) => { success: true; data: T } | { success: false; error: unknown };
  },
): Promise<{ data: T; model: string }> {
  return jsonWithRetry(() => aiText(opts), opts);
}

export async function aiVisionJson<T>(
  opts: AiVisionOptions & {
    validate: (raw: unknown) => { success: true; data: T } | { success: false; error: unknown };
  },
): Promise<{ data: T; model: string }> {
  return jsonWithRetry(() => aiVision(opts), opts);
}

async function jsonWithRetry<T>(
  call: () => Promise<AiResult>,
  opts: {
    validate: (raw: unknown) => { success: true; data: T } | { success: false; error: unknown };
  },
): Promise<{ data: T; model: string }> {
  const maxRetries = getMaxRetries();
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await call();
    let parsed: unknown;
    try {
      parsed = JSON.parse(result.content);
    } catch {
      if (attempt < maxRetries) continue;
      throw new Error("AI returned invalid JSON after retries");
    }
    const validation = opts.validate(parsed);
    if (validation.success) return { data: validation.data, model: result.model };
    if (attempt >= maxRetries) {
      throw new Error(
        `AI response failed schema validation: ${JSON.stringify(validation.error).slice(0, 500)}`,
      );
    }
  }
  throw new Error("AI returned invalid JSON after retries");
}

// Back-compat aliases used during migration (same as primary names)
export const openaiText = aiText;
export const openaiVision = aiVision;
export const openaiTextJson = aiTextJson;
export const openaiVisionJson = aiVisionJson;
