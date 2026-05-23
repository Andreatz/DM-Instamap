import { describe, expect, it } from "vitest";
import {
  checkRateLimit,
  isLocalHostHeader,
  isRemoteAccessAllowed,
  parseAllowedClientIps,
  readClientIp,
  readRateLimitPerMinute,
  shouldBlockByAllowlist,
  shouldBlockRemoteRequest,
  type RateLimitStore
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

describe("LAN allowlist", () => {
  it("parses and trims a comma-separated allowlist", () => {
    expect(
      parseAllowedClientIps({
        DM_INSTAMAP_ALLOWED_IPS: " 192.168.1.5, 10.0.0.2 "
      })
    ).toEqual(["192.168.1.5", "10.0.0.2"]);
    expect(parseAllowedClientIps({})).toEqual([]);
  });

  it("reads the first hop of x-forwarded-for", () => {
    expect(readClientIp("192.168.1.5, 10.0.0.1")).toBe("192.168.1.5");
    expect(readClientIp(null)).toBeNull();
    expect(readClientIp("")).toBeNull();
  });

  it("never blocks when no allowlist is configured", () => {
    expect(shouldBlockByAllowlist("203.0.113.9", {})).toBe(false);
  });

  it("always allows local clients regardless of the allowlist", () => {
    expect(
      shouldBlockByAllowlist("127.0.0.1", {
        DM_INSTAMAP_ALLOWED_IPS: "192.168.1.5"
      })
    ).toBe(false);
  });

  it("blocks clients outside a configured allowlist", () => {
    const env = { DM_INSTAMAP_ALLOWED_IPS: "192.168.1.5" };
    expect(shouldBlockByAllowlist("192.168.1.5", env)).toBe(false);
    expect(shouldBlockByAllowlist("192.168.1.99", env)).toBe(true);
    expect(shouldBlockByAllowlist(null, env)).toBe(true);
  });
});

describe("rate limiting", () => {
  it("treats a missing or invalid limit as disabled", () => {
    expect(readRateLimitPerMinute({})).toBe(0);
    expect(
      readRateLimitPerMinute({ DM_INSTAMAP_RATE_LIMIT_PER_MINUTE: "x" })
    ).toBe(0);
    expect(
      readRateLimitPerMinute({ DM_INSTAMAP_RATE_LIMIT_PER_MINUTE: "120" })
    ).toBe(120);
  });

  it("allows every request when the limit is zero", () => {
    const store: RateLimitStore = new Map();
    for (let i = 0; i < 50; i += 1) {
      expect(checkRateLimit(store, "ip", 0, i).allowed).toBe(true);
    }
  });

  it("blocks once the window limit is exceeded", () => {
    const store: RateLimitStore = new Map();
    expect(checkRateLimit(store, "ip", 2, 0).allowed).toBe(true);
    expect(checkRateLimit(store, "ip", 2, 10).allowed).toBe(true);
    const blocked = checkRateLimit(store, "ip", 2, 20);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("resets after the window elapses", () => {
    const store: RateLimitStore = new Map();
    checkRateLimit(store, "ip", 1, 0);
    expect(checkRateLimit(store, "ip", 1, 100).allowed).toBe(false);
    expect(checkRateLimit(store, "ip", 1, 60_000).allowed).toBe(true);
  });

  it("tracks separate keys independently", () => {
    const store: RateLimitStore = new Map();
    expect(checkRateLimit(store, "a", 1, 0).allowed).toBe(true);
    expect(checkRateLimit(store, "b", 1, 0).allowed).toBe(true);
    expect(checkRateLimit(store, "a", 1, 5).allowed).toBe(false);
  });
});
