import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { MapDocumentSchema } from "@dm-instamap/core";
import { exportSessionPack, type SessionPackOptions } from "../session-pack";

export type SessionPackCliOptions = SessionPackOptions & {
  output?: string;
  projectId: string;
};

export function parseSessionPackArgs(argv: string[]): SessionPackCliOptions {
  const options: Partial<SessionPackCliOptions> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--scale") {
      options.scale = readNumber(argv[index + 1], "--scale");
      index += 1;
      continue;
    }

    if (arg === "--description") {
      options.description = readRequiredValue(argv[index + 1], "--description");
      index += 1;
      continue;
    }

    if (arg === "--output") {
      options.output = readRequiredValue(argv[index + 1], "--output");
      index += 1;
      continue;
    }

    if (arg === "--format") {
      const format = readRequiredValue(argv[index + 1], "--format");
      if (format !== "png" && format !== "webp") {
        throw new Error("--format must be png or webp.");
      }
      options.imageFormat = format;
      index += 1;
      continue;
    }

    if (arg === "--include-initiative") {
      options.includeInitiative = true;
      continue;
    }

    if (arg === "--no-initiative") {
      options.includeInitiative = false;
      continue;
    }

    if (arg === "--no-grid") {
      options.includeGrid = false;
      continue;
    }

    if (arg && !arg.startsWith("-") && !options.projectId) {
      options.projectId = arg;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!options.projectId) {
    throw new Error("Usage: pnpm exports:session-pack <projectId> [--scale 2] [--output path]");
  }

  return {
    description: options.description,
    imageFormat: options.imageFormat,
    includeGrid: options.includeGrid,
    includeInitiative: options.includeInitiative,
    output: options.output,
    projectId: options.projectId,
    scale: options.scale
  };
}

async function main(): Promise<void> {
  const options = parseSessionPackArgs(process.argv.slice(2));
  const outputRoot = process.env.INIT_CWD ?? process.cwd();
  const projectDir = path.join(outputRoot, "data", "projects", options.projectId);
  const raw = await readFile(path.join(projectDir, "map.dmimap.json"), "utf8");
  const document = MapDocumentSchema.parse(JSON.parse(raw));
  const result = await exportSessionPack(document, {
    description: options.description,
    imageFormat: options.imageFormat,
    includeGrid: options.includeGrid,
    includeInitiative: options.includeInitiative,
    scale: options.scale
  });
  const outputPath = resolveOutputPath(outputRoot, options.output, options.projectId, result.filename);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, result.buffer);
  console.log(`Session pack written to ${path.relative(outputRoot, outputPath).split(path.sep).join("/")}`);
  console.log(`Artifacts: ${result.artifacts.length}`);
}

function resolveOutputPath(outputRoot: string, output: string | undefined, projectId: string, filename: string): string {
  if (!output) {
    return path.join(outputRoot, "data", "projects", projectId, "exports", filename);
  }

  const resolved = path.isAbsolute(output) ? output : path.resolve(outputRoot, output);
  return path.extname(resolved).toLowerCase() === ".zip" ? resolved : path.join(resolved, filename);
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Session pack export failed.");
    process.exit(1);
  });
}
