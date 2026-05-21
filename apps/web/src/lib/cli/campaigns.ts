import { pathToFileURL } from "node:url";
import { createCampaignProject, listCampaigns } from "../campaigns";

export type CampaignsCliCommand =
  | {
      type: "list";
    }
  | {
      description?: string;
      name: string;
      tags: string[];
      type: "create";
    };

export function parseCampaignsArgs(argv: string[]): CampaignsCliCommand {
  const [command, ...rest] = argv;

  if (command === "list") {
    return { type: "list" };
  }

  if (command === "create") {
    let name = "";
    let description: string | undefined;
    let tags: string[] = [];

    for (let index = 0; index < rest.length; index += 1) {
      const arg = rest[index];

      if (arg === "--name") {
        name = readRequiredValue(rest[index + 1], "--name");
        index += 1;
        continue;
      }

      if (arg === "--description") {
        description = readRequiredValue(rest[index + 1], "--description");
        index += 1;
        continue;
      }

      if (arg === "--tags") {
        tags = parseCsv(rest[index + 1] ?? "");
        index += 1;
        continue;
      }

      if (arg && !arg.startsWith("-") && !name) {
        name = arg;
        continue;
      }

      throw new Error(`Unknown argument: ${arg}`);
    }

    if (!name) {
      throw new Error("Usage: pnpm campaigns:create --name \"Whispering Woods\" [--tags a,b]");
    }

    return { description, name, tags, type: "create" };
  }

  throw new Error("Usage: pnpm campaigns:list | pnpm campaigns:create --name \"...\"");
}

async function main(): Promise<void> {
  const command = parseCampaignsArgs(process.argv.slice(2));
  const outputRoot = process.env.INIT_CWD ?? process.cwd();

  if (command.type === "list") {
    const campaigns = await listCampaigns(outputRoot);

    if (campaigns.length === 0) {
      console.log("No campaigns found.");
      return;
    }

    for (const campaign of campaigns) {
      console.log(`${campaign.id}\t${campaign.name}\tmaps:${campaign.maps.length}\tsessions:${campaign.sessions.length}`);
    }
    return;
  }

  const campaign = await createCampaignProject(
    {
      description: command.description,
      name: command.name,
      tags: command.tags
    },
    outputRoot
  );

  console.log(`Created campaign ${campaign.id}`);
  console.log(`Name: ${campaign.name}`);
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Campaign command failed.");
    process.exit(1);
  });
}
