import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { unsealData } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";

// Fast first-pass route guard (Next.js 16 renamed `middleware` -> `proxy`).
// This is a coarse gate only — every server action/page still calls
// requireUser()/requireRole() itself (see src/lib/auth.ts), because a
// matcher change here could silently stop covering a route and nothing
// else would catch it.

const ADMIN_PREFIX = "/admin";
const AUTHENTICATED_PREFIXES = ["/learn", "/me", ADMIN_PREFIX];

async function readSession(request: NextRequest): Promise<SessionData | null> {
  const cookie = request.cookies.get(sessionOptions.cookieName)?.value;
  if (!cookie) return null;
  try {
    return await unsealData<SessionData>(cookie, { password: sessionOptions.password });
  } catch {
    return null; // tampered/expired/undecryptable cookie == not authenticated
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const needsAuth = AUTHENTICATED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  if (!needsAuth) {
    return NextResponse.next();
  }

  const session = await readSession(request);
  if (!session?.userId) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const needsAdmin = pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`);
  if (needsAdmin && !session.roles.includes("admin")) {
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|forbidden|login|signup).*)",
  ],
};
