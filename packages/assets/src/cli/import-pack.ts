import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  importAssetPack,
  PACK_PRESETS,
  type PackPreset
} from "../pack-importer";

export type ImportPackCliOptions = {
  defaultTags: string[];
  preset: PackPreset;
  root: string;
};

const PRESET_SET = new Set<string>(PACK_PRESETS);

export function parseImportPackArgs(argv: string[]): ImportPackCliOptions {
  const options: Partial<ImportPackCliOptions> = {
    defaultTags: [],
    preset: "generic"
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--preset") {
      options.preset = readPreset(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg === "--root") {
      options.root = readRequiredValue(argv[index + 1], "--root");
      index += 1;
      continue;
    }

    if (arg === "--default-tags") {
      options.defaultTags = parseCsv(argv[index + 1] ?? "");
      index += 1;
      continue;
    }

    if (arg && !arg.startsWith("-") && !options.root) {
      options.root = arg;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!options.root) {
    throw new Error(
      "Usage: pnpm assets:import-pack --root <path> [--preset generic] [--default-tags a,b]"
    );
  }

  return {
    defaultTags: options.defaultTags ?? [],
    preset: options.preset ?? "generic",
    root: options.root
  };
}

async function main(): Promise<void> {
  const options = parseImportPackArgs(process.argv.slice(2));
  const outputRoot = process.env.INIT_CWD ?? process.cwd();
  const assetRoot = path.isAbsolute(options.root)
    ? options.root
    : path.resolve(outputRoot, options.root);
  const result = await importAssetPack({
    assetRoot,
    defaultTags: options.defaultTags,
    outputRoot,
    preset: options.preset
  });

  console.log(
    `Imported ${result.added.length} assets from ${result.manifest.sourceRoot}.`
  );
  console.log(`Preset: ${result.preset}`);
  console.log(`Preset tags applied: ${result.presetTagsApplied}`);
  console.log(`Reclassified assets: ${result.reclassifiedCount}`);
  console.log(`Manifest errors: ${result.manifest.errors.length}`);
}

function readPreset(value: string | undefined): PackPreset {
  const preset = readRequiredValue(value, "--preset");

  if (!PRESET_SET.has(preset)) {
    throw new Error(`--preset must be one of: ${PACK_PRESETS.join(", ")}`);
  }

  return preset as PackPreset;
}

function readRequiredValue(value: string | undefined, flag: string): string {
  if (!value || value.startsWith("-")) {
    throw new Error(`${flag} requires a value.`);
  }

  return value;
}

function parseCsv(value: string): string[] {
  return [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ];
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "Asset pack import failed."
    );
    process.exit(1);
  });
}
