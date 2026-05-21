import { pathToFileURL } from "node:url";
import { createProviderFromEnv, generateMapPlanWithAi } from "../index";
import { loadBridgeContextFromIndexes } from "./context";

export type AiPlanCliOptions = {
  maxRetries?: number;
  request: string;
};

export function parseAiPlanArgs(argv: string[]): AiPlanCliOptions {
  const parts: string[] = [];
  let maxRetries: number | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--max-retries") {
      maxRetries = readNumber(argv[index + 1], "--max-retries");
      index += 1;
      continue;
    }

    if (arg?.startsWith("-")) {
      throw new Error(`Unknown argument: ${arg}`);
    }

    if (arg) {
      parts.push(arg);
    }
  }

  const request = parts.join(" ").trim();

  if (!request) {
    throw new Error("Usage: pnpm ai:plan \"crypt below cathedral\" [--max-retries 1]");
  }

  return { maxRetries, request };
}

async function main(): Promise<void> {
  const options = parseAiPlanArgs(process.argv.slice(2));
  const provider = createProviderFromEnv(process.env);

  if (!provider) {
    throw new Error("AI provider not configured. Set AI_PROVIDER and AI_API_KEY.");
  }

  const outputRoot = process.env.INIT_CWD ?? process.cwd();
  const context = await loadBridgeContextFromIndexes(outputRoot);
  const result = await generateMapPlanWithAi(
    {
      assetGroups: context.assetGroups,
      references: context.references,
      userRequest: options.request
    },
    provider,
    {
      maxRetries: options.maxRetries
    }
  );

  console.log(JSON.stringify(result, null, 2));
}

function readNumber(value: string | undefined, flag: string): number {
  const parsed = Number(value);

  if (!value || !Number.isFinite(parsed)) {
    throw new Error(`${flag} must be a finite number.`);
  }

  return parsed;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "AI plan failed.");
    process.exit(1);
  });
}
