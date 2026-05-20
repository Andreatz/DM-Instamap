import {
  createImageGenerationProviderFromEnv,
  importGeneratedAssetToLibrary
} from "@dm-instamap/assets";
import { findWorkspaceRoot } from "@/lib/assets-manifest";

type GenerateBody = {
  classification?: unknown;
  fileNameHint?: unknown;
  negativePrompt?: unknown;
  prompt?: unknown;
  seed?: unknown;
  steps?: unknown;
  styleTags?: unknown;
};

export async function GET() {
  const provider = createImageGenerationProviderFromEnv(process.env);

  return Response.json({
    ok: true,
    provider: provider
      ? {
          configured: true,
          id: provider.id,
          vendor: provider.vendor
        }
      : {
          configured: false,
          reason:
            "Image generation provider not configured. Set IMAGE_GEN_PROVIDER=replicate|automatic1111 and related env vars."
        }
  });
}

export async function POST(request: Request) {
  try {
    const provider = createImageGenerationProviderFromEnv(process.env);

    if (!provider) {
      return Response.json(
        {
          error: "Image generation provider not configured.",
          ok: false
        },
        { status: 503 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as GenerateBody;
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

    if (!prompt) {
      return Response.json({ error: "prompt is required.", ok: false }, { status: 400 });
    }

    const negativePrompt = typeof body.negativePrompt === "string" ? body.negativePrompt : undefined;
    const seed = typeof body.seed === "number" ? body.seed : undefined;
    const steps = typeof body.steps === "number" ? body.steps : undefined;
    const styleTags = Array.isArray(body.styleTags)
      ? body.styleTags.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : [];
    const classification = typeof body.classification === "string" ? body.classification : "prop";
    const fileNameHint = typeof body.fileNameHint === "string" ? body.fileNameHint : undefined;
    const workspaceRoot = await findWorkspaceRoot(process.cwd());
    const result = await provider.generate({
      negativePrompt,
      prompt,
      seed,
      steps,
      styleTags
    });
    const metadata = await importGeneratedAssetToLibrary(provider, {
      classification,
      fileNameHint,
      outputRoot: workspaceRoot,
      request: { negativePrompt, prompt, seed, steps, styleTags },
      result
    });

    return Response.json({
      asset: metadata,
      ok: true
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image generation failed.";
    return Response.json({ error: message, ok: false }, { status: 500 });
  }
}
