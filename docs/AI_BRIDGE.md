# Manual ChatGPT Bridge

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
