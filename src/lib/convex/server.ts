import { ConvexHttpClient } from "convex/browser";

export function getConvexClient(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_CONVEX_URL environment variable");
  }
  return new ConvexHttpClient(url);
}
