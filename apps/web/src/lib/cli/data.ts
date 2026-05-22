import { pathToFileURL } from "node:url";
import { createDataBackup, restoreDataBackup } from "../data-archive";

export type DataCliCommand =
  | {
      destination: string;
      includeIndexes: boolean;
      type: "backup";
    }
  | {
      backupDir: string;
      dryRun: boolean;
      force: boolean;
      type: "restore";
    };

const DEFAULT_BACKUP_DESTINATION = "backups";

export function parseDataArgs(argv: string[]): DataCliCommand {
  const [command, ...rest] = argv;

  if (command === "backup") {
    let destination = DEFAULT_BACKUP_DESTINATION;
    let includeIndexes = false;

    for (let index = 0; index < rest.length; index += 1) {
      const arg = rest[index];

      if (arg === "--out") {
        destination = readRequiredValue(rest[index + 1], "--out");
        index += 1;
        continue;
      }

      if (arg === "--include-indexes") {
        includeIndexes = true;
        continue;
      }

      throw new Error(`Unknown argument: ${arg}`);
    }

    return { destination, includeIndexes, type: "backup" };
  }

  if (command === "restore") {
    const backupDir = rest[0];
    let dryRun = false;
    let force = false;

    for (let index = 1; index < rest.length; index += 1) {
      const arg = rest[index];

      if (arg === "--dry-run") {
        dryRun = true;
        continue;
      }

      if (arg === "--force") {
        force = true;
        continue;
      }

      throw new Error(`Unknown argument: ${arg}`);
    }

    if (!backupDir) {
      throw new Error(
        "Usage: pnpm data:restore <backupDir> [--dry-run] [--force]"
      );
    }

    return { backupDir, dryRun, force, type: "restore" };
  }

  throw new Error(
    "Usage: pnpm data:backup [--out dir] [--include-indexes] | pnpm data:restore <backupDir> [--dry-run] [--force]"
  );
}

function readRequiredValue(value: string | undefined, flag: string): string {
  if (!value || value.startsWith("-")) {
    throw new Error(`${flag} requires a value.`);
  }

  return value;
}

async function main(): Promise<void> {
  const command = parseDataArgs(process.argv.slice(2));
  const outputRoot = process.env.INIT_CWD ?? process.cwd();

  if (command.type === "backup") {
    const result = await createDataBackup({
      destination: command.destination,
      includeIndexes: command.includeIndexes,
      outputRoot
    });

    console.log(`Backup created: ${result.backupDir}`);
    console.log(`Files: ${result.fileCount}`);
    console.log(`Sections: ${result.manifest.sections.join(", ")}`);
    return;
  }

  const result = await restoreDataBackup({
    backupDir: command.backupDir,
    dryRun: command.dryRun,
    force: command.force,
    outputRoot
  });

  console.log(
    result.dryRun ? "Dry run (no files written):" : "Restore complete:"
  );
  console.log(`  Restored: ${result.restored.length}`);
  console.log(`  Conflicts (skipped): ${result.conflicts.length}`);

  if (result.conflicts.length > 0) {
    console.log(
      `  Use --force to overwrite: ${result.conflicts.slice(0, 5).join(", ")}${result.conflicts.length > 5 ? ", ..." : ""}`
    );
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "Data command failed."
    );
    process.exit(1);
  });
}
