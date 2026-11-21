import { createHash } from "crypto";
import { api } from "../../../convex/_generated/api";
import { getConvexClient } from "@/lib/convex/server";

export async function downloadImage(
  photoUrl: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  if (!photoUrl) {
    throw new Error("Photo URL is empty");
  }
  const res = await fetch(photoUrl);
  if (!res.ok) {
    throw new Error(`Storage file download failed: ${res.status}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const mimeType = res.headers.get("content-type") || "image/jpeg";
  return { buffer, mimeType };
}

export function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function resolvePhotoPath(
  reportId: string,
  data: Record<string, unknown>,
): string {
  if (data.beforePhotoPath) return data.beforePhotoPath as string;
  if (data.before_photo_path) return data.before_photo_path as string;
  return `reports/${reportId}/before.jpg`;
}

export async function getCachedResult(
  imageHash: string,
): Promise<Record<string, unknown> | null> {
  const convex = getConvexClient();
  const data = await convex.query(api.ai.getCache, { imageHash });
  return data ? (data as Record<string, unknown>) : null;
}

export async function setCachedResult(
  imageHash: string,
  data: Record<string, unknown>,
): Promise<void> {
  const convex = getConvexClient();
  const provider =
    (typeof data.provider === "string" && data.provider) ||
    process.env.AI_PROVIDER?.trim() ||
    "openai";
  const label = data.label as "GARBAGE" | "NOT_GARBAGE" | "UNCERTAIN" | undefined;

  await convex.mutation(api.ai.setCache, {
    imageHash,
    label,
    confidence:
      typeof data.confidence === "number" ? data.confidence : undefined,
    reason: typeof data.reason === "string" ? data.reason : undefined,
    garbageTypes: Array.isArray(data.garbage_types)
      ? (data.garbage_types as string[])
      : undefined,
    needsHumanReview:
      typeof data.needs_human_review === "boolean"
        ? data.needs_human_review
        : undefined,
    model: typeof data.model === "string" ? data.model : undefined,
    promptVersion:
      typeof data.prompt_version === "string"
        ? data.prompt_version
        : undefined,
    provider,
    createdAt: new Date().toISOString(),
  });
}
