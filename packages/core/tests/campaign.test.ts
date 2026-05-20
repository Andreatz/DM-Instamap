import { describe, expect, it } from "vitest";
import { CampaignSchema, createCampaign } from "../src";

describe("createCampaign", () => {
  it("returns a valid campaign with defaults", () => {
    const campaign = createCampaign({ id: "campaign-1", name: "Whispering Woods" });

    expect(campaign.id).toBe("campaign-1");
    expect(campaign.name).toBe("Whispering Woods");
    expect(campaign.maps).toEqual([]);
    expect(campaign.sessions).toEqual([]);
    expect(campaign.version).toBe(1);
  });

  it("accepts maps and sessions linked by document id", () => {
    const campaign = createCampaign({
      description: "A short tomb crawl",
      id: "campaign-2",
      maps: [
        {
          documentId: "doc-cathedral",
          label: "Cathedral",
          notes: "Surface level",
          projectId: "project-a",
          tags: ["surface"]
        },
        {
          documentId: "doc-crypt",
          label: "Crypt",
          projectId: "project-a",
          tags: ["underground"]
        }
      ],
      name: "Crypt Beneath the Cathedral",
      sessions: [
        {
          date: "2026-05-22",
          id: "session-1",
          mapDocumentIds: ["doc-cathedral"],
          summary: "Party arrives at the cathedral.",
          title: "Session 1"
        }
      ]
    });

    expect(campaign.maps).toHaveLength(2);
    expect(campaign.sessions[0]?.mapDocumentIds).toEqual(["doc-cathedral"]);
  });

  it("rejects invalid input via the schema", () => {
    expect(() => CampaignSchema.parse({})).toThrow();
  });
});
