import { expect, type APIRequestContext, type Page } from "@playwright/test";

export type TestProjectDocument = {
  height?: number;
  name?: string;
  assets?: Array<Record<string, unknown>>;
  tiles: Array<{
    kind: string;
    x: number;
    y: number;
    [key: string]: unknown;
  }>;
  width?: number;
  [key: string]: unknown;
};

export type TestProject = {
  document: TestProjectDocument;
  id: string;
  name?: string;
};

export async function createPlaywrightProject(
  request: APIRequestContext,
  name: string,
  overrides: Record<string, unknown> = {}
): Promise<TestProject> {
  const createResponse = await request.post("/api/projects", {
    data: {
      heightCells: 18,
      name,
      roomCount: 4,
      theme: "playwright",
      widthCells: 24,
      ...overrides
    }
  });
  expect(createResponse.status()).toBe(201);
  const createBody = (await createResponse.json()) as {
    project: TestProject;
  };

  return createBody.project;
}

export async function deleteProjectQuietly(
  request: APIRequestContext,
  projectId: string
): Promise<void> {
  await request.delete(`/api/projects/${projectId}`).catch(() => {
    // Cleanup is best-effort: project data lives in ignored local runtime folders.
  });
}

export async function fetchProjectDocument(
  request: APIRequestContext,
  projectId: string
): Promise<TestProjectDocument> {
  const response = await request.get(`/api/projects/${projectId}`);
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { project: TestProject };

  return body.project.document;
}

/**
 * Seeds N placed assets on the "object" layer so the editor has selectable
 * assets without depending on a personal asset library.
 */
export async function seedPlacedAssets(
  request: APIRequestContext,
  projectId: string,
  count: number
): Promise<void> {
  const document = await fetchProjectDocument(request, projectId);
  const assets = Array.from({ length: count }, (_, index) => ({
    assetId: `fixture-asset-${index}`,
    id: `seed-asset-${index}`,
    layer: "object",
    position: { x: 2 + index, y: 2 + index }
  }));

  const updateResponse = await request.put(`/api/projects/${projectId}`, {
    data: {
      document: { ...document, assets }
    }
  });
  expect(updateResponse.status()).toBe(200);
}

/**
 * Opens the project editor and waits for client hydration to finish.
 */
export async function openHydratedEditor(
  page: Page,
  projectId: string
): Promise<void> {
  await page.goto(`/projects/${projectId}/editor`, {
    waitUntil: "domcontentloaded"
  });
  await expect(page.locator('.editor-shell[data-hydrated="true"]')).toBeVisible(
    {
      timeout: 45_000
    }
  );
}
