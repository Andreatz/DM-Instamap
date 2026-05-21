# AI Bridge

The manual bridge is available at `/ai-bridge`.

It does not call the OpenAI API or any paid service. The workflow is:

1. Write a map request.
2. DM-Instamap searches local asset groups and reference summaries.
3. The page builds a compact prompt for ChatGPT.
4. Copy the prompt manually.
5. Paste ChatGPT's JSON response back into the page.
6. The response is validated locally with Zod against `MapPlanSchema`.

If validation fails, the page shows path-based errors and generates a repair
prompt that includes the invalid response, the errors, and the required schema.

The expected response is a `MapPlan`, not a full `MapDocument`. This keeps the
bridge output editable and compatible with later map editor integration.

## Optional API Mode

The automatic bridge is enabled only when env vars are configured:

```bash
AI_PROVIDER=openai|anthropic
AI_API_KEY=...
AI_MODEL=...
AI_BASE_URL=...
AI_MAX_TOKENS=...
```

The API mode remains optional. The app still works locally with the manual
bridge when no provider is configured.

## CLI Smoke Tests

```bash
pnpm ai:blueprint "crypt below a cathedral"
pnpm ai:plan "three-room cave shrine with a river crossing"
```

`ai:blueprint` validates the returned narrative blueprint. `ai:plan` loads local
asset groups plus reference/style DNA from `data/indexes` and validates the
returned `MapPlan`.

## Web API endpoints

When API mode is enabled (env configured):

- `GET /api/ai/status` — returns provider id, model and "api" mode, or a
  `manual-only` payload when env is missing.
- `POST /api/ai/blueprint` — body `{ "request": "..." }`. Returns a validated
  `MapGenerationBlueprint`.
- `POST /api/ai/plan` — body `{ "userRequest": "...", "assetGroups": [...], "references": [...], "maxRetries": 2 }`.
  The `assetGroups` and `references` are converted to bridge summaries on the
  client (see `apps/web/src/lib/bridge-mappers.ts`) and let the model reference
  real local asset ids.
- `POST /api/ai/describe` — body
  `{ "mapName": "...", "rooms": [{ "id": "...", "label": "...", "tags": [] }], "theme": "...", "styleTags": [] }`.
  Calls `describeMapWithAi` and returns a narrative description. Used by the
  `ProjectDescribeButton` on the project page and by the editor AI drawer
  (L4).
- `POST /api/ai-bridge/import` — imports a validated `MapPlan` as a new project.

## Retry policy

`generateMapPlanWithAi` validates the response against `MapPlanSchema` with
`maxRetries` (default 2). On failure it builds a repair prompt from
`buildRepairPrompt` (errors + raw response + original prompt) and re-asks the
provider. The final response includes:

```ts
{
  ok: boolean,
  plan?: MapPlan,
  attempts: number,
  errors?: string[],
  rawResponses?: string[],
  providerId: string
}
```

## Worker offload

The web app can also run `pnpm ai:plan` inside the worker via
`POST /jobs/ai/plan` (see [WORKER.md](WORKER.md)). Useful when the round-trip
takes more than the 30s default timeout of a Next.js route.
