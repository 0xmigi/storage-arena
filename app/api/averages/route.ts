import { NextRequest, NextResponse } from "next/server";
import { getAverages } from "@/lib/run-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const b = req.nextUrl.searchParams.get("bytes");
  const nearBytes = b ? Number(b) : undefined;
  const averages = await getAverages(
    nearBytes && Number.isFinite(nearBytes) ? nearBytes : undefined
  );
  return NextResponse.json({ averages });
}
