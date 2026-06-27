/**
 * Supabase Storage helpers.
 */
import { getSupabaseRoute } from "@/lib/supabase/server";

const BUCKET = "report-photos";

/**
 * Upload a file buffer to Supabase Storage.
 * Returns the public URL.
 */
export async function uploadFile(
  path: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const supabase = await getSupabaseRoute();

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType,
      upsert: true,
    });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
