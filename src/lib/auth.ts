import "server-only";
import { redirect } from "next/navigation";
import { getSession, hasRole, type SessionData } from "./session";

/**
 * Server-side guard for use at the top of pages/layouts and server actions.
 * Proxy (proxy.ts) does a fast first-pass redirect on route trees, but every
 * server action/loader re-checks here too — Proxy alone isn't trusted
 * (per Next.js's own guidance: a matcher change can silently remove Proxy
 * coverage on a route without anyone noticing).
 */
export async function requireUser(): Promise<SessionData> {
  const session = await getSession();
  if (!session.userId) {
    redirect("/login");
  }
  return session as SessionData;
}

export async function requireRole(role: string): Promise<SessionData> {
  const session = await requireUser();
  if (!hasRole(session, role)) {
    redirect("/forbidden");
  }
  return session;
}
