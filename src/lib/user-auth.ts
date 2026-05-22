import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { isSecurityBlocked } from "@/lib/security";

export const USER_SESSION_COOKIE = "buyweb_user_session";

export type UserSession = {
  id: string;
  phone: string;
};

function userSecret() {
  const value = process.env.AUTH_SECRET || "dev-secret-change-me-dev-secret-change-me";
  return new TextEncoder().encode(`${value}:user`);
}

export async function createUserToken(user: UserSession) {
  return new SignJWT({ phone: user.phone })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(userSecret());
}

export async function verifyUserToken(token?: string | null): Promise<UserSession | null> {
  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, userSecret());

    if (!payload.sub || typeof payload.phone !== "string") {
      return null;
    }

    return {
      id: payload.sub,
      phone: payload.phone,
    };
  } catch {
    return null;
  }
}

export async function getUserSession() {
  const cookieStore = await cookies();
  return getActiveUserSession(cookieStore.get(USER_SESSION_COOKIE)?.value);
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

export async function getUserFromRequest(request: Request) {
  return getActiveUserSession(getRequestCookie(request, USER_SESSION_COOKIE));
}

async function getActiveUserSession(token?: string | null): Promise<UserSession | null> {
  const session = await verifyUserToken(token);

  if (!session) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      phone: true,
      status: true,
    },
  });

  if (!user || user.status !== "ACTIVE") {
    return null;
  }

  if (await isSecurityBlocked("user", user.id)) {
    return null;
  }

  return {
    id: user.id,
    phone: user.phone,
  };
}

export function userUnauthorizedResponse() {
  return NextResponse.json({ message: "请先登录后再购买" }, { status: 401 });
}
