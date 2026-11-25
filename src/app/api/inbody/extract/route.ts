import { NextResponse } from "next/server";
import { extractInBody } from "@/lib/claude";
import { hasClaude } from "@/lib/env";
import { bad, errorMessage, readImage } from "@/lib/http";
import { requireUser } from "@/lib/supabase/server";

export const maxDuration = 60;

export async function POST(req: Request) {
  if (!(await requireUser())) return bad("Not signed in", 401);
  if (!hasClaude()) return bad("Reading InBody photos needs ANTHROPIC_API_KEY to be set in Vercel.", 503);
  const body = await req.json().catch(() => null);
  const images = Array.isArray(body?.images) ? body.images.slice(0, 4).map(readImage) : [];
  if (!images.length || images.some((i: unknown) => !i)) return bad("Add one or more JPEG/PNG photos of your InBody sheet.");
  try {
    return NextResponse.json(await extractInBody(images));
  } catch (e) {
    console.error(e);
    return bad(errorMessage(e), 502);
  }
}
