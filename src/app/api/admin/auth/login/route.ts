import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { ADMIN_SESSION_COOKIE, createAdminToken } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import {
  assertSameOrigin,
  checkRateLimit,
  consumeRateLimit,
  getClientIp,
  ipRateLimitRule,
  logSecurityEvent,
  subjectRateLimitRule,
} from "@/lib/security";
import { adminLoginSchema, validationErrorMessage } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const originResponse = await assertSameOrigin(request);

    if (originResponse) {
      return originResponse;
    }

    const body = await request.json();
    const input = adminLoginSchema.parse(body);
    const clientIp = getClientIp(request);
    const limited = await consumeRateLimit([
      ipRateLimitRule(request, {
        blockDurationMs: 30 * 60 * 1000,
        eventType: "ADMIN_LOGIN_ATTEMPT",
        limit: 15,
        reason: "后台登录请求过于频繁",
        windowMs: 15 * 60 * 1000,
      }),
      subjectRateLimitRule("username", input.username, {
        blockDurationMs: 30 * 60 * 1000,
        eventType: "ADMIN_LOGIN_ATTEMPT",
        limit: 6,
        reason: "该后台账号登录尝试过于频繁",
        windowMs: 15 * 60 * 1000,
      }),
    ], request);

    if (limited) {
      return limited;
    }

    const failureLimited = await checkRateLimit([
      ipRateLimitRule(request, {
        blockDurationMs: 60 * 60 * 1000,
        eventType: "ADMIN_LOGIN_FAILED",
        limit: 8,
        reason: "后台登录失败次数过多",
        windowMs: 15 * 60 * 1000,
      }),
      subjectRateLimitRule("username", input.username, {
        blockDurationMs: 60 * 60 * 1000,
        eventType: "ADMIN_LOGIN_FAILED",
        limit: 4,
        reason: "该后台账号登录失败次数过多",
        windowMs: 15 * 60 * 1000,
      }),
    ], request);

    if (failureLimited) {
      return failureLimited;
    }

    const admin = await prisma.adminUser.findUnique({
      where: { username: input.username },
    });

    if (!admin || !admin.isActive) {
      await Promise.all([
        logSecurityEvent({
          eventType: "ADMIN_LOGIN_FAILED",
          identifier: clientIp,
          request,
          scope: "ip",
          subject: admin ? { id: admin.id, type: "admin" } : undefined,
        }),
        logSecurityEvent({
          eventType: "ADMIN_LOGIN_FAILED",
          identifier: input.username,
          ip: clientIp,
          request,
          scope: "username",
          subject: admin ? { id: admin.id, type: "admin" } : undefined,
        }),
      ]);

      return NextResponse.json({ message: "账号或密码错误" }, { status: 401 });
    }

    const valid = await bcrypt.compare(input.password, admin.passwordHash);

    if (!valid) {
      await Promise.all([
        logSecurityEvent({
          eventType: "ADMIN_LOGIN_FAILED",
          identifier: clientIp,
          request,
          scope: "ip",
          subject: { id: admin.id, type: "admin" },
        }),
        logSecurityEvent({
          eventType: "ADMIN_LOGIN_FAILED",
          identifier: input.username,
          ip: clientIp,
          request,
          scope: "username",
          subject: { id: admin.id, type: "admin" },
        }),
      ]);

      return NextResponse.json({ message: "账号或密码错误" }, { status: 401 });
    }

    const token = await createAdminToken({
      id: admin.id,
      username: admin.username,
      role: admin.role,
    });
    const response = NextResponse.json({ ok: true });

    response.cookies.set(ADMIN_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return response;
  } catch (error) {
    const message = validationErrorMessage(error, "登录失败");
    return NextResponse.json({ message }, { status: 400 });
  }
}
