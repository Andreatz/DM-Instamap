import {
  createProviderFromEnv,
  generateMapPlanWithAi,
  type BridgeAssetGroupSummary,
  type BridgeAssetSearchSummary,
  type BridgeReferenceSummary
} from "@dm-instamap/ai-bridge";

type PlanRequest = {
  assetGroups?: unknown;
  assetSearchResults?: unknown;
  maxRetries?: unknown;
  references?: unknown;
  temperature?: unknown;
  userRequest?: unknown;
};

export async function POST(request: Request) {
  try {
    const provider = createProviderFromEnv(process.env);

    if (!provider) {
      return Response.json(
        {
          error:
            "AI provider not configured. Set AI_PROVIDER and AI_API_KEY in your environment.",
          ok: false
        },
        { status: 503 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as PlanRequest;
    const userRequest =
      typeof body.userRequest === "string" ? body.userRequest : "";

    if (userRequest.trim().length === 0) {
      return Response.json(
        { error: "userRequest is required.", ok: false },
        { status: 400 }
      );
    }

    const assetGroups = sanitizeArray<BridgeAssetGroupSummary>(
      body.assetGroups
    );
    const references = sanitizeArray<BridgeReferenceSummary>(body.references);
    const assetSearchResults = sanitizeArray<BridgeAssetSearchSummary>(
      body.assetSearchResults
    );
    const maxRetries =
      typeof body.maxRetries === "number" ? body.maxRetries : undefined;
    const temperature =
      typeof body.temperature === "number" ? body.temperature : undefined;
    const result = await generateMapPlanWithAi(
      {
        assetGroups,
        assetSearchResults,
        references,
        userRequest
      },
      provider,
      {
        maxRetries,
        temperature
      }
    );

    if (!result.ok) {
      return Response.json(
        {
          attempts: result.attempts,
          errors: result.errors,
          ok: false,
          providerId: result.providerId,
          rawResponses: result.rawResponses
        },
        { status: 422 }
      );
    }

    return Response.json({
      attempts: result.attempts,
      ok: true,
      plan: result.plan,
      providerId: result.providerId,
      rawResponses: result.rawResponses
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "AI plan generation failed.";
    return Response.json({ error: message, ok: false }, { status: 500 });
  }
}

function sanitizeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}
