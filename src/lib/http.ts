import { NextResponse } from "next/server";
import type { ImageInput } from "@/lib/claude";

export const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

const TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

/** Validate a { data, mediaType } image sent by the browser (base64, already resized). */
export function readImage(v: unknown): ImageInput | null {
  const img = v as { data?: unknown; mediaType?: unknown } | null;
  if (!img || typeof img.data !== "string" || typeof img.mediaType !== "string") return null;
  if (!(TYPES as readonly string[]).includes(img.mediaType)) return null;
  if (img.data.length > 6_000_000) return null;
  return { data: img.data.replace(/^data:[^,]+,/, ""), mediaType: img.mediaType as ImageInput["mediaType"] };
}

export function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : "Something went wrong";
}
