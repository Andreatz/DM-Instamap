const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const LOCAL_IPS = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

type SecurityEnv = Record<string, string | undefined>;

export function isRemoteAccessAllowed(env: SecurityEnv = process.env): boolean {
  return env.DM_INSTAMAP_ALLOW_REMOTE === "true";
}

export function isLocalHostHeader(hostHeader: string | null): boolean {
  if (!hostHeader) {
    return true;
  }

  const host = hostHeader.split(":")[0]?.toLowerCase() ?? "";
  return LOCAL_HOSTS.has(host);
}

export function shouldBlockRemoteRequest(
  hostHeader: string | null,
  env: SecurityEnv = process.env
): boolean {
  return !isRemoteAccessAllowed(env) && !isLocalHostHeader(hostHeader);
}

// --- LAN allowlist -------------------------------------------------------
// When remote access is enabled (DM_INSTAMAP_ALLOW_REMOTE=true) the app has no
// authentication, so an optional IP allowlist lets the operator restrict which
// LAN clients may connect. An empty allowlist means "no extra restriction"
// (every host already permitted by the remote flag stays permitted).

export function parseAllowedClientIps(
  env: SecurityEnv = process.env
): string[] {
  return (env.DM_INSTAMAP_ALLOWED_IPS ?? "")
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean);
}

/** Read the first hop of an `x-forwarded-for` header (the original client). */
export function readClientIp(forwardedFor: string | null): string | null {
  if (!forwardedFor) {
    return null;
  }

  const first = forwardedFor.split(",")[0]?.trim();
  return first ? first : null;
}

export function isLocalClientIp(clientIp: string | null): boolean {
  return clientIp !== null && LOCAL_IPS.has(clientIp);
}

/**
 * Block a request only when an allowlist is configured and the client IP is
 * neither local nor on the list. Local clients are always allowed; an empty
 * allowlist never blocks.
 */
export function shouldBlockByAllowlist(
  clientIp: string | null,
  env: SecurityEnv = process.env
): boolean {
  const allowlist = parseAllowedClientIps(env);

  if (allowlist.length === 0 || isLocalClientIp(clientIp)) {
    return false;
  }

  return clientIp === null || !allowlist.includes(clientIp);
}

// --- Best-effort rate limiting ------------------------------------------
// A fixed-window counter, kept as a pure function so it can be tested with an
// explicit clock. The store is an in-memory Map; in the local-first single
// process deployment (`next start`) this is shared across requests. It is a
// safety valve against accidental floods on a permitted LAN, not a hardened
// defense.

export type RateLimitEntry = {
  count: number;
  windowStart: number;
};

export type RateLimitStore = Map<string, RateLimitEntry>;

export type RateLimitDecision = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

export function readRateLimitPerMinute(env: SecurityEnv = process.env): number {
  const raw = Number.parseInt(env.DM_INSTAMAP_RATE_LIMIT_PER_MINUTE ?? "", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

export function checkRateLimit(
  store: RateLimitStore,
  key: string,
  limit: number,
  now: number,
  windowMs = 60_000
): RateLimitDecision {
  if (limit <= 0) {
    return {
      allowed: true,
      remaining: Number.POSITIVE_INFINITY,
      retryAfterMs: 0
    };
  }

  const entry = store.get(key);

  if (!entry || now - entry.windowStart >= windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
  }

  entry.count += 1;

  if (entry.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: windowMs - (now - entry.windowStart)
    };
  }

  return { allowed: true, remaining: limit - entry.count, retryAfterMs: 0 };
}

/** Shared store for the running process; the proxy uses this singleton. */
export const rateLimitStore: RateLimitStore = new Map();
