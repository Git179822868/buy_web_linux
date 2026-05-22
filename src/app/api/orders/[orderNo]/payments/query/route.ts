import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { syncLatestPaymentForOrder } from "@/lib/purchase";
import {
  assertSameOrigin,
  consumeRateLimit,
  ipRateLimitRule,
  securityMaintenanceResponse,
  subjectRateLimitRule,
} from "@/lib/security";
import { getUserFromRequest, userUnauthorizedResponse } from "@/lib/user-auth";
import { validationErrorMessage } from "@/lib/validation";

export async function POST(
  request: Request,
  context: { params: Promise<{ orderNo: string }> },
) {
  try {
    const originResponse = await assertSameOrigin(request);

    if (originResponse) {
      return originResponse;
    }

    const maintenance = securityMaintenanceResponse("PAYMENT_WRITE_DISABLED", "当前支付状态同步暂时维护，请稍后再试");

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
        eventType: "PAYMENT_QUERY_ATTEMPT",
        limit: 80,
        reason: "支付查询请求过于频繁",
        windowMs: 10 * 60 * 1000,
      }),
      subjectRateLimitRule("user", user.id, {
        eventType: "PAYMENT_QUERY_ATTEMPT",
        limit: 50,
        reason: "该账号支付查询请求过于频繁",
        windowMs: 10 * 60 * 1000,
      }),
      subjectRateLimitRule("order", orderNo, {
        eventType: "PAYMENT_QUERY_ATTEMPT",
        limit: 20,
        reason: "该订单支付查询请求过于频繁",
        windowMs: 10 * 60 * 1000,
      }),
    ], request, { id: user.id, type: "user" });

    if (limited) {
      return limited;
    }

    const result = await syncLatestPaymentForOrder(orderNo);

    return NextResponse.json({
      order: {
        id: result.order.id,
        orderNo: result.order.orderNo,
        status: result.order.status,
        paidAt: result.order.paidAt,
      },
      payment: {
        id: result.payment.id,
        attemptNo: result.payment.attemptNo,
        provider: result.payment.provider,
        wayCode: result.payment.wayCode,
        status: result.payment.status,
        payDataType: result.payment.payDataType,
        payData: result.payment.payData,
        providerOrderId: result.payment.providerOrderId,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: validationErrorMessage(error, "查询支付状态失败") },
      { status: 400 },
    );
  }
}
