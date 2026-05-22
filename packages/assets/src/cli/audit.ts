import { auditAssets } from "../audit";

async function main(): Promise<void> {
  const audit = await auditAssets({
    outputRoot: process.env.INIT_CWD ?? process.cwd()
  });

  process.stdout.write(
    `${[
      `Audited ${audit.assetCount} assets.`,
      `Review queue: ${audit.needsReviewCount}.`,
      `Duplicate groups: ${audit.duplicateGroupCount}.`,
      `Low quality: ${audit.lowQualityCount}.`
    ].join("\n")}\n`
  );
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Unknown asset audit error."}\n`
  );
  process.exitCode = 1;
});
