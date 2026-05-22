import { describe, expect, it } from "vitest";
import {
  isLocalHostHeader,
  isRemoteAccessAllowed,
  shouldBlockRemoteRequest
} from "./local-security";

describe("local-security", () => {
  it("allows localhost host headers by default", () => {
    expect(isLocalHostHeader("localhost:3000")).toBe(true);
    expect(isLocalHostHeader("127.0.0.1:3000")).toBe(true);
    expect(shouldBlockRemoteRequest("localhost:3000", {})).toBe(false);
  });

  it("blocks remote host headers unless explicitly allowed", () => {
    expect(shouldBlockRemoteRequest("dm-instamap.example.com", {})).toBe(true);
    expect(
      shouldBlockRemoteRequest("dm-instamap.example.com", {
        DM_INSTAMAP_ALLOW_REMOTE: "true"
      })
    ).toBe(false);
  });

  it("requires the exact true flag for remote access", () => {
    expect(isRemoteAccessAllowed({ DM_INSTAMAP_ALLOW_REMOTE: "1" })).toBe(
      false
    );
    expect(isRemoteAccessAllowed({ DM_INSTAMAP_ALLOW_REMOTE: "true" })).toBe(
      true
    );
  });
});
