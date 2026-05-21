import type { AssetSearchResult } from "@dm-instamap/assets/embeddings";
import type { AssetBrowserEntry } from "./asset-browser";
import { validateLocalPath } from "./local-paths";

export type AssetSearchApiResult = AssetSearchResult & {
  classification: string;
  thumbnailUrl: string;
};

export function normalizeSearchLimit(value: string | number | null | undefined, fallback = 20): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(100, Math.max(1, Math.floor(parsed)));
}

export function enrichAssetSearchResults(
  results: AssetSearchResult[],
  assets: AssetBrowserEntry[]
): AssetSearchApiResult[] {
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));

  return results.map((result) => {
    const asset = assetById.get(result.assetId);

    return {
      ...result,
      classification: asset?.classification ?? "unknown",
      thumbnailUrl: asset?.thumbnailUrl ?? `/assets/preview/${encodeURIComponent(result.assetId)}`
    };
  });
}

export function resolveWorkspaceFilePath(workspaceRoot: string, inputPath: string): string {
  return validateLocalPath({
    inputPath,
    label: "imagePath",
    workspaceRoot
  });
}
