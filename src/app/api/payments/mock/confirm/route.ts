import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { applyMockPaymentSuccess } from "@/lib/purchase";
import {
  assertSameOrigin,
  consumeRateLimit,
  ipRateLimitRule,
  securityMaintenanceResponse,
  subjectRateLimitRule,
} from "@/lib/security";
import { getUserFromRequest, userUnauthorizedResponse } from "@/lib/user-auth";

export async function POST(request: Request) {
  try {
    const originResponse = await assertSameOrigin(request);

    if (originResponse) {
      return originResponse;
    }

    const maintenance = securityMaintenanceResponse("PAYMENT_WRITE_DISABLED", "当前支付确认暂时维护，请稍后再试");

    if (maintenance) {
      return maintenance;
    }

    const user = await getUserFromRequest(request);

    if (!user) {
      return userUnauthorizedResponse();
    }

    const body = (await request.json()) as { orderNo?: string };

    if (!body.orderNo) {
      return NextResponse.json({ message: "缺少订单号" }, { status: 400 });
    }

    const order = await prisma.order.findFirst({
      where: {
        orderNo: body.orderNo,
        userId: user.id,
      },
      select: { id: true },
    });

    if (!order) {
      return NextResponse.json({ message: "订单不存在" }, { status: 404 });
    }

    const limited = await consumeRateLimit([
      ipRateLimitRule(request, {
        eventType: "PAYMENT_MOCK_CONFIRM_ATTEMPT",
        limit: 20,
        reason: "模拟支付确认过于频繁",
        windowMs: 10 * 60 * 1000,
      }),
      subjectRateLimitRule("user", user.id, {
        eventType: "PAYMENT_MOCK_CONFIRM_ATTEMPT",
        limit: 12,
        reason: "该账号模拟支付确认过于频繁",
        windowMs: 10 * 60 * 1000,
      }),
      subjectRateLimitRule("order", body.orderNo, {
        eventType: "PAYMENT_MOCK_CONFIRM_ATTEMPT",
        limit: 5,
        reason: "该订单模拟支付确认过于频繁",
        windowMs: 10 * 60 * 1000,
      }),
    ], request, { id: user.id, type: "user" });

    if (limited) {
      return limited;
    }

    const result = await applyMockPaymentSuccess(body.orderNo);
    return NextResponse.json({ ok: true, order: result.order, payment: result.payment });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "模拟支付失败" },
      { status: 400 },
    );
  }
}
