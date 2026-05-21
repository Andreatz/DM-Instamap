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
