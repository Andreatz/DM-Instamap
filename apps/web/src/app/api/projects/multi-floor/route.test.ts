import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/projects", () => ({
  createMultiFloorProjects: vi.fn(),
  toProjectSummary: vi.fn((project: { id: string; name: string }) => ({
    id: project.id,
    name: project.name,
    summary: true
  }))
}));

import { POST } from "./route";
import { createMultiFloorProjects } from "@/lib/projects";

const createMultiFloorProjectsMock =
  createMultiFloorProjects as unknown as ReturnType<typeof vi.fn>;

describe("POST /api/projects/multi-floor", () => {
  beforeEach(() => {
    createMultiFloorProjectsMock.mockReset();
  });

  it("returns 400 when documents is missing or empty", async () => {
    const response = await POST(
      new Request("http://test/api/projects/multi-floor", {
        body: JSON.stringify({ name: "Crypt", documents: [] }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      })
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/documents/);
    expect(createMultiFloorProjectsMock).not.toHaveBeenCalled();
  });

  it("creates linked projects and returns 201 with summaries", async () => {
    createMultiFloorProjectsMock.mockResolvedValue([
      { id: "crypt-floor-1", name: "Crypt — Floor 1" },
      { id: "crypt-floor-2", name: "Crypt — Floor 2" }
    ]);

    const response = await POST(
      new Request("http://test/api/projects/multi-floor", {
        body: JSON.stringify({
          baseSlug: "Crypt",
          documents: [{ name: "a" }, { name: "b" }],
          name: "Crypt"
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      })
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      ok: boolean;
      projects: Array<{ id: string; name: string }>;
    };
    expect(body.ok).toBe(true);
    expect(body.projects.map((project) => project.id)).toEqual([
      "crypt-floor-1",
      "crypt-floor-2"
    ]);
    expect(createMultiFloorProjectsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        baseSlug: "Crypt",
        name: "Crypt",
        documents: expect.any(Array)
      })
    );
  });

  it("returns 400 with a friendly message when the factory throws", async () => {
    createMultiFloorProjectsMock.mockRejectedValue(
      new Error("Could not reserve project id for floor")
    );

    const response = await POST(
      new Request("http://test/api/projects/multi-floor", {
        body: JSON.stringify({
          documents: [{ name: "a" }],
          name: "Crypt"
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      })
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/reserve project id/);
  });
});
