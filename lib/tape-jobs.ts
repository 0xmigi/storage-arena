// In-memory store for long-running Tapedrive writes. The upload request
// spawns the CLI in the background and returns a jobId; the client polls
// /api/upload/status. (Single-process / local-dev store; production would
// move this to the DB or a queue.)

export interface TapeJob {
  jobId: string;
  status: "running" | "done" | "failed";
  bytes: number;
  segments: number | null;
  projectedMs: number;
  startedAt: number;
  ms?: number;
  tapeAddr?: string | null;
  error?: string;
}

// Pinned on globalThis so the upload route and the status route share ONE
// instance (Next.js bundles each route separately, duplicating module state).
const g = globalThis as unknown as { __tapeJobs?: Map<string, TapeJob> };
const jobs: Map<string, TapeJob> = g.__tapeJobs ?? (g.__tapeJobs = new Map());

export function createJob(j: TapeJob) {
  jobs.set(j.jobId, j);
}
export function getJob(id: string): TapeJob | undefined {
  return jobs.get(id);
}
export function updateJob(id: string, patch: Partial<TapeJob>) {
  const j = jobs.get(id);
  if (j) jobs.set(id, { ...j, ...patch });
}
