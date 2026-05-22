import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  appendAssetToManifest,
  createImageGenerationProviderFromEnv,
  importGeneratedAssetToLibrary,
  scanSingleAsset
} from "../index";
import type { AssetClassification } from "../classifier";

export type GenerateAssetCliOptions = {
  classification: AssetClassification;
  fileNameHint?: string;
  negativePrompt?: string;
  outputDirectory?: string;
  prompt: string;
  seed?: number;
  steps?: number;
  styleTags: string[];
};

export function parseGenerateAssetArgs(
  argv: string[]
): GenerateAssetCliOptions {
  const options: Partial<GenerateAssetCliOptions> = {
    classification: "prop",
    styleTags: []
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--prompt") {
      options.prompt = readRequiredValue(argv[index + 1], "--prompt");
      index += 1;
      continue;
    }

    if (arg === "--classification") {
      options.classification = readRequiredValue(
        argv[index + 1],
        "--classification"
      ) as AssetClassification;
      index += 1;
      continue;
    }

    if (arg === "--seed") {
      options.seed = readNumber(argv[index + 1], "--seed");
      index += 1;
      continue;
    }

    if (arg === "--steps") {
      options.steps = readNumber(argv[index + 1], "--steps");
      index += 1;
      continue;
    }

    if (arg === "--style-tags") {
      options.styleTags = parseCsv(argv[index + 1] ?? "");
      index += 1;
      continue;
    }

    if (arg === "--negative-prompt") {
      options.negativePrompt = readRequiredValue(
        argv[index + 1],
        "--negative-prompt"
      );
      index += 1;
      continue;
    }

    if (arg === "--file-name-hint") {
      options.fileNameHint = readRequiredValue(
        argv[index + 1],
        "--file-name-hint"
      );
      index += 1;
      continue;
    }

    if (arg === "--output-directory") {
      options.outputDirectory = readRequiredValue(
        argv[index + 1],
        "--output-directory"
      );
      index += 1;
      continue;
    }

    if (arg && !arg.startsWith("-") && !options.prompt) {
      options.prompt = arg;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!options.prompt) {
    throw new Error(
      'Usage: pnpm assets:generate --prompt "..." [--classification prop] [--seed 123]'
    );
  }

  return {
    classification: options.classification ?? "prop",
    fileNameHint: options.fileNameHint,
    negativePrompt: options.negativePrompt,
    outputDirectory: options.outputDirectory,
    prompt: options.prompt,
    seed: options.seed,
    steps: options.steps,
    styleTags: options.styleTags ?? []
  };
}

async function main(): Promise<void> {
  const options = parseGenerateAssetArgs(process.argv.slice(2));
  const provider = createImageGenerationProviderFromEnv(process.env);

  if (!provider) {
    throw new Error(
      "Image generation provider not configured. Set IMAGE_GEN_PROVIDER and related env vars."
    );
  }

  const outputRoot = process.env.INIT_CWD ?? process.cwd();
  const request = {
    negativePrompt: options.negativePrompt,
    prompt: options.prompt,
    seed: options.seed,
    steps: options.steps,
    styleTags: options.styleTags
  };
  const result = await provider.generate(request);
  const metadata = await importGeneratedAssetToLibrary(provider, {
    classification: options.classification,
    fileNameHint: options.fileNameHint,
    outputDirectory: options.outputDirectory,
    outputRoot,
    request,
    result
  });
  const sourceRoot = await readManifestSourceRoot(outputRoot);
  const entry = await scanSingleAsset(metadata.path, {
    outputRoot,
    sourceRoot
  });
  const manifestUpdate = await appendAssetToManifest(entry, { outputRoot });

  console.log(`Generated asset: ${metadata.relativePath}`);
  console.log(`Provider: ${metadata.provider}`);
  console.log(
    `Manifest ${manifestUpdate.replaced ? "updated" : "appended"}: ${entry.id}`
  );
  console.log(`Total assets: ${manifestUpdate.manifest.assets.length}`);
}

async function readManifestSourceRoot(outputRoot: string): Promise<string> {
  try {
    const raw = await readFile(
      path.join(outputRoot, "data", "indexes", "assets.manifest.json"),
      "utf8"
    );
    const parsed = JSON.parse(raw) as { sourceRoot?: unknown };

    if (typeof parsed.sourceRoot === "string" && parsed.sourceRoot.trim()) {
      return parsed.sourceRoot;
    }
  } catch (error) {
    if (
      !(error instanceof Error && "code" in error && error.code === "ENOENT")
    ) {
      throw error;
    }
  }

  return outputRoot;
}

function readRequiredValue(value: string | undefined, flag: string): string {
  if (!value || value.startsWith("-")) {
    throw new Error(`${flag} requires a value.`);
  }

  return value;
}

function readNumber(value: string | undefined, flag: string): number {
  const parsed = Number(readRequiredValue(value, flag));

  if (!Number.isFinite(parsed)) {
    throw new Error(`${flag} must be a finite number.`);
  }

  return parsed;
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
      error instanceof Error ? error.message : "Asset generation failed."
    );
    process.exit(1);
  });
}
