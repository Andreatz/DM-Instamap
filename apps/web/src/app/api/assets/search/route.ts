import {
  createEmbeddingProviderFromEnv,
  resolveEmbeddingConfigFromEnv,
  searchAssetsByImage,
  searchAssetsByText
} from "@dm-instamap/assets/embeddings";
import { type NextRequest, NextResponse } from "next/server";
import {
  enrichAssetSearchResults,
  normalizeSearchLimit,
  resolveWorkspaceFilePath
} from "@/lib/asset-search";
import { findWorkspaceRoot, loadAssetManifest } from "@/lib/assets-manifest";

type SearchByImagePayload = {
  imagePath?: unknown;
  limit?: unknown;
};

export async function GET(request: NextRequest) {
  const workspaceRoot = await findWorkspaceRoot(process.cwd());
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const limit = normalizeSearchLimit(request.nextUrl.searchParams.get("limit"));
  const manifest = await loadAssetManifest();
  const provider = createEmbeddingProviderFromEnv(process.env);
  const embeddingsConfig = resolveEmbeddingConfigFromEnv(process.env);
  const results = await searchAssetsByText({
    limit,
    outputRoot: workspaceRoot,
    provider,
    query
  });

  return NextResponse.json({
    embeddings: {
      provider: provider.id,
      source: embeddingsConfig.provider
    },
    mode: "text",
    ok: true,
    query,
    results: enrichAssetSearchResults(results, manifest.assets)
  });
}

export async function POST(request: NextRequest) {
  try {
    const workspaceRoot = await findWorkspaceRoot(process.cwd());
    const payload = (await request.json()) as SearchByImagePayload;
    const imagePath =
      typeof payload.imagePath === "string" ? payload.imagePath : "";
    const resolvedImagePath = resolveWorkspaceFilePath(
      workspaceRoot,
      imagePath
    );
    const limit = normalizeSearchLimit(
      typeof payload.limit === "string" || typeof payload.limit === "number"
        ? payload.limit
        : undefined
    );
    const manifest = await loadAssetManifest();
    const provider = createEmbeddingProviderFromEnv(process.env);
    const results = await searchAssetsByImage({
      imagePath: resolvedImagePath,
      limit,
      outputRoot: workspaceRoot,
      provider
    });

    return NextResponse.json({
      embeddings: {
        provider: provider.id
      },
      mode: "image",
      ok: true,
      results: enrichAssetSearchResults(results, manifest.assets)
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not search by image.",
        ok: false
      },
      { status: 400 }
    );
  }
}
