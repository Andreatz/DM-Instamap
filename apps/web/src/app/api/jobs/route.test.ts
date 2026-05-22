import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/worker-client", () => ({
  fetchWorkerJobs: vi.fn()
}));

import { GET } from "./route";
import { fetchWorkerJobs } from "@/lib/worker-client";

const fetchWorkerJobsMock = fetchWorkerJobs as unknown as ReturnType<typeof vi.fn>;

describe("GET /api/jobs", () => {
  beforeEach(() => {
    fetchWorkerJobsMock.mockReset();
  });

  it("returns worker jobs", async () => {
    fetchWorkerJobsMock.mockResolvedValue([
      {
        createdAt: "2026-05-22T00:00:00.000Z",
        id: "job_1",
        message: "Queued.",
        progress: 0,
        status: "queued",
        type: "assets.scan",
        updatedAt: "2026-05-22T00:00:00.000Z"
      }
    ]);

    const response = await GET();

    expect(response.status).toBe(200);
    const body = (await response.json()) as { jobs: Array<{ id: string }>; ok: boolean };
    expect(body.ok).toBe(true);
    expect(body.jobs[0]?.id).toBe("job_1");
  });

  it("returns 502 when the worker is unreachable", async () => {
    fetchWorkerJobsMock.mockRejectedValue(new Error("ECONNREFUSED"));

    const response = await GET();

    expect(response.status).toBe(502);
    const body = (await response.json()) as { error: string; ok: boolean };
    expect(body.ok).toBe(false);
    expect(body.error).toContain("ECONNREFUSED");
  });
});
