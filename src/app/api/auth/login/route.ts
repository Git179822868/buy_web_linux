import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { verifyCaptchaChallenge } from "@/lib/captcha";
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
import { createUserToken, USER_SESSION_COOKIE } from "@/lib/user-auth";
import { userLoginSchema, validationErrorMessage } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const originResponse = await assertSameOrigin(request);

    if (originResponse) {
      return originResponse;
    }

    const input = userLoginSchema.parse(await request.json());
    const clientIp = getClientIp(request);
    const limited = await consumeRateLimit([
      ipRateLimitRule(request, {
        eventType: "AUTH_LOGIN_ATTEMPT",
        limit: 30,
        reason: "登录请求过于频繁",
        windowMs: 15 * 60 * 1000,
      }),
      subjectRateLimitRule("phone", input.phone, {
        eventType: "AUTH_LOGIN_ATTEMPT",
        limit: 12,
        reason: "该手机号登录尝试过于频繁",
        windowMs: 15 * 60 * 1000,
      }),
    ], request);

    if (limited) {
      return limited;
    }

    const failureLimited = await checkRateLimit([
      ipRateLimitRule(request, {
        blockDurationMs: 30 * 60 * 1000,
        eventType: "AUTH_LOGIN_FAILED",
        limit: 15,
        reason: "登录失败次数过多",
        windowMs: 15 * 60 * 1000,
      }),
      subjectRateLimitRule("phone", input.phone, {
        eventType: "AUTH_LOGIN_FAILED",
        limit: 6,
        reason: "该手机号登录失败次数过多",
        windowMs: 15 * 60 * 1000,
      }),
    ], request);

    if (failureLimited) {
      return failureLimited;
    }

    if (!verifyCaptchaChallenge(input.captchaToken, input.captchaAnswer)) {
      await Promise.all([
        logSecurityEvent({
          eventType: "AUTH_CAPTCHA_FAILED",
          identifier: clientIp,
          request,
          scope: "ip",
        }),
        logSecurityEvent({
          eventType: "AUTH_CAPTCHA_FAILED",
          identifier: input.phone,
          ip: clientIp,
          request,
          scope: "phone",
        }),
      ]);

      return NextResponse.json({ message: "验证码错误或已过期" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { phone: input.phone } });

    if (!user || user.status !== "ACTIVE") {
      await Promise.all([
        logSecurityEvent({
          eventType: "AUTH_LOGIN_FAILED",
          identifier: clientIp,
          request,
          scope: "ip",
          subject: user ? { id: user.id, type: "user" } : undefined,
        }),
        logSecurityEvent({
          eventType: "AUTH_LOGIN_FAILED",
          identifier: input.phone,
          ip: clientIp,
          request,
          scope: "phone",
          subject: user ? { id: user.id, type: "user" } : undefined,
        }),
      ]);

      return NextResponse.json({ message: "手机号或密码错误" }, { status: 401 });
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);

    if (!valid) {
      await Promise.all([
        logSecurityEvent({
          eventType: "AUTH_LOGIN_FAILED",
          identifier: clientIp,
          request,
          scope: "ip",
          subject: { id: user.id, type: "user" },
        }),
        logSecurityEvent({
          eventType: "AUTH_LOGIN_FAILED",
          identifier: input.phone,
          ip: clientIp,
          request,
          scope: "phone",
          subject: { id: user.id, type: "user" },
        }),
      ]);

      return NextResponse.json({ message: "手机号或密码错误" }, { status: 401 });
    }

    const token = await createUserToken({ id: user.id, phone: user.phone });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(USER_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch (error) {
    const message = validationErrorMessage(error, "登录失败");
    return NextResponse.json({ message }, { status: 400 });
  }
}
