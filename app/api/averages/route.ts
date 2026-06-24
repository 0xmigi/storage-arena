import { NextResponse } from "next/server";
import { getAverages } from "@/lib/run-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const averages = await getAverages();
  return NextResponse.json({ averages });
}
