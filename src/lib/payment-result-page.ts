import { notFound, redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { syncLatestPaymentForOrder } from "@/lib/purchase";
import { getUserSession } from "@/lib/user-auth";

export type PaymentResultIntent = "success" | "failure";

export async function loadPaymentResult(orderNo: string, intent: PaymentResultIntent) {
  const session = await getUserSession();

  if (!session) {
    redirect(`/login?next=${encodeURIComponent(`/order/${orderNo}/payment/${intent}`)}`);
  }

  const ownedOrder = await prisma.order.findFirst({
    where: {
      orderNo,
      userId: session.id,
    },
    select: {
      id: true,
    },
  });

  if (!ownedOrder) {
    notFound();
  }

  try {
    await syncLatestPaymentForOrder(orderNo);
  } catch {
    // Payment return pages should still render when the upstream query is delayed
    // or the gateway is temporarily unavailable.
  }

  const order = await prisma.order.findFirst({
    where: {
      orderNo,
      userId: session.id,
    },
    include: {
      package: true,
      paymentRecords: {
        orderBy: [{ attemptNo: "desc" }, { createdAt: "desc" }],
        take: 1,
      },
    },
  });

  if (!order) {
    notFound();
  }

  const payment = order.paymentRecords[0] || null;
  const siteSetting = await prisma.siteSetting.findUnique({
    where: { id: 1 },
    select: { siteName: true },
  }).catch(() => null);
  const paid = order.status === "PAID" || order.status === "FULFILLED";
  const failed = order.status === "PAYMENT_FAILED" || payment?.status === "FAILED" || payment?.status === "CLOSED";
  const pending = !paid && !failed;

  return {
    amountText: `${(order.amountCent / 100).toFixed(2)} 元`,
    failed,
    order,
    paid,
    payment,
    pending,
    siteName: siteSetting?.siteName?.trim() || "YToo",
  };
}
