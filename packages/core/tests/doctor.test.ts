import { describe, expect, it } from "vitest";
import { buildDoctorChecks, parseMajorVersion } from "../../../scripts/doctor";

describe("doctor helpers", () => {
  it("parses major versions from common command outputs", () => {
    expect(parseMajorVersion("v24.10.1")).toBe(24);
    expect(parseMajorVersion("10.33.3")).toBe(10);
    expect(parseMajorVersion(null)).toBeNull();
  });

  it("builds failing checks for missing required tooling", () => {
    const checks = buildDoctorChecks({
      envExampleExists: true,
      envLocalExampleExists: false,
      nodeVersion: "v22.0.0",
      pnpmVersion: null,
      pythonVersion: "Python 3.11.9",
      sharpInstalled: false,
      webPortAvailable: false,
      workerPortAvailable: true,
      workerRequirementsExist: true
    });

    expect(checks.find((check) => check.name === "Node.js >= 24")?.status).toBe(
      "fail"
    );
    expect(checks.find((check) => check.name === "pnpm >= 10")?.status).toBe(
      "fail"
    );
    expect(
      checks.find((check) => check.name === "Python >= 3.12")?.status
    ).toBe("warn");
    expect(checks.find((check) => check.name === "Sharp")?.status).toBe("fail");
    expect(checks.find((check) => check.name === "Template env")?.status).toBe(
      "warn"
    );
  });
});
