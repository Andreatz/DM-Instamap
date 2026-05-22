import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { importAssetPack } from "../pack-importer";

export type DemoAssetSpec = {
  name: string;
  rgb: [number, number, number];
  tags: string[];
};

/** Placeholder sintetici: nessun asset reale, solo tinte piatte etichettate. */
export const DEMO_ASSETS: DemoAssetSpec[] = [
  { name: "stone-floor", rgb: [120, 110, 90], tags: ["floor", "stone"] },
  { name: "wooden-door", rgb: [90, 60, 30], tags: ["door", "wood"] },
  { name: "stone-wall", rgb: [70, 72, 78], tags: ["wall", "stone"] },
  { name: "torch-light", rgb: [220, 150, 60], tags: ["light", "torch"] },
  { name: "wooden-table", rgb: [110, 80, 50], tags: ["prop", "furniture"] },
  { name: "water-pool", rgb: [60, 110, 150], tags: ["water", "terrain"] }
];

export async function createDemoAssets(directory: string): Promise<string[]> {
  await mkdir(directory, { recursive: true });
  const files: string[] = [];

  for (const asset of DEMO_ASSETS) {
    const [r, g, b] = asset.rgb;
    const file = path.join(directory, `${asset.name}.png`);
    await sharp({
      create: {
        background: { alpha: 1, b, g, r },
        channels: 4,
        height: 32,
        width: 32
      }
    })
      .png()
      .toFile(file);
    files.push(file);
  }

  return files;
}

export async function seedDemoLibrary(
  outputRoot: string
): Promise<{ assetCount: number; demoDir: string }> {
  const demoDir = path.join(outputRoot, "data", "assets", "demo");
  await createDemoAssets(demoDir);
  const result = await importAssetPack({
    assetRoot: demoDir,
    defaultTags: ["demo"],
    outputRoot,
    preset: "generic"
  });

  return { assetCount: result.added.length, demoDir };
}

async function main(): Promise<void> {
  const outputRoot = process.env.INIT_CWD ?? process.cwd();
  const force = process.argv.includes("--force");
  const manifestPath = path.join(
    outputRoot,
    "data",
    "indexes",
    "assets.manifest.json"
  );

  if (existsSync(manifestPath) && !force) {
    console.error(
      "Esiste gia un manifest asset locale. Usa --force per sovrascriverlo con la demo."
    );
    process.exit(1);
  }

  const result = await seedDemoLibrary(outputRoot);
  console.log(
    `Libreria demo creata: ${result.assetCount} asset placeholder in ${result.demoDir}`
  );
  console.log(
    "Prossimi passi: pnpm start, crea un progetto e prova scan -> genera -> edita -> esporta."
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Seed demo failed.");
    process.exit(1);
  });
}
