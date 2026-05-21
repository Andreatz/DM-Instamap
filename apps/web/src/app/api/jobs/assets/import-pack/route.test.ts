import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/worker-client", () => ({
  postWorkerJob: vi.fn()
}));

import { POST } from "./route";
import { postWorkerJob } from "@/lib/worker-client";

const postWorkerJobMock = postWorkerJob as unknown as ReturnType<typeof vi.fn>;

describe("POST /api/jobs/assets/import-pack", () => {
  beforeEach(() => {
    postWorkerJobMock.mockReset();
  });

  it("returns 400 when root is missing", async () => {
    const response = await POST(
      new Request("http://test/api/jobs/assets/import-pack", {
        body: JSON.stringify({ preset: "generic" }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      })
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/root/);
    expect(postWorkerJobMock).not.toHaveBeenCalled();
  });

  it("proxies the request to the worker with sanitized defaults", async () => {
    postWorkerJobMock.mockResolvedValue({
      id: "job_1",
      type: "assets.import-pack",
      status: "queued",
      progress: 0,
      message: "queued",
      createdAt: "2026-05-21T00:00:00.000Z",
      updatedAt: "2026-05-21T00:00:00.000Z"
    });

    const response = await POST(
      new Request("http://test/api/jobs/assets/import-pack", {
        body: JSON.stringify({
          defaultTags: ["fa", 42, "imported"],
          preset: "forgotten-adventures",
          root: "./local-assets/fa"
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      })
    );

    expect(response.status).toBe(202);
    expect(postWorkerJobMock).toHaveBeenCalledWith("/jobs/assets/import-pack", {
      defaultTags: ["fa", "imported"],
      preset: "forgotten-adventures",
      root: "./local-assets/fa"
    });
  });

  it("returns 502 when the worker is unreachable", async () => {
    postWorkerJobMock.mockRejectedValue(new Error("Worker returned 503: down"));

    const response = await POST(
      new Request("http://test/api/jobs/assets/import-pack", {
        body: JSON.stringify({ root: "./packs/fa" }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      })
    );

    expect(response.status).toBe(502);
    const body = (await response.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/503/);
  });
});
