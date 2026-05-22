import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { isSecurityBlocked } from "@/lib/security";

export const ADMIN_SESSION_COOKIE = "buyweb_admin_session";

export type AdminSession = {
  id: string;
  username: string;
  role: "ADMIN" | "STAFF";
};

function authSecret() {
  const value = process.env.AUTH_SECRET || "dev-secret-change-me-dev-secret-change-me";
  return new TextEncoder().encode(value);
}

export async function createAdminToken(admin: AdminSession) {
  return new SignJWT({
    username: admin.username,
    role: admin.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(admin.id)
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(authSecret());
}

export async function verifyAdminToken(token?: string | null): Promise<AdminSession | null> {
  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, authSecret());

    if (!payload.sub || typeof payload.username !== "string") {
      return null;
    }

    return {
      id: payload.sub,
      username: payload.username,
      role: payload.role === "ADMIN" ? "ADMIN" : "STAFF",
    };
  } catch {
    return null;
  }
}

export async function getAdminSession() {
  const cookieStore = await cookies();
  return getActiveAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
}

export async function requireAdminSession() {
  const session = await getAdminSession();

  if (!session) {
    return null;
  }

  return session;
}

export function getRequestCookie(request: Request, name: string) {
  const cookie = request.headers.get("cookie");

  if (!cookie) {
    return null;
  }

  const item = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  return item ? decodeURIComponent(item.slice(name.length + 1)) : null;
}

export async function requireAdminFromRequest(request: Request) {
  return getActiveAdminSession(getRequestCookie(request, ADMIN_SESSION_COOKIE));
}

async function getActiveAdminSession(token?: string | null): Promise<AdminSession | null> {
  const session = await verifyAdminToken(token);

  if (!session) {
    return null;
  }

  const admin = await prisma.adminUser.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      isActive: true,
      role: true,
      username: true,
    },
  });

  if (!admin || !admin.isActive) {
    return null;
  }

  if (await isSecurityBlocked("username", admin.username)) {
    return null;
  }

  return {
    id: admin.id,
    role: admin.role,
    username: admin.username,
  };
}

export function unauthorizedResponse() {
  return NextResponse.json({ message: "未登录或登录已过期" }, { status: 401 });
}

export function forbiddenResponse() {
  return NextResponse.json({ message: "当前账号无权限执行该操作" }, { status: 403 });
}
