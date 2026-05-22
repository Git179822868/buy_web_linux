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
  securityMaintenanceResponse,
  subjectRateLimitRule,
} from "@/lib/security";
import { createUserToken, USER_SESSION_COOKIE } from "@/lib/user-auth";
import { userRegisterSchema, validationErrorMessage } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const originResponse = await assertSameOrigin(request);

    if (originResponse) {
      return originResponse;
    }

    const maintenance = securityMaintenanceResponse("REGISTRATION_DISABLED", "当前注册暂时关闭，请稍后再试");

    if (maintenance) {
      return maintenance;
    }

    const input = userRegisterSchema.parse(await request.json());
    const clientIp = getClientIp(request);
    const limited = await consumeRateLimit([
      ipRateLimitRule(request, {
        blockDurationMs: 60 * 60 * 1000,
        eventType: "AUTH_REGISTER_ATTEMPT",
        limit: 8,
        reason: "注册请求过于频繁",
        windowMs: 60 * 60 * 1000,
      }),
      subjectRateLimitRule("phone", input.phone, {
        eventType: "AUTH_REGISTER_ATTEMPT",
        limit: 3,
        reason: "该手机号注册尝试过于频繁",
        windowMs: 60 * 60 * 1000,
      }),
    ], request);

    if (limited) {
      return limited;
    }

    const captchaLimited = await checkRateLimit([
      ipRateLimitRule(request, {
        blockDurationMs: 30 * 60 * 1000,
        eventType: "AUTH_CAPTCHA_FAILED",
        limit: 10,
        reason: "验证码错误过多",
        windowMs: 15 * 60 * 1000,
      }),
      subjectRateLimitRule("phone", input.phone, {
        eventType: "AUTH_CAPTCHA_FAILED",
        limit: 5,
        reason: "该手机号验证码错误过多",
        windowMs: 15 * 60 * 1000,
      }),
    ], request);

    if (captchaLimited) {
      return captchaLimited;
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

    const existing = await prisma.user.findUnique({ where: { phone: input.phone } });

    if (existing) {
      await logSecurityEvent({
        eventType: "AUTH_REGISTER_DUPLICATE",
        identifier: input.phone,
        ip: clientIp,
        request,
        scope: "phone",
        subject: { id: existing.id, type: "user" },
      });

      return NextResponse.json({ message: "该手机号已注册，请直接登录" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await prisma.user.create({
      data: {
        phone: input.phone,
        passwordHash,
        nickname: `用户${input.phone.slice(-4)}`,
      },
    });

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
    const message = validationErrorMessage(error, "注册失败");
    return NextResponse.json({ message }, { status: 400 });
  }
}
