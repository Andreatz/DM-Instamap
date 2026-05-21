import path from "node:path";
import type { AssetSearchResult } from "@dm-instamap/assets/embeddings";
import type { AssetBrowserEntry } from "./asset-browser";

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
  const trimmed = inputPath.trim();

  if (!trimmed) {
    throw new Error("imagePath is required.");
  }

  const resolved = path.isAbsolute(trimmed)
    ? path.resolve(trimmed)
    : path.resolve(workspaceRoot, trimmed);
  const relative = path.relative(workspaceRoot, resolved);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("imagePath must stay inside the DM-Instamap workspace.");
  }

  return resolved;
}
