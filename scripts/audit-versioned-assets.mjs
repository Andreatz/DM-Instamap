import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import path from "node:path";

const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8"
}).trim();

const trackedFiles = execFileSync("git", ["ls-files", "-z"], {
  cwd: repoRoot
})
  .toString("utf8")
  .split("\0")
  .filter(Boolean)
  .map((file) => file.replace(/\\/g, "/"));

const forbiddenPrefixes = [
  "data/indexes/",
  "data/previews/",
  "data/projects/",
  "data/exports/",
  "data/raw-assets/",
  "local-assets/",
  "local-references/",
  "assets-local/",
  "reference-maps-local/"
];

const binaryExtensions = new Set([
  ".avif",
  ".bmp",
  ".dungeondraft_pack",
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".psd",
  ".tga",
  ".tif",
  ".tiff",
  ".webp",
  ".zip"
]);

const allowedBinaryPrefixes = ["packages/", "apps/", "tests/"];
const maxVersionedBinaryBytes = 1024 * 1024;

const forbiddenFiles = trackedFiles.filter((file) =>
  forbiddenPrefixes.some((prefix) => file === prefix.slice(0, -1) || file.startsWith(prefix))
);

const oversizedBinaries = trackedFiles.filter((file) => {
  const extension = path.extname(file).toLowerCase();

  if (!binaryExtensions.has(extension)) {
    return false;
  }

  if (!allowedBinaryPrefixes.some((prefix) => file.startsWith(prefix))) {
    return true;
  }

  const absolutePath = path.join(repoRoot, file);
  const size = statSync(absolutePath).size;
  return size > maxVersionedBinaryBytes;
});

if (forbiddenFiles.length > 0 || oversizedBinaries.length > 0) {
  console.error("Repository asset audit failed.");

  if (forbiddenFiles.length > 0) {
    console.error("\nGenerated/local data must not be tracked:");
    for (const file of forbiddenFiles.slice(0, 40)) {
      console.error(`- ${file}`);
    }
    if (forbiddenFiles.length > 40) {
      console.error(`...and ${forbiddenFiles.length - 40} more.`);
    }
  }

  if (oversizedBinaries.length > 0) {
    console.error("\nUnexpected binary assets are tracked:");
    for (const file of oversizedBinaries.slice(0, 40)) {
      console.error(`- ${file}`);
    }
    if (oversizedBinaries.length > 40) {
      console.error(`...and ${oversizedBinaries.length - 40} more.`);
    }
  }

  console.error("\nUse local data folders for asset libraries and generated previews.");
  process.exit(1);
}

console.log("Repository asset audit passed.");
