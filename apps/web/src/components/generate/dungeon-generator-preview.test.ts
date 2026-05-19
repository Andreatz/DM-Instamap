import { describe, expect, it } from "vitest";
import { parseRequiredRooms } from "./generator-form";

describe("parseRequiredRooms", () => {
  it("normalizes comma-separated required room names", () => {
    expect(parseRequiredRooms("boss, library, boss, ")).toEqual(["boss", "library"]);
  });
});
