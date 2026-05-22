import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/worker-client", () => ({
  fetchWorkerJob: vi.fn()
}));

import { GET } from "./route";
import { fetchWorkerJob } from "@/lib/worker-client";

const fetchWorkerJobMock = fetchWorkerJob as unknown as ReturnType<
  typeof vi.fn
>;

function context(jobId: string) {
  return { params: Promise.resolve({ jobId }) };
}

describe("GET /api/jobs/[jobId]", () => {
  beforeEach(() => {
    fetchWorkerJobMock.mockReset();
  });

  it("returns the job payload from the worker", async () => {
    fetchWorkerJobMock.mockResolvedValue({
      id: "job_1",
      type: "assets.scan",
      status: "running",
      progress: 42,
      message: "Scanning",
      createdAt: "2026-05-21T00:00:00.000Z",
      updatedAt: "2026-05-21T00:00:05.000Z"
    });

    const response = await GET(
      new Request("http://test/api/jobs/job_1"),
      context("job_1")
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      ok: boolean;
      job: { id: string; progress: number; status: string };
    };
    expect(body.ok).toBe(true);
    expect(body.job.id).toBe("job_1");
    expect(body.job.progress).toBe(42);
    expect(fetchWorkerJobMock).toHaveBeenCalledWith("job_1");
  });

  it("returns 502 when the worker is unreachable", async () => {
    fetchWorkerJobMock.mockRejectedValue(
      new Error("ECONNREFUSED 127.0.0.1:8000")
    );

    const response = await GET(
      new Request("http://test/api/jobs/job_1"),
      context("job_1")
    );

    expect(response.status).toBe(502);
    const body = (await response.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/ECONNREFUSED/);
  });
});
