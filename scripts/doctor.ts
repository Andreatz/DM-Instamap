import { access } from "node:fs/promises";
import { readFileSync } from "node:fs";
import net from "node:net";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export type DoctorStatus = "pass" | "warn" | "fail";

export type DoctorCheck = {
  details: string;
  name: string;
  status: DoctorStatus;
};

export type DoctorEnvironment = {
  envExampleExists: boolean;
  envLocalExampleExists: boolean;
  nodeVersion: string;
  pnpmVersion: string | null;
  pythonVersion: string | null;
  sharpInstalled: boolean;
  workerRequirementsExist: boolean;
  workerPortAvailable: boolean;
  webPortAvailable: boolean;
};

export function parseMajorVersion(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const match = value.match(/v?(\d+)/u);
  return match ? Number.parseInt(match[1] ?? "", 10) : null;
}

export function buildDoctorChecks(env: DoctorEnvironment): DoctorCheck[] {
  const nodeMajor = parseMajorVersion(env.nodeVersion);
  const pnpmMajor = parseMajorVersion(env.pnpmVersion);
  const pythonMajorMinor = env.pythonVersion?.match(/Python\s+(\d+)\.(\d+)/u);
  const pythonOk = pythonMajorMinor
    ? Number.parseInt(pythonMajorMinor[1] ?? "0", 10) > 3 ||
      (Number.parseInt(pythonMajorMinor[1] ?? "0", 10) === 3 && Number.parseInt(pythonMajorMinor[2] ?? "0", 10) >= 12)
    : false;

  return [
    {
      details: env.nodeVersion,
      name: "Node.js >= 24",
      status: nodeMajor !== null && nodeMajor >= 24 ? "pass" : "fail"
    },
    {
      details: env.pnpmVersion ?? "pnpm non trovato",
      name: "pnpm >= 10",
      status: pnpmMajor !== null && pnpmMajor >= 10 ? "pass" : "fail"
    },
    {
      details: env.pythonVersion ?? "Python non trovato",
      name: "Python >= 3.12",
      status: pythonOk ? "pass" : "warn"
    },
    {
      details: env.workerRequirementsExist ? "apps/worker/requirements-dev.txt presente" : "file requirements worker mancante",
      name: "Dipendenze worker",
      status: env.workerRequirementsExist ? "pass" : "fail"
    },
    {
      details: env.sharpInstalled ? "sharp risolvibile da node_modules" : "sharp non risolto, esegui pnpm install",
      name: "Sharp",
      status: env.sharpInstalled ? "pass" : "fail"
    },
    {
      details: env.envExampleExists && env.envLocalExampleExists ? ".env.example e .env.local.example presenti" : "template env incompleti",
      name: "Template env",
      status: env.envExampleExists && env.envLocalExampleExists ? "pass" : "warn"
    },
    {
      details: env.webPortAvailable ? "porta 3000 libera" : "porta 3000 occupata",
      name: "Porta web",
      status: env.webPortAvailable ? "pass" : "warn"
    },
    {
      details: env.workerPortAvailable ? "porta 8000 libera" : "porta 8000 occupata",
      name: "Porta worker",
      status: env.workerPortAvailable ? "pass" : "warn"
    }
  ];
}

export async function collectDoctorEnvironment(root = process.cwd()): Promise<DoctorEnvironment> {
  return {
    envExampleExists: await pathExists(path.join(root, ".env.example")),
    envLocalExampleExists: await pathExists(path.join(root, ".env.local.example")),
    nodeVersion: process.version,
    pnpmVersion:
      readCommandVersion(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["--version"]) ??
      readPnpmVersionFromEnv() ??
      readPnpmVersionFromPackageJson(root),
    pythonVersion: readCommandVersion("python", ["--version"]),
    sharpInstalled: canResolveSharp(root),
    workerPortAvailable: await isPortAvailable(8000),
    workerRequirementsExist: await pathExists(path.join(root, "apps", "worker", "requirements-dev.txt")),
    webPortAvailable: await isPortAvailable(3000)
  };
}

export async function runDoctor(root = process.cwd()): Promise<DoctorCheck[]> {
  return buildDoctorChecks(await collectDoctorEnvironment(root));
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function readCommandVersion(command: string, args: string[]): string | null {
  try {
    return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return null;
  }
}

function readPnpmVersionFromEnv(): string | null {
  const userAgent = process.env.npm_config_user_agent ?? "";
  const match = userAgent.match(/pnpm\/([0-9.]+)/u);
  return match?.[1] ?? null;
}

function readPnpmVersionFromPackageJson(root: string): string | null {
  try {
    const manifest = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
      packageManager?: string;
    };
    const match = manifest.packageManager?.match(/^pnpm@([0-9.]+)/u);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function canResolveSharp(root: string): boolean {
  try {
    const require = createRequire(path.join(root, "package.json"));
    require.resolve("sharp");
    return true;
  } catch {
    return false;
  }
}

async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

function printChecks(checks: DoctorCheck[]): void {
  for (const check of checks) {
    const marker = check.status === "pass" ? "PASS" : check.status === "warn" ? "WARN" : "FAIL";
    console.log(`${marker} ${check.name}: ${check.details}`);
  }
}

if (process.argv.some((arg) => arg.replace(/\\/gu, "/").endsWith("scripts/doctor.ts"))) {
  void runDoctor().then((checks) => {
    printChecks(checks);
    process.exitCode = checks.some((check) => check.status === "fail") ? 1 : 0;
  });
}
