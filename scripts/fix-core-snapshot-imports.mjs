import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();

const SNAPSHOT_EXPORTS = new Set([
  "applyMapDocumentDelta",
  "computeDocumentContentHash",
  "computeMapDocumentDelta",
  "createDeltaSnapshot",
  "createMapSnapshot",
  "DeltaSnapshotRecordSchema",
  "diffSnapshots",
  "listSnapshotsInDirectory",
  "readSnapshotFromDirectory",
  "resolveSnapshotsDirectory",
  "restoreDeltaSnapshot",
  "restoreSnapshotFromDirectory",
  "SnapshotMetadataSchema",
  "SnapshotRecordSchema",
  "writeSnapshotToDirectory",
  "CreateSnapshotInput",
  "DeltaSnapshotRecord",
  "MapDocumentDelta",
  "SnapshotDiff",
  "SnapshotDiffField",
  "SnapshotMetadata",
  "SnapshotRecord",
  "SnapshotsDirectoryOptions"
]);

const IGNORED_DIRS = new Set([
  ".git",
  ".next",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".turbo",
  ".pnpm-store"
]);

const EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts"]);

const WRITE = process.argv.includes("--write");

function parseSpecifierName(specifier) {
  const cleaned = specifier
    .trim()
    .replace(/^type\s+/u, "")
    .trim();

  // Esempi gestiti:
  // createMapSnapshot
  // createMapSnapshot as makeSnapshot
  // type SnapshotRecord
  const [name] = cleaned.split(/\s+as\s+/iu);
  return name.trim();
}

function normalizeImport(specifiers, source) {
  if (specifiers.length === 0) {
    return "";
  }

  const body = specifiers.map((entry) => `  ${entry.trim()}`).join(",\n");

  return `import {\n${body}\n} from "${source}";`;
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        files.push(...(await walk(fullPath)));
      }
      continue;
    }

    if (entry.isFile() && EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function fixContent(content) {
  let changed = false;

  const next = content.replace(
    /import\s*\{([\s\S]*?)\}\s*from\s*["']@dm-instamap\/core["'];/gu,
    (fullMatch, rawSpecifiers) => {
      const specifiers = rawSpecifiers
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      const coreSpecifiers = [];
      const snapshotSpecifiers = [];

      for (const specifier of specifiers) {
        const importedName = parseSpecifierName(specifier);

        if (SNAPSHOT_EXPORTS.has(importedName)) {
          snapshotSpecifiers.push(specifier);
        } else {
          coreSpecifiers.push(specifier);
        }
      }

      if (snapshotSpecifiers.length === 0) {
        return fullMatch;
      }

      changed = true;

      return [
        normalizeImport(coreSpecifiers, "@dm-instamap/core"),
        normalizeImport(snapshotSpecifiers, "@dm-instamap/core/snapshots")
      ]
        .filter(Boolean)
        .join("\n");
    }
  );

  return { changed, content: next };
}

const files = await walk(ROOT);
const changedFiles = [];

for (const file of files) {
  const content = await readFile(file, "utf8");
  const fixed = fixContent(content);

  if (fixed.changed) {
    changedFiles.push(path.relative(ROOT, file));

    if (WRITE) {
      await writeFile(file, fixed.content, "utf8");
    }
  }
}

if (changedFiles.length === 0) {
  console.log("Nessun import snapshot da correggere.");
} else {
  console.log(
    `${WRITE ? "Corretti" : "Da correggere"} ${changedFiles.length} file:`
  );
  for (const file of changedFiles) {
    console.log(`- ${file}`);
  }

  if (!WRITE) {
    console.log("");
    console.log("Dry-run completato. Per applicare davvero:");
    console.log("node scripts/fix-core-snapshot-imports.mjs --write");
  }
}
