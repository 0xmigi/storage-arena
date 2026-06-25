import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/tape-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId");
  const job = jobId ? getJob(jobId) : undefined;
  if (!job) {
    return NextResponse.json({ status: "unknown" }, { status: 404 });
  }
  return NextResponse.json({
    status: job.status,
    ms: job.ms ?? null,
    segments: job.segments,
    blobId: job.tapeAddr ?? null,
    blobUrl: job.tapeAddr ? `/api/blob/tapedrive/${job.tapeAddr}` : null,
    error: job.error ?? null,
  });
}
