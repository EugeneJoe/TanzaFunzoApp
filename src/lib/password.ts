import bcrypt from "bcryptjs";

// Deliberately NOT "server-only": db/seed.ts imports this directly via tsx,
// outside Next's bundler, where the server-only guard would throw.

const SALT_ROUNDS = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
