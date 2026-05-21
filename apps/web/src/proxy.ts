import { NextResponse, type NextRequest } from "next/server";
import { shouldBlockRemoteRequest } from "./lib/local-security";

export function proxy(request: NextRequest) {
  if (shouldBlockRemoteRequest(request.headers.get("host"))) {
    return new NextResponse(
      "DM-Instamap non include autenticazione. Usalo solo da localhost o imposta DM_INSTAMAP_ALLOW_REMOTE=true consapevolmente.",
      { status: 403 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
