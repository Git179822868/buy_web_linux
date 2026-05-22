import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { consumeRateLimit, ipRateLimitRule, subjectRateLimitRule } from "@/lib/security";
import { getUserFromRequest, userUnauthorizedResponse } from "@/lib/user-auth";

export async function GET(
  request: Request,
  context: { params: Promise<{ orderNo: string }> },
) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return userUnauthorizedResponse();
  }

  const limited = await consumeRateLimit([
    ipRateLimitRule(request, {
      eventType: "ORDER_DETAIL_READ",
      limit: 120,
      reason: "订单查询请求过于频繁",
      windowMs: 10 * 60 * 1000,
    }),
    subjectRateLimitRule("user", user.id, {
      eventType: "ORDER_DETAIL_READ",
      limit: 80,
      reason: "该账号订单查询请求过于频繁",
      windowMs: 10 * 60 * 1000,
    }),
  ], request, { id: user.id, type: "user" });

  if (limited) {
    return limited;
  }

  const { orderNo } = await context.params;
  const order = await prisma.order.findFirst({
    where: {
      orderNo,
      userId: user.id,
    },
    include: {
      user: true,
      package: true,
      paymentRecords: {
        orderBy: [{ attemptNo: "desc" }, { createdAt: "desc" }],
      },
      refundRecords: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!order) {
    return NextResponse.json({ message: "订单不存在" }, { status: 404 });
  }

  const activePayment = order.paymentRecords[0] || null;

  return NextResponse.json({
    order: {
      id: order.id,
      orderNo: order.orderNo,
      amountCent: order.amountCent,
      currency: order.currency,
      status: order.status,
      paidAt: order.paidAt,
      createdAt: order.createdAt,
      phone: order.user.phone,
      targetAccount: order.targetAccount,
      cooperationCode: order.cooperationCode,
      remark: order.remark,
      package: {
        name: order.package.name,
        description: order.package.description,
      },
      refundAmountCent: order.refundAmountCent,
      refundQuantity: order.refundQuantity,
    },
    activePayment: activePayment
      ? {
          id: activePayment.id,
          attemptNo: activePayment.attemptNo,
          provider: activePayment.provider,
          status: activePayment.status,
          wayCode: activePayment.wayCode,
          payDataType: activePayment.payDataType,
          payData: activePayment.payData,
          providerOrderId: activePayment.providerOrderId,
          createdAt: activePayment.createdAt,
          paidAt: activePayment.paidAt,
        }
      : null,
    payment: activePayment
      ? {
          id: activePayment.id,
          attemptNo: activePayment.attemptNo,
          provider: activePayment.provider,
          status: activePayment.status,
          wayCode: activePayment.wayCode,
          payDataType: activePayment.payDataType,
          payData: activePayment.payData,
          providerOrderId: activePayment.providerOrderId,
          createdAt: activePayment.createdAt,
          paidAt: activePayment.paidAt,
        }
      : null,
    paymentHistory: order.paymentRecords.map((item) => ({
      id: item.id,
      attemptNo: item.attemptNo,
      provider: item.provider,
      status: item.status,
      wayCode: item.wayCode,
      payDataType: item.payDataType,
      payData: item.payData,
      providerOrderId: item.providerOrderId,
      createdAt: item.createdAt,
      paidAt: item.paidAt,
    })),
    refunds: order.refundRecords.map((item) => ({
      id: item.id,
      refundNo: item.refundNo,
      provider: item.provider,
      status: item.status,
      amountCent: item.amountCent,
      currency: item.currency,
      reason: item.reason,
      providerRefundId: item.providerRefundId,
      createdAt: item.createdAt,
      refundedAt: item.refundedAt,
    })),
  });
}
