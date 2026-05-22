import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  createPlaywrightProject,
  deleteProjectQuietly,
  openHydratedEditor
} from "./helpers";

async function criticalViolations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  return results.violations
    .filter((violation) => violation.impact === "critical")
    .map((violation) => `${violation.id} (${violation.nodes.length})`);
}

for (const route of ["/", "/generate", "/projects", "/campaigns"]) {
  test(`page ${route} has no critical accessibility violations`, async ({
    page
  }) => {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    expect(await criticalViolations(page)).toEqual([]);
  });
}

test("project editor has no critical accessibility violations", async ({
  page,
  request
}) => {
  const project = await createPlaywrightProject(
    request,
    `Playwright A11y ${Date.now()}`
  );

  try {
    await openHydratedEditor(page, project.id);
    await expect(page.getByText("Pronto")).toBeVisible();
    expect(await criticalViolations(page)).toEqual([]);
  } finally {
    await deleteProjectQuietly(request, project.id);
  }
});
