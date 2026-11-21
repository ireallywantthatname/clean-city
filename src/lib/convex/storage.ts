import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { getConvexClient } from "@/lib/convex/server";

export async function uploadFileToConvex(
  buffer: Buffer,
  contentType: string,
): Promise<{ storageId: Id<"_storage">; url: string }> {
  const convex = getConvexClient();
  const uploadUrl = await convex.mutation(api.files.generateUploadUrl, {});

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": contentType || "image/jpeg" },
    body: new Uint8Array(buffer),
  });

  if (!response.ok) {
    throw new Error(`Storage upload failed with status ${response.status}`);
  }

  const json = (await response.json()) as { storageId: Id<"_storage"> };
  const url =
    (await convex.query(api.files.getUrl, { storageId: json.storageId })) ?? "";

  return { storageId: json.storageId, url };
}
