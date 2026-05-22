import { expect, test, type APIRequestContext } from "@playwright/test";
import {
  createPlaywrightProject,
  deleteProjectQuietly,
  fetchProjectDocument
} from "./helpers";

async function deleteCampaignQuietly(
  request: APIRequestContext,
  campaignId: string
): Promise<void> {
  await request.delete(`/api/campaigns/${campaignId}`).catch(() => {
    // Best-effort cleanup of local campaign data.
  });
}

test("campaign can be created, linked to a project and given a session", async ({
  page,
  request
}) => {
  const project = await createPlaywrightProject(
    request,
    `Playwright Campaign Map ${Date.now()}`
  );
  let campaignId: string | null = null;

  try {
    const document = await fetchProjectDocument(request, project.id);
    const documentId = String(document.id);
    expect(documentId.length).toBeGreaterThan(0);

    const createResponse = await request.post("/api/campaigns", {
      data: {
        description: "Campagna di regressione Playwright",
        name: `Playwright Campaign ${Date.now()}`,
        tags: ["playwright"]
      }
    });
    expect(createResponse.status()).toBe(200);
    const createBody = (await createResponse.json()) as {
      campaign: { id: string };
      ok: boolean;
    };
    campaignId = createBody.campaign.id;
    expect(campaignId.length).toBeGreaterThan(0);

    const updateResponse = await request.put(`/api/campaigns/${campaignId}`, {
      data: {
        maps: [
          {
            documentId,
            label: "Piano terra",
            projectId: project.id,
            tags: ["dungeon"]
          }
        ],
        sessions: [
          {
            date: "2026-01-01",
            id: "session-1",
            mapDocumentIds: [documentId],
            title: "Sessione di apertura"
          }
        ]
      }
    });
    expect(updateResponse.status()).toBe(200);

    const getResponse = await request.get(`/api/campaigns/${campaignId}`);
    expect(getResponse.status()).toBe(200);
    const getBody = (await getResponse.json()) as {
      campaign: {
        maps: Array<{ projectId: string }>;
        sessions: Array<{ title: string }>;
      };
    };
    expect(getBody.campaign.maps).toHaveLength(1);
    expect(getBody.campaign.maps[0]?.projectId).toBe(project.id);
    expect(getBody.campaign.sessions).toHaveLength(1);
    expect(getBody.campaign.sessions[0]?.title).toBe("Sessione di apertura");

    await page.goto(`/campaigns/${campaignId}`, {
      waitUntil: "domcontentloaded"
    });
    await expect(page.getByText("Piano terra")).toBeVisible();
    await expect(page.getByText("Sessione di apertura")).toBeVisible();
  } finally {
    if (campaignId) {
      await deleteCampaignQuietly(request, campaignId);
    }
    await deleteProjectQuietly(request, project.id);
  }
});
