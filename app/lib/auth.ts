import crypto from "crypto";
import { compare as bcryptCompare, hash as bcryptHash } from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export const SESSION_COOKIE_NAME = "bmo_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
export const MIN_PASSWORD_LENGTH = 8;
export const BLOCKED_ACCOUNT_MESSAGE =
  "Tu cuenta esta bloqueada. Contacta con el administrador.";

export type AuthSession = {
  userId: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  companyId: string | null;
  exp: number;
};

type PublicUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  companyId: string | null;
};

export type AuthUser = PublicUser;
type AuthOptions = {
  allowBlocked?: boolean;
};

const getSecret = () => {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET_MISSING");
  }

  return secret || "dev-secret-change-me";
};

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function hashPassword(password: string) {
  return bcryptHash(password, 12);
}

export async function verifyPassword(password: string, storedHash: string) {
  if (isBcryptHash(storedHash)) {
    return bcryptCompare(password, storedHash);
  }

  const [salt, hash] = storedHash.split(":");

  if (!salt || !hash) return false;

  const candidate = await scrypt(password, salt);
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(candidate, "hex"));
}

export function needsPasswordRehash(storedHash: string) {
  return !isBcryptHash(storedHash);
}

export function isAdminRole(role: string | null | undefined) {
  return role === "admin";
}

export function isBlockedStatus(status: string | null | undefined) {
  return status === "blocked";
}

export function isSuspendedStatus(status: string | null | undefined) {
  return status === "suspended";
}

export function validatePassword(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `La contrasena debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`;
  }

  return null;
}

export function forbidden(message = "Prohibido") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function createPasswordResetToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function hashPasswordResetToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createSessionToken(user: PublicUser) {
  const payload: AuthSession = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    companyId: user.companyId,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  };

  const encodedPayload = base64url(JSON.stringify(payload));
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token?: string | null): AuthSession | null {
  if (!token) return null;

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = sign(encodedPayload);
  if (!safeEqual(signature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString()) as AuthSession;

    if (!payload.userId || !payload.email || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}

export async function getAuthSession(req: Request, options: AuthOptions = {}) {
  const cookieHeader = req.headers.get("cookie") || "";
  const token = getCookieValue(cookieHeader, SESSION_COOKIE_NAME);
  const session = verifySessionToken(token);

  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      companyId: true,
    },
  });

  if (user && isBlockedStatus(user.status) && !options.allowBlocked) {
    return null;
  }

  return user;
}

export async function getSessionUserFromToken(token?: string | null, options: AuthOptions = {}) {
  const session = verifySessionToken(token);

  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      companyId: true,
    },
  });

  if (user && isBlockedStatus(user.status) && !options.allowBlocked) {
    return null;
  }

  return user;
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function unauthorized() {
  return NextResponse.json({ error: "No autorizado" }, { status: 401 });
}

function scrypt(password: string, salt: string) {
  return new Promise<string>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey.toString("hex"));
    });
  });
}

function sign(value: string) {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("base64url");
}

function base64url(value: string) {
  return Buffer.from(value).toString("base64url");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) return false;

  return crypto.timingSafeEqual(left, right);
}

function getCookieValue(cookieHeader: string, name: string) {
  return cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.split("=")[1];
}

function isBcryptHash(value: string) {
  return value.startsWith("$2a$") || value.startsWith("$2b$") || value.startsWith("$2y$");
}
