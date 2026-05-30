import { NextResponse } from "next/server";

import { paymentFailureReason } from "@/lib/payment-failure";
import { createPurchase, getClientIp } from "@/lib/purchase";
import {
  assertSameOrigin,
  consumeRateLimit,
  ipRateLimitRule,
  securityMaintenanceResponse,
  subjectRateLimitRule,
} from "@/lib/security";
import { getUserFromRequest, userUnauthorizedResponse } from "@/lib/user-auth";
import { createOrderSchema, validationErrorMessage } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const originResponse = await assertSameOrigin(request);

    if (originResponse) {
      return originResponse;
    }

    const maintenance = securityMaintenanceResponse("ORDER_WRITE_DISABLED", "当前下单功能暂时维护，请稍后再试");

    if (maintenance) {
      return maintenance;
    }

    const user = await getUserFromRequest(request);

    if (!user) {
      return userUnauthorizedResponse();
    }

    const limited = await consumeRateLimit([
      ipRateLimitRule(request, {
        blockDurationMs: 30 * 60 * 1000,
        eventType: "ORDER_CREATE_ATTEMPT",
        limit: 30,
        reason: "下单请求过于频繁",
        windowMs: 10 * 60 * 1000,
      }),
      subjectRateLimitRule("user", user.id, {
        eventType: "ORDER_CREATE_ATTEMPT",
        limit: 12,
        reason: "该账号下单请求过于频繁",
        windowMs: 10 * 60 * 1000,
      }),
    ], request, { id: user.id, type: "user" });

    if (limited) {
      return limited;
    }

    const body = await request.json();
    const input = createOrderSchema.parse(body);
    const result = await createPurchase({
      userId: user.id,
      packageId: input.packageId,
      targetAccount: input.douyinAccount,
      cooperationCode: input.cooperationCode || undefined,
      orderQuantity: input.orderQuantity,
      payMethod: input.payMethod,
      remark: input.remark || undefined,
      clientIp: getClientIp(request),
    });

    return NextResponse.json({
      order: {
        orderNo: result.order.orderNo,
        amountCent: result.order.amountCent,
        currency: result.order.currency,
        status: result.order.status,
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
      package: {
        name: result.package.name,
      },
    });
  } catch (error) {
    const message = validationErrorMessage(error, "创建订单失败");
    return NextResponse.json({ message }, { status: 400 });
  }
}
