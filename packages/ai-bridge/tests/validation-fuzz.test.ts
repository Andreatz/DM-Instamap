import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { validateBridgeResponse } from "../src";

const ASSERT = { numRuns: 500, seed: 0xa1_b2 } as const;

describe("validateBridgeResponse fuzz", () => {
  it("never throws and always returns a well-formed result", () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const result = validateBridgeResponse(input);

        if (result.ok) {
          expect(result.data).toBeDefined();
        } else {
          expect(Array.isArray(result.errors)).toBe(true);
          expect(result.errors.length).toBeGreaterThan(0);
        }
      }),
      ASSERT
    );
  });

  it("rejects arbitrary JSON values that are not valid plans", () => {
    fc.assert(
      fc.property(
        fc.jsonValue().filter((value) => {
          // Keep only payloads that obviously cannot be a MapPlan.
          return (
            value === null ||
            typeof value !== "object" ||
            Array.isArray(value) ||
            !("rooms" in (value as Record<string, unknown>))
          );
        }),
        (value) => {
          const result = validateBridgeResponse(JSON.stringify(value));
          expect(result.ok).toBe(false);
        }
      ),
      ASSERT
    );
  });

  it("handles fenced code blocks without crashing", () => {
    fc.assert(
      fc.property(fc.string(), (inner) => {
        const fenced = `\`\`\`json\n${inner}\n\`\`\``;
        expect(() => validateBridgeResponse(fenced)).not.toThrow();
      }),
      ASSERT
    );
  });
});
