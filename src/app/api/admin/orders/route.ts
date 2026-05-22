import { NextResponse } from "next/server";
import { OrderStatus } from "@prisma/client";

import { requireAdminFromRequest, unauthorizedResponse } from "@/lib/admin-auth";
import { maskPhone } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const admin = await requireAdminFromRequest(request);

  if (!admin) {
    return unauthorizedResponse();
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const status = searchParams.get("status")?.trim();
  const statusFilter = status && Object.values(OrderStatus).includes(status as OrderStatus)
    ? (status as OrderStatus)
    : undefined;

  const orders = await prisma.order.findMany({
    where: {
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(q
        ? {
            OR: [
              { orderNo: { contains: q } },
              { user: { phone: { contains: q } } },
              { package: { name: { contains: q } } },
              { targetAccount: { contains: q } },
              { cooperationCode: { contains: q } },
            ],
          }
        : {}),
    },
    include: {
      user: true,
      package: true,
      paymentRecords: {
        orderBy: [{ attemptNo: "desc" }, { createdAt: "desc" }],
        take: 1,
      },
      refundRecords: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    orders: orders.map((order) => ({
      id: order.id,
      orderNo: order.orderNo,
      phone: order.user.phone,
      phoneMasked: maskPhone(order.user.phone),
      targetAccount: order.targetAccount,
      cooperationCode: order.cooperationCode,
      remark: order.remark,
      packageName: order.package.name,
      orderQuantity: order.orderQuantity,
      initialQuantity: order.initialQuantity,
      currentQuantity: order.currentQuantity,
      completedQuantity: order.completedQuantity,
      executedAt: order.executedAt,
      refundAmountCent: order.refundAmountCent,
      refundQuantity: order.refundQuantity,
      amountCent: order.amountCent,
      currency: order.currency,
      status: order.status,
      paymentStatus: order.paymentRecords[0]?.status || null,
      latestRefundId: order.refundRecords[0]?.id || null,
      latestRefundStatus: order.refundRecords[0]?.status || null,
      paidAt: order.paidAt,
      createdAt: order.createdAt,
    })),
  });
}
