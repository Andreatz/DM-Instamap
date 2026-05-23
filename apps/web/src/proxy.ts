import { NextResponse, type NextRequest } from "next/server";
import {
  checkRateLimit,
  rateLimitStore,
  readClientIp,
  readRateLimitPerMinute,
  shouldBlockByAllowlist,
  shouldBlockRemoteRequest
} from "./lib/local-security";

export function proxy(request: NextRequest) {
  if (shouldBlockRemoteRequest(request.headers.get("host"))) {
    return new NextResponse(
      "DM-Instamap non include autenticazione. Usalo solo da localhost o imposta DM_INSTAMAP_ALLOW_REMOTE=true consapevolmente.",
      { status: 403 }
    );
  }

  const clientIp = readClientIp(request.headers.get("x-forwarded-for"));

  if (shouldBlockByAllowlist(clientIp)) {
    return new NextResponse(
      "Indirizzo non autorizzato. Aggiungilo a DM_INSTAMAP_ALLOWED_IPS per consentirlo.",
      { status: 403 }
    );
  }

  const limit = readRateLimitPerMinute();

  if (limit > 0) {
    const decision = checkRateLimit(
      rateLimitStore,
      clientIp ?? "unknown",
      limit,
      Date.now()
    );

    if (!decision.allowed) {
      return new NextResponse(
        "Troppe richieste. Riprova tra poco o aumenta DM_INSTAMAP_RATE_LIMIT_PER_MINUTE.",
        {
          headers: {
            "Retry-After": String(Math.ceil(decision.retryAfterMs / 1000))
          },
          status: 429
        }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
