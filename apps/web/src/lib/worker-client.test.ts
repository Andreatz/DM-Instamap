import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchWorkerJob, fetchWorkerJobs, getWorkerBaseUrl, postWorkerJob } from "./worker-client";

describe("worker-client", () => {
  const originalEnv = process.env.DM_INSTAMAP_WORKER_URL;

  afterEach(() => {
    process.env.DM_INSTAMAP_WORKER_URL = originalEnv;
    vi.restoreAllMocks();
  });

  it("falls back to the default worker URL when env is missing", () => {
    delete process.env.DM_INSTAMAP_WORKER_URL;
    expect(getWorkerBaseUrl()).toBe("http://127.0.0.1:8000");
  });

  it("strips trailing slash from the env URL", () => {
    process.env.DM_INSTAMAP_WORKER_URL = "https://worker.example.com/";
    expect(getWorkerBaseUrl()).toBe("https://worker.example.com");
  });

  it("fetches a job from the worker", async () => {
    process.env.DM_INSTAMAP_WORKER_URL = "https://worker.test";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "job_1",
          type: "assets.scan",
          status: "completed",
          progress: 100,
          message: "ok",
          createdAt: "2026-05-21T00:00:00.000Z",
          updatedAt: "2026-05-21T00:00:10.000Z"
        }),
        { status: 200 }
      )
    );

    const job = await fetchWorkerJob("job_1");

    expect(fetchSpy).toHaveBeenCalledWith("https://worker.test/jobs/job_1", expect.any(Object));
    expect(job.status).toBe("completed");
    expect(job.progress).toBe(100);
  });

  it("lists jobs from the worker", async () => {
    process.env.DM_INSTAMAP_WORKER_URL = "https://worker.test";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: "job_1",
            type: "assets.scan",
            status: "queued",
            progress: 0,
            message: "queued",
            createdAt: "2026-05-21T00:00:00.000Z",
            updatedAt: "2026-05-21T00:00:00.000Z"
          }
        ]),
        { status: 200 }
      )
    );

    const jobs = await fetchWorkerJobs();

    expect(fetchSpy).toHaveBeenCalledWith("https://worker.test/jobs", expect.any(Object));
    expect(jobs[0]?.id).toBe("job_1");
  });

  it("posts a job and surfaces non-2xx errors", async () => {
    process.env.DM_INSTAMAP_WORKER_URL = "https://worker.test";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 500 }));

    await expect(postWorkerJob("/jobs/foo", { x: 1 })).rejects.toThrow(/500.*nope/);
  });
});
