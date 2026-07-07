"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSession } from "@/lib/session";
import { verifyPassword } from "@/lib/password";
import { loginSchema } from "@/lib/validation/auth";

export type LoginState = { error?: string };

/** Only redirect to a same-origin relative path — never trust `next` verbatim (open-redirect guard). */
function safeNextPath(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }
  return value;
}

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }
  const { email, password } = parsed.data;

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
    with: { userRoles: { with: { role: true } } },
  });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Invalid email or password." };
  }
  if (user.status !== "active") {
    return { error: "This account has been deactivated." };
  }

  const roleNames = user.userRoles.map((ur) => ur.role.name);

  const session = await getSession();
  session.userId = user.id;
  session.email = user.email;
  session.fullName = user.fullName;
  session.roles = roleNames;
  await session.save();

  const next = safeNextPath(formData.get("next"));
  redirect(next ?? (roleNames.includes("admin") ? "/admin" : "/learn"));
}
