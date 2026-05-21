import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/campaigns", () => ({
  createCampaignProject: vi.fn(),
  listCampaigns: vi.fn()
}));

import { GET, POST } from "./route";
import { createCampaignProject, listCampaigns } from "@/lib/campaigns";

const createCampaignMock = createCampaignProject as unknown as ReturnType<typeof vi.fn>;
const listCampaignsMock = listCampaigns as unknown as ReturnType<typeof vi.fn>;

describe("GET /api/campaigns", () => {
  beforeEach(() => {
    listCampaignsMock.mockReset();
  });

  it("returns the campaign list", async () => {
    listCampaignsMock.mockResolvedValue([{ id: "whispering-woods", name: "Whispering Woods" }]);
    const response = await GET();

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      campaigns: Array<{ id: string }>;
      ok: boolean;
    };
    expect(body.ok).toBe(true);
    expect(body.campaigns).toHaveLength(1);
    expect(body.campaigns[0]!.id).toBe("whispering-woods");
  });

  it("returns 500 on a list failure", async () => {
    listCampaignsMock.mockRejectedValue(new Error("disk full"));
    const response = await GET();
    expect(response.status).toBe(500);
  });
});

describe("POST /api/campaigns", () => {
  beforeEach(() => {
    createCampaignMock.mockReset();
  });

  function jsonRequest(body: unknown): Request {
    return new Request("http://test/api/campaigns", {
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });
  }

  it("returns 400 when the name is missing", async () => {
    const response = await POST(jsonRequest({ tags: ["wilderness"] }));

    expect(response.status).toBe(400);
    const body = (await response.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/name is required/);
    expect(createCampaignMock).not.toHaveBeenCalled();
  });

  it("creates a campaign, filtering invalid tags", async () => {
    createCampaignMock.mockResolvedValue({
      id: "whispering-woods",
      name: "Whispering Woods",
      tags: ["wilderness"]
    });

    const response = await POST(
      jsonRequest({
        description: "A hex-crawl in the deep wilds.",
        name: "Whispering Woods",
        tags: ["wilderness", 42, "", "hex-crawl"]
      })
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      campaign: { id: string };
      ok: boolean;
    };
    expect(body.ok).toBe(true);
    expect(body.campaign.id).toBe("whispering-woods");
    expect(createCampaignMock).toHaveBeenCalledWith({
      description: "A hex-crawl in the deep wilds.",
      name: "Whispering Woods",
      tags: ["wilderness", "hex-crawl"]
    });
  });
});
