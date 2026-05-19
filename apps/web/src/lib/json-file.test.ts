import { describe, expect, it } from "vitest";
import { parseJsonFileContent, stripByteOrderMark } from "./json-file";

describe("stripByteOrderMark", () => {
  it("removes a leading UTF-8 BOM decoded as a string", () => {
    expect(stripByteOrderMark("\uFEFF{\"ok\":true}")).toBe("{\"ok\":true}");
  });

  it("leaves regular JSON content unchanged", () => {
    expect(stripByteOrderMark("{\"ok\":true}")).toBe("{\"ok\":true}");
  });
});

describe("parseJsonFileContent", () => {
  it("parses BOM-prefixed JSON", () => {
    expect(parseJsonFileContent("\uFEFF{\"overrides\":{}}")).toEqual({
      overrides: {}
    });
  });
});
