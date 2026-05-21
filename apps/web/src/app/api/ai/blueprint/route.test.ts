import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@dm-instamap/ai-bridge", () => ({
  createProviderFromEnv: vi.fn(),
  generateNarrativeBlueprintWithAi: vi.fn()
}));

import { POST } from "./route";
import { createProviderFromEnv, generateNarrativeBlueprintWithAi } from "@dm-instamap/ai-bridge";

const createProviderMock = createProviderFromEnv as unknown as ReturnType<typeof vi.fn>;
const generateBlueprintMock = generateNarrativeBlueprintWithAi as unknown as ReturnType<typeof vi.fn>;

function jsonRequest(body: unknown): Request {
  return new Request("http://test/api/ai/blueprint", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });
}

describe("POST /api/ai/blueprint", () => {
  beforeEach(() => {
    createProviderMock.mockReset();
    generateBlueprintMock.mockReset();
  });

  it("returns 503 when the provider is not configured", async () => {
    createProviderMock.mockReturnValue(null);
    const response = await POST(jsonRequest({ request: "anything" }));

    expect(response.status).toBe(503);
    const body = (await response.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/AI_PROVIDER/);
  });

  it("returns 400 when request is empty", async () => {
    createProviderMock.mockReturnValue({ id: "test" });
    const response = await POST(jsonRequest({ request: "   " }));

    expect(response.status).toBe(400);
    const body = (await response.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/request is required/);
  });

  it("returns the blueprint on success", async () => {
    createProviderMock.mockReturnValue({ id: "test" });
    generateBlueprintMock.mockResolvedValue({
      attempts: 1,
      blueprint: { name: "Crypt", mood: "grim", structure: "dungeon" },
      ok: true,
      providerId: "test"
    });

    const response = await POST(jsonRequest({ request: "crypt below cathedral" }));

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      blueprint: { name: string };
      ok: boolean;
      providerId: string;
    };
    expect(body.ok).toBe(true);
    expect(body.blueprint.name).toBe("Crypt");
    expect(body.providerId).toBe("test");
  });

  it("returns 422 on validation failure", async () => {
    createProviderMock.mockReturnValue({ id: "test" });
    generateBlueprintMock.mockResolvedValue({
      attempts: 3,
      errors: ["plan.rooms must be non-empty"],
      ok: false,
      providerId: "test",
      rawResponses: ["garbage"]
    });

    const response = await POST(jsonRequest({ request: "tiny dungeon" }));

    expect(response.status).toBe(422);
    const body = (await response.json()) as { errors: string[]; ok: boolean };
    expect(body.ok).toBe(false);
    expect(body.errors).toEqual(["plan.rooms must be non-empty"]);
  });
});
