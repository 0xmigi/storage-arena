import { NextRequest, NextResponse } from "next/server";
import { recordRequest } from "@/lib/run-store";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const name = String(body?.name ?? "").trim().slice(0, 80);
  const note = body?.note ? String(body.note).trim().slice(0, 300) : undefined;
  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  await recordRequest(name, note);
  return NextResponse.json({ ok: true });
}
