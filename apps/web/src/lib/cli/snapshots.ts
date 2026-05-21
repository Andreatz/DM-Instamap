import {
  createMapSnapshot,
  listSnapshotsInDirectory,
  restoreSnapshotFromDirectory,
  writeSnapshotToDirectory
} from "@dm-instamap/core";
import { pathToFileURL } from "node:url";
import { readProject, updateProject } from "../projects";

export type SnapshotsCliCommand =
  | {
      label?: string;
      projectId: string;
      type: "create";
    }
  | {
      projectId: string;
      type: "list";
    }
  | {
      contentHash: string;
      projectId: string;
      type: "restore";
    };

export function parseSnapshotsArgs(argv: string[]): SnapshotsCliCommand {
  const [command, ...rest] = argv;

  if (command === "create") {
    const projectId = rest[0];
    let label: string | undefined;

    for (let index = 1; index < rest.length; index += 1) {
      if (rest[index] === "--label") {
        label = readRequiredValue(rest[index + 1], "--label");
        index += 1;
        continue;
      }

      throw new Error(`Unknown argument: ${rest[index]}`);
    }

    if (!projectId) {
      throw new Error("Usage: pnpm snapshots:create <projectId> [--label label]");
    }

    return { label, projectId, type: "create" };
  }

  if (command === "list") {
    const projectId = rest[0];

    if (!projectId) {
      throw new Error("Usage: pnpm snapshots:list <projectId>");
    }

    return { projectId, type: "list" };
  }

  if (command === "restore") {
    const [projectId, contentHash] = rest;

    if (!projectId || !contentHash) {
      throw new Error("Usage: pnpm snapshots:restore <projectId> <contentHash>");
    }

    return { contentHash, projectId, type: "restore" };
  }

  throw new Error("Usage: pnpm snapshots:create|list|restore ...");
}

async function main(): Promise<void> {
  const command = parseSnapshotsArgs(process.argv.slice(2));
  const outputRoot = process.env.INIT_CWD ?? process.cwd();

  if (command.type === "create") {
    const project = await readProject(command.projectId, { outputRoot });
    const snapshot = createMapSnapshot({
      document: project.document,
      label: command.label,
      projectId: project.id
    });
    const writeResult = await writeSnapshotToDirectory(snapshot, {
      outputRoot,
      projectId: project.id
    });

    console.log(`${writeResult.written ? "Created" : "Reused"} snapshot ${snapshot.contentHash}`);
    console.log(`Label: ${snapshot.label}`);
    return;
  }

  if (command.type === "list") {
    const snapshots = await listSnapshotsInDirectory({
      outputRoot,
      projectId: command.projectId
    });

    if (snapshots.length === 0) {
      console.log("No snapshots found.");
      return;
    }

    for (const snapshot of snapshots) {
      console.log(`${snapshot.contentHash}\t${snapshot.createdAt}\t${snapshot.label}`);
    }
    return;
  }

  const restored = await restoreSnapshotFromDirectory(command.contentHash, {
    outputRoot,
    projectId: command.projectId
  });

  if (!restored) {
    throw new Error(`Snapshot not found: ${command.contentHash}`);
  }

  await updateProject(command.projectId, { document: restored }, { outputRoot });
  console.log(`Restored ${command.projectId} to snapshot ${command.contentHash}`);
}

function readRequiredValue(value: string | undefined, flag: string): string {
  if (!value || value.startsWith("-")) {
    throw new Error(`${flag} requires a value.`);
  }

  return value;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Snapshot command failed.");
    process.exit(1);
  });
}
