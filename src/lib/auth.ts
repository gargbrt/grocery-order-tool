import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET as string;
const COOKIE_NAME = "session";

if (!JWT_SECRET && process.env.NODE_ENV === "production") {
  // Fail loudly rather than silently signing tokens with "undefined"
  throw new Error("JWT_SECRET env var is required");
}

export type SessionPayload = {
  userId: string;
  storeId: string;
  role: "OWNER" | "HELPER";
};

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export function signSession(payload: SessionPayload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

export function verifySession(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionPayload;
  } catch {
    return null;
  }
}

// Reads the session from the request cookie. Returns null if not logged in.
// NOTE: this relies on Next.js server context (route handlers / server components).
export function getSession(): SessionPayload | null {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
