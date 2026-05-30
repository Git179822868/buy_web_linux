import { NextResponse } from "next/server";

import { paymentFailureReason } from "@/lib/payment-failure";
import { createPaymentForOrder, getClientIp } from "@/lib/purchase";
import { prisma } from "@/lib/prisma";
import {
  assertSameOrigin,
  consumeRateLimit,
  ipRateLimitRule,
  securityMaintenanceResponse,
  subjectRateLimitRule,
} from "@/lib/security";
import { getUserFromRequest, userUnauthorizedResponse } from "@/lib/user-auth";
import { createPaymentAttemptSchema, validationErrorMessage } from "@/lib/validation";

export async function POST(
  request: Request,
  context: { params: Promise<{ orderNo: string }> },
) {
  try {
    const originResponse = await assertSameOrigin(request);

    if (originResponse) {
      return originResponse;
    }

    const maintenance = securityMaintenanceResponse("PAYMENT_WRITE_DISABLED", "当前支付功能暂时维护，请稍后再试");

    if (maintenance) {
      return maintenance;
    }

    const user = await getUserFromRequest(request);

    if (!user) {
      return userUnauthorizedResponse();
    }

    const { orderNo } = await context.params;
    const order = await prisma.order.findFirst({
      where: {
        orderNo,
        userId: user.id,
      },
      select: { id: true },
    });

    if (!order) {
      return NextResponse.json({ message: "订单不存在" }, { status: 404 });
    }

    const limited = await consumeRateLimit([
      ipRateLimitRule(request, {
        blockDurationMs: 30 * 60 * 1000,
        eventType: "PAYMENT_CREATE_ATTEMPT",
        limit: 40,
        reason: "支付请求过于频繁",
        windowMs: 10 * 60 * 1000,
      }),
      subjectRateLimitRule("user", user.id, {
        eventType: "PAYMENT_CREATE_ATTEMPT",
        limit: 20,
        reason: "该账号支付请求过于频繁",
        windowMs: 10 * 60 * 1000,
      }),
      subjectRateLimitRule("order", orderNo, {
        eventType: "PAYMENT_CREATE_ATTEMPT",
        limit: 8,
        reason: "该订单支付请求过于频繁",
        windowMs: 10 * 60 * 1000,
      }),
    ], request, { id: user.id, type: "user" });

    if (limited) {
      return limited;
    }

    const body = await request.json().catch(() => ({}));
    const input = createPaymentAttemptSchema.parse(body);
    const result = await createPaymentForOrder({
      orderNo,
      payMethod: input.payMethod,
      clientIp: getClientIp(request),
    });

    return NextResponse.json({
      order: {
        orderNo: result.order.orderNo,
        amountCent: result.order.amountCent,
        currency: result.order.currency,
        status: result.order.status,
        paidAt: result.order.paidAt,
      },
      payment: {
        provider: result.payment.provider,
        attemptNo: result.payment.attemptNo,
        wayCode: result.payment.wayCode,
        status: result.payment.status,
        payDataType: result.payment.payDataType,
        payData: result.payment.payData,
        providerOrderId: result.payment.providerOrderId,
        failureReason: paymentFailureReason(result.payment.rawResponseJson),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: validationErrorMessage(error, "创建支付尝试失败") },
      { status: 400 },
    );
  }
}
