import "server-only";
import { cookies } from "next/headers";
import { getIronSession, type IronSession } from "iron-session";

export type SessionData = {
  userId: string;
  email: string;
  fullName: string;
  roles: string[];
};

const sessionPassword = process.env.SESSION_SECRET;
if (!sessionPassword) {
  throw new Error("SESSION_SECRET is not set");
}

export const sessionOptions = {
  password: sessionPassword,
  cookieName: "tanza_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

export function hasRole(session: SessionData | undefined, role: string): boolean {
  return session?.roles.includes(role) ?? false;
}
