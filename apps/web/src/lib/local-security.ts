const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

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
