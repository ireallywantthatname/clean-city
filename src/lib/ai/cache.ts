/**
 * Image cache utilities — server-side only.
 * Cache AI results by image sha256 hash in Supabase `ai_image_cache`.
 */
import { createHash } from "crypto";
import { getSupabaseRoute } from "@/lib/supabase/server";

/**
 * Download file bytes from Supabase Storage by object path.
 */
export async function downloadImage(
  storagePath: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  const supabase = await getSupabaseRoute();

  const { data, error } = await supabase.storage
    .from("report-photos")
    .download(storagePath);

  if (error || !data) throw new Error(`Storage file not found: ${storagePath}`);

  const buffer = Buffer.from(await data.arrayBuffer());
  const mimeType = data.type || "image/jpeg";
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
  const url = data.beforePhotoUrl as string;
  if (url) {
    const match = url.match(/reports%2F[^?&]+/);
    if (match) return decodeURIComponent(match[0]);
    const match2 = url.match(/reports\/[^?&]+/);
    if (match2) return match2[0];
  }
  return `reports/${reportId}/before.jpg`;
}

export async function getCachedResult(
  imageHash: string,
): Promise<Record<string, unknown> | null> {
  const supabase = await getSupabaseRoute();
  const { data } = await supabase
    .from("ai_image_cache")
    .select("*")
    .eq("image_hash", imageHash)
    .single();
  return data || null;
}

export async function setCachedResult(
  imageHash: string,
  data: Record<string, unknown>,
): Promise<void> {
  const supabase = await getSupabaseRoute();
  const provider =
    (typeof data.provider === "string" && data.provider) ||
    process.env.AI_PROVIDER?.trim() ||
    "openai";
  await supabase.from("ai_image_cache").upsert(
    {
      image_hash: imageHash,
      ...data,
      provider,
      created_at: new Date().toISOString(),
    },
    { onConflict: "image_hash" },
  );
}
