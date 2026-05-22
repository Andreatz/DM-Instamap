import { expect, test } from "@playwright/test";

// La pipeline E2E avvia il server con AI_PROVIDER=mock (vedi playwright.config.ts):
// nessuna chiamata esterna, nessuna chiave API.

test("AI bridge status reports the local mock provider", async ({
  request
}) => {
  const response = await request.get("/api/ai/status");
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    ok: boolean;
    status: { configured?: boolean; localOnly?: boolean; mode?: string };
  };

  expect(body.ok).toBe(true);
  expect(body.status.mode).toBe("mock");
  expect(body.status.localOnly).toBe(true);
});

test("AI plan endpoint returns a deterministic plan from the mock provider", async ({
  request
}) => {
  const response = await request.post("/api/ai/plan", {
    data: {
      userRequest: "Un piccolo dungeon con due stanze e una porta."
    }
  });
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    ok: boolean;
    plan?: { rooms?: unknown[] };
    providerId?: string;
  };

  expect(body.ok).toBe(true);
  expect(body.plan).toBeDefined();
  expect(typeof body.providerId).toBe("string");
});
