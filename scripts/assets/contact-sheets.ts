/**
 * `pnpm assets:contact-sheets -- --only unknown,needs-review,suspicious-light`
 *
 * Generates contact-sheet PNG pages for ANOMALY buckets only (never all 34k
 * assets unless `--all` is passed). Each thumbnail is labelled with id,
 * macroCategory, assetGroups and the leading sourceTags.
 *
 * Output: data/assets/contact-sheets/<bucket>/page-001.png
 */

import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  type AssetManifestItem,
  isSuspiciousLight,
  TAXONOMY_PATHS
} from "../../packages/assets/src/taxonomy/index.ts";
import {
  buildAssetFileIndex,
  logLine,
  lookupAssetFile,
  parseCliArgs,
  REPO_ROOT,
  resolveRepoPath,
  tryLoadJson
} from "./_shared.ts";

type ManifestLike = { assets: AssetManifestItem[] };

const BUCKETS: Record<string, (item: AssetManifestItem) => boolean> = {
  unknown: (item) => item.macroCategory === "unknown",
  "needs-review": (item) => item.status === "needs-review",
  "suspicious-light": (item) => isSuspiciousLight(item),
  "multi-category": (item) =>
    item.qualityFlags.includes("multi-category-conflict"),
  "low-quality": (item) =>
    item.qualityFlags.includes("tiny") || item.qualityFlags.includes("corrupt"),
  "missing-metadata": (item) =>
    item.qualityFlags.includes("missing-file") ||
    item.metadata.width === null ||
    item.metadata.width === undefined
};

const THUMB = 160;
const LABEL_H = 52;
const GAP = 12;
const COLS = 5;
const ROWS = 5;
const PER_PAGE = COLS * ROWS;
const BG = { r: 24, g: 26, b: 31, alpha: 1 };

async function main(): Promise<void> {
  const { flags } = parseCliArgs(process.argv.slice(2));
  const onlyArg = typeof flags.only === "string" ? flags.only : "";
  const includeAll = flags.all === true;
  const perBucketLimit =
    typeof flags.limit === "string" ? Number.parseInt(flags.limit, 10) : 240;

  const selected = onlyArg
    ? onlyArg
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    : Object.keys(BUCKETS);

  const manifest =
    (await tryLoadJson<ManifestLike>(TAXONOMY_PATHS.finalManifest)) ??
    (await tryLoadJson<ManifestLike>(TAXONOMY_PATHS.mappedWithMetadata)) ??
    (await tryLoadJson<ManifestLike>(TAXONOMY_PATHS.mappedAssets));

  if (!manifest) {
    throw new Error("Nessun manifest trovato. Esegui prima assets:manifest.");
  }

  logLine("Indicizzo i file asset sul disco...");
  const fileIndex = await buildAssetFileIndex();

  for (const bucket of selected) {
    const predicate = BUCKETS[bucket];
    if (!predicate) {
      logLine(`⚠️  bucket sconosciuto: ${bucket} (ignorato)`);
      continue;
    }

    const matches = manifest.assets.filter(predicate);
    const limited = includeAll ? matches : matches.slice(0, perBucketLimit);
    if (limited.length === 0) {
      logLine(`${bucket}: 0 asset, nessuna contact sheet.`);
      continue;
    }

    const outDir = resolveRepoPath(
      path.join(TAXONOMY_PATHS.contactSheets, bucket)
    );
    await mkdir(outDir, { recursive: true });

    const pageCount = Math.ceil(limited.length / PER_PAGE);
    for (let page = 0; page < pageCount; page += 1) {
      const pageItems = limited.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
      const buffer = await renderPage(pageItems, fileIndex);
      const fileName = `page-${String(page + 1).padStart(3, "0")}.png`;
      await sharp(buffer).png().toFile(path.join(outDir, fileName));
    }

    logLine(
      `${bucket}: ${limited.length} asset su ${pageCount} pagine -> ${path
        .relative(REPO_ROOT, outDir)
        .replaceAll("\\", "/")}`
    );
  }
}

async function renderPage(
  items: AssetManifestItem[],
  fileIndex: Map<string, string>
): Promise<Buffer> {
  const cellW = THUMB;
  const cellH = THUMB + LABEL_H;
  const width = COLS * cellW + (COLS + 1) * GAP;
  const height = ROWS * cellH + (ROWS + 1) * GAP;

  const composites: sharp.OverlayOptions[] = [];

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]!;
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const left = GAP + col * (cellW + GAP);
    const top = GAP + row * (cellH + GAP);

    const thumb = await renderThumb(item, fileIndex);
    composites.push({ input: thumb, left, top });

    const label = Buffer.from(renderLabelSvg(item));
    composites.push({ input: label, left, top: top + THUMB });
  }

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: BG
    }
  })
    .composite(composites)
    .png()
    .toBuffer();
}

async function renderThumb(
  item: AssetManifestItem,
  fileIndex: Map<string, string>
): Promise<Buffer> {
  const absolutePath = lookupAssetFile(fileIndex, item.path);

  if (absolutePath) {
    try {
      return await sharp(absolutePath, { limitInputPixels: false })
        .resize(THUMB, THUMB, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toBuffer();
    } catch {
      // fall through to placeholder
    }
  }

  const placeholder = `
    <svg width="${THUMB}" height="${THUMB}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#33363d"/>
      <text x="50%" y="50%" fill="#8a8f99" font-family="sans-serif"
        font-size="14" text-anchor="middle" dominant-baseline="middle">
        no file
      </text>
    </svg>`;
  return sharp(Buffer.from(placeholder)).png().toBuffer();
}

function renderLabelSvg(item: AssetManifestItem): string {
  const groups = item.assetGroups.slice(0, 3).join(", ");
  const tags = item.sourceTags.slice(0, 2).join(", ");
  return `
    <svg width="${THUMB}" height="${LABEL_H}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#1f2227"/>
      <text x="6" y="14" fill="#e6e6e6" font-family="sans-serif" font-size="11">
        ${escapeXml(item.id)}
      </text>
      <text x="6" y="28" fill="#9ecbff" font-family="sans-serif" font-size="11">
        ${escapeXml(item.macroCategory)} · ${escapeXml(groups)}
      </text>
      <text x="6" y="44" fill="#8a8f99" font-family="sans-serif" font-size="10">
        ${escapeXml(tags)}
      </text>
    </svg>`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Errore contact-sheets."}\n`
  );
  process.exitCode = 1;
});
