import { createProviderFromEnv, generateNarrativeBlueprintWithAi } from "@dm-instamap/ai-bridge";

type BlueprintRequest = {
  maxRetries?: unknown;
  request?: unknown;
  temperature?: unknown;
};

export async function POST(request: Request) {
  try {
    const provider = createProviderFromEnv(process.env);

    if (!provider) {
      return Response.json(
        {
          error: "AI provider not configured. Set AI_PROVIDER and AI_API_KEY in your environment.",
          ok: false
        },
        { status: 503 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as BlueprintRequest;
    const userRequest = typeof body.request === "string" ? body.request : "";

    if (userRequest.trim().length === 0) {
      return Response.json({ error: "request is required.", ok: false }, { status: 400 });
    }

    const maxRetries = typeof body.maxRetries === "number" ? body.maxRetries : undefined;
    const temperature = typeof body.temperature === "number" ? body.temperature : undefined;
    const result = await generateNarrativeBlueprintWithAi(userRequest, provider, {
      maxRetries,
      temperature
    });

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
      blueprint: result.blueprint,
      ok: true,
      providerId: result.providerId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI blueprint generation failed.";
    return Response.json({ error: message, ok: false }, { status: 500 });
  }
}
