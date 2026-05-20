import { generateReferenceStyleDna } from "../reference-style";

async function main(): Promise<void> {
  const outputRoot = process.env.INIT_CWD ?? process.cwd();
  const result = await generateReferenceStyleDna({ outputRoot });

  process.stdout.write(`Generated Style DNA for ${result.styles.length} reference maps.\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Unknown reference style error."}\n`);
  process.exitCode = 1;
});
