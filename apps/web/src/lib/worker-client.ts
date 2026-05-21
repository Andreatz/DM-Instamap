export type WorkerJobRecord = {
  createdAt: string;
  error?: string | null;
  id: string;
  message: string;
  progress: number;
  result?: Record<string, unknown> | null;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  type: string;
  updatedAt: string;
};

export function getWorkerBaseUrl(): string {
  const url = process.env.DM_INSTAMAP_WORKER_URL ?? "http://127.0.0.1:8000";
  return url.replace(/\/$/u, "");
}

export async function fetchWorkerJob(jobId: string): Promise<WorkerJobRecord> {
  const response = await fetch(`${getWorkerBaseUrl()}/jobs/${encodeURIComponent(jobId)}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Worker returned ${response.status} for job ${jobId}.`);
  }

  return (await response.json()) as WorkerJobRecord;
}

export async function postWorkerJob(path: string, payload: unknown): Promise<WorkerJobRecord> {
  const response = await fetch(`${getWorkerBaseUrl()}${path}`, {
    body: JSON.stringify(payload),
    cache: "no-store",
    headers: { "content-type": "application/json" },
    method: "POST"
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Worker returned ${response.status}: ${text || response.statusText}`);
  }

  return (await response.json()) as WorkerJobRecord;
}
