import { NextResponse } from "next/server";
import { identifyFood } from "@/lib/claude";
import { hasClaude } from "@/lib/env";
import { bad, errorMessage, readImage } from "@/lib/http";
import { requireUser } from "@/lib/supabase/server";

export const maxDuration = 60;

export async function POST(req: Request) {
  if (!(await requireUser())) return bad("Not signed in", 401);
  if (!hasClaude()) return bad("Food recognition needs ANTHROPIC_API_KEY to be set in Vercel.", 503);

  const body = await req.json().catch(() => null);
  const image = body?.image ? readImage(body.image) : undefined;
  if (body?.image && !image) return bad("Unsupported image. Please use a JPEG or PNG photo.");
  const text = typeof body?.text === "string" ? body.text.slice(0, 2000) : undefined;
  if (!image && !text?.trim()) return bad("Add a photo or describe what you ate.");

  try {
    return NextResponse.json(await identifyFood({ image: image ?? undefined, text }));
  } catch (e) {
    console.error(e);
    return bad(errorMessage(e), 502);
  }
}
