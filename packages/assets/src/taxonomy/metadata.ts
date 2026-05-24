/**
 * Real-file metadata enrichment for manifest items. Uses `sharp` for image
 * dimensions/transparency and Node crypto for a content hash. This module lives
 * inside the assets package so `sharp` resolves from its node_modules; it is
 * deliberately NOT re-exported from `./index` so the generator never pulls in
 * sharp transitively.
 */

import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import sharp from "sharp";
import type { AssetManifestItem, AssetMetadata } from "./schema";

export type EnrichMetadataResult = {
  metadata: AssetMetadata;
  qualityFlags: string[];
};

/**
 * Enrich a single asset from its resolved absolute path. When `absolutePath`
 * is null the file could not be located on disk; the item is flagged
 * `missing-file` and classification is left untouched.
 */
export async function enrichAssetMetadata(
  item: AssetManifestItem,
  absolutePath: string | null
): Promise<EnrichMetadataResult> {
  const metadata: AssetMetadata = { ...item.metadata };
  const qualityFlags = new Set(item.qualityFlags);

  if (!absolutePath) {
    qualityFlags.add("missing-file");
    return { metadata, qualityFlags: [...qualityFlags] };
  }

  metadata.extension = extractExtension(item.path);

  try {
    const fileStat = await stat(absolutePath);
    metadata.fileSize = fileStat.size;

    const buffer = await readFile(absolutePath);
    metadata.hash = createHash("sha1").update(buffer).digest("hex");

    const image = sharp(buffer, { limitInputPixels: false });
    const imageInfo = await image.metadata();
    metadata.width = imageInfo.width ?? null;
    metadata.height = imageInfo.height ?? null;
    metadata.hasTransparency = Boolean(imageInfo.hasAlpha);
    metadata.aspectRatio =
      imageInfo.width && imageInfo.height
        ? Number((imageInfo.width / imageInfo.height).toFixed(4))
        : null;

    if (
      typeof metadata.width === "number" &&
      typeof metadata.height === "number" &&
      (metadata.width < 16 || metadata.height < 16)
    ) {
      qualityFlags.add("tiny");
    }
  } catch {
    qualityFlags.add("corrupt");
  }

  return { metadata, qualityFlags: [...qualityFlags] };
}

function extractExtension(path: string): string | null {
  const match = /\.([a-z0-9]+)$/iu.exec(path);
  return match ? match[1]!.toLowerCase() : null;
}
