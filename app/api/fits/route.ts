import { NextResponse } from "next/server";
import { getFits } from "@/lib/run-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Per-network linear fit (ms vs bytes) over all real recorded runs — the
// simulation extrapolates from these to whatever size the slider is set to.
export async function GET() {
  const fits = await getFits();
  return NextResponse.json({ fits });
}
