import { Prisma } from "@prisma/client";
import type { OrderStatus, PaymentProvider, PaymentStatus, RefundStatus } from "@prisma/client";

import {
  classifyOfficialPaymentError,
  OfficialCompositeGateway,
  payMethodForWayCode,
  type GatewayPayNotifyResult,
  type GatewayPaymentResult,
  type GatewayRefundNotifyResult,
  type GatewayRefundResult,
  type PayMethod,
  type PaymentGateway,
  wayCodeForPayMethod,
} from "@/lib/payment-gateway";
import { prisma } from "@/lib/prisma";
import { getClientIp as getSecurityClientIp } from "@/lib/security";

const orderPaymentStateInclude = {
  package: true,
  paymentRecords: {
    orderBy: [{ attemptNo: "desc" }, { createdAt: "desc" }],
  },
  refundRecords: {
    orderBy: [{ createdAt: "desc" }],
  },
} as const satisfies Prisma.OrderInclude;

type OrderPaymentState = Prisma.OrderGetPayload<{ include: typeof orderPaymentStateInclude }>;

const latestPaymentInclude = {
  order: true,
} as const satisfies Prisma.PaymentRecordInclude;

type PaymentState = Prisma.PaymentRecordGetPayload<{ include: typeof latestPaymentInclude }>;

const refundStateInclude = {
  paymentRecord: {
    include: {
      order: true,
    },
  },
  order: true,
} as const satisfies Prisma.RefundRecordInclude;

type RefundState = Prisma.RefundRecordGetPayload<{ include: typeof refundStateInclude }>;

const activePaymentStatuses = new Set<PaymentStatus>(["CREATED", "PAYING"]);
const retryableOrderStatuses = new Set<OrderStatus>(["PENDING", "PAYING", "PAYMENT_FAILED", "CLOSED"]);
const paidOrderStatuses = new Set<OrderStatus>(["PAID", "FULFILLED", "REFUND_PENDING", "REFUNDED"]);

function todayToken() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}${month}${day}`;
}

async function generateUniqueReference(
  prefix: string,
  exists: (candidate: string) => Promise<boolean>,
) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const random = Math.floor(100000 + Math.random() * 900000);
    const candidate = `${prefix}${todayToken()}${random}`;

    if (!(await exists(candidate))) {
      return candidate;
    }
  }

  return `${prefix}${Date.now()}`;
}

async function generateOrderNo() {
  return generateUniqueReference("BW", async (candidate) =>
    Boolean(await prisma.order.findUnique({ where: { orderNo: candidate } })),
  );
}

async function generateMerchantOrderNo() {
  return generateUniqueReference("BP", async (candidate) =>
    Boolean(await prisma.paymentRecord.findUnique({ where: { mchOrderNo: candidate } })),
  );
}

async function generateRefundNo() {
  return generateUniqueReference("BR", async (candidate) =>
    Boolean(await prisma.refundRecord.findUnique({ where: { refundNo: candidate } })),
  );
}

function providerForCurrentMode(): PaymentProvider {
  return "OFFICIAL";
}

function realPaymentGateway(): PaymentGateway {
  return new OfficialCompositeGateway();
}

function orderStatusFromPayment(currentStatus: OrderStatus, status: PaymentStatus): OrderStatus {
  if (status === "PAID") {
    if (currentStatus === "FULFILLED" || currentStatus === "REFUND_PENDING" || currentStatus === "REFUNDED") {
      return currentStatus;
    }

    return "PAID";
  }

  if (currentStatus === "PAID" || currentStatus === "FULFILLED" || currentStatus === "REFUND_PENDING" || currentStatus === "REFUNDED") {
    return currentStatus;
  }

  if (status === "CREATED" || status === "PAYING") {
    return "PAYING";
  }

  if (status === "FAILED") {
    return "PAYMENT_FAILED";
  }

  if (status === "CLOSED") {
    return "PENDING";
  }

  if (status === "REFUND_PENDING") {
    return "REFUND_PENDING";
  }

  if (status === "REFUNDED") {
    return "REFUNDED";
  }

  return currentStatus;
}

function serializeJson(value: Record<string, unknown> | null | undefined) {
  return value ? (value as Prisma.InputJsonObject) : undefined;
}

function syncOrderRefundSummaryData(
  order: Pick<OrderPaymentState, "orderQuantity" | "amountCent">,
  successAmountCent: number,
) {
  const refundedRatio = order.amountCent > 0 ? successAmountCent / order.amountCent : 0;
  const refundQuantity = successAmountCent > 0
    ? Math.max(1, Math.min(order.orderQuantity, Math.round(order.orderQuantity * refundedRatio)))
    : 0;

  return {
    refundAmountCent: successAmountCent,
    refundQuantity,
  };
}

async function loadOrderPaymentState(orderNo: string) {
  return prisma.order.findUnique({
    where: { orderNo },
    include: orderPaymentStateInclude,
  });
}

async function loadOrderPaymentStateById(id: string) {
  return prisma.order.findUnique({
    where: { id },
    include: orderPaymentStateInclude,
  });
}

async function loadPaymentState(id: string) {
  return prisma.paymentRecord.findUnique({
    where: { id },
    include: latestPaymentInclude,
  });
}

async function loadRefundState(id: string) {
  return prisma.refundRecord.findUnique({
    where: { id },
    include: refundStateInclude,
  });
}

async function closeSiblingActivePayments(
  tx: Prisma.TransactionClient,
  orderId: string,
  exceptId: string,
) {
  await tx.paymentRecord.updateMany({
    where: {
      orderId,
      id: { not: exceptId },
      status: { in: ["CREATED", "PAYING"] },
    },
    data: {
      status: "CLOSED",
    },
  });
}

async function updateOrderRefundSummary(
  tx: Prisma.TransactionClient,
  orderId: string,
  orderAmountCent: number,
  orderQuantity: number,
) {
  const aggregate = await tx.refundRecord.aggregate({
    where: {
      orderId,
      status: "SUCCESS",
    },
    _sum: {
      amountCent: true,
    },
  });

  return tx.order.update({
    where: { id: orderId },
    data: syncOrderRefundSummaryData(
      {
        amountCent: orderAmountCent,
        orderQuantity,
      } as Pick<OrderPaymentState, "orderQuantity" | "amountCent">,
      aggregate._sum.amountCent ?? 0,
    ),
  });
}

async function persistPaymentResult(
  payment: PaymentState,
  result: GatewayPaymentResult,
  rawNotifyJson?: Record<string, unknown>,
) {
  return prisma.$transaction(async (tx) => {
    const updatedPayment = await tx.paymentRecord.update({
      where: { id: payment.id },
      data: {
        providerOrderId: result.providerOrderId ?? payment.providerOrderId,
        status: result.status,
        payDataType: result.payDataType ?? payment.payDataType,
        payData: result.payData ?? payment.payData,
        rawRequestJson: result.rawRequestJson ? serializeJson(result.rawRequestJson) : undefined,
        rawResponseJson: result.rawResponseJson ? serializeJson(result.rawResponseJson) : undefined,
        rawNotifyJson: rawNotifyJson ? serializeJson(rawNotifyJson) : undefined,
        paidAt: result.status === "PAID" ? result.paidAt || payment.paidAt || new Date() : payment.paidAt,
      },
    });

    const nextOrderStatus = orderStatusFromPayment(payment.order.status, result.status);
    const updatedOrder = await tx.order.update({
      where: { id: payment.orderId },
      data: {
        status: nextOrderStatus,
        paidAt: result.status === "PAID" ? result.paidAt || payment.order.paidAt || new Date() : payment.order.paidAt,
      },
    });

    if (result.status === "PAID") {
      await closeSiblingActivePayments(tx, payment.orderId, payment.id);
    }

    return { payment: updatedPayment, order: updatedOrder };
  });
}

function paymentResultFromExistingPayment(status: PaymentStatus, payment: PaymentState): GatewayPaymentResult {
  return {
    providerOrderId: payment.providerOrderId,
    status,
    payDataType: payment.payDataType,
    payData: payment.payData,
    paidAt: status === "PAID" ? payment.paidAt || new Date() : payment.paidAt,
  };
}

async function syncSinglePaymentAttempt(
  payment: PaymentState,
  options?: { closeIfActive?: boolean },
) {
  if (!activePaymentStatuses.has(payment.status)) {
    return {
      payment,
      order: payment.order,
    };
  }

  if (payment.provider !== "OFFICIAL") {
    if (options?.closeIfActive) {
      return persistPaymentResult(payment, paymentResultFromExistingPayment("CLOSED", payment));
    }

    return {
      payment,
      order: payment.order,
    };
  }

  const gateway = realPaymentGateway();

  if (!gateway) {
    return {
      payment,
      order: payment.order,
    };
  }

  let result = await gateway.queryPayment({
    mchOrderNo: payment.mchOrderNo,
    providerOrderId: payment.providerOrderId,
    wayCode: payment.wayCode,
  });

  if (options?.closeIfActive && activePaymentStatuses.has(result.status)) {
    result = await gateway.closePayment({
      mchOrderNo: payment.mchOrderNo,
      providerOrderId: payment.providerOrderId,
      wayCode: payment.wayCode,
    });
  }

  return persistPaymentResult(payment, result);
}

function paymentRetryError(order: OrderPaymentState) {
  if (order.status === "PAID" || order.status === "FULFILLED") {
    return "订单已支付，无需重新拉起支付";
  }

  if (order.status === "REFUND_PENDING" || order.status === "REFUNDED") {
    return "退款中的订单不可重新支付";
  }

  if (order.status === "CANCELLED") {
    return "已取消订单不可重新支付";
  }

  return "当前订单状态不可重新支付";
}

function refundErrorMessage(order: OrderPaymentState) {
  if (!paidOrderStatuses.has(order.status)) {
    return "只有已支付订单才能发起退款";
  }

  if (order.status === "REFUND_PENDING" || order.status === "REFUNDED") {
    return "该订单已在退款流程中";
  }

  if (order.completedQuantity >= order.orderQuantity) {
    return "订单已足量完成，不需要退费";
  }

  return "当前订单不满足退款条件";
}

function refundStatusToOrderStatus(status: RefundStatus): OrderStatus {
  if (status === "SUCCESS") {
    return "REFUNDED";
  }

  if (status === "REFUNDING" || status === "CREATED") {
    return "REFUND_PENDING";
  }

  return "PAID";
}

function refundStatusToPaymentStatus(status: RefundStatus): PaymentStatus {
  if (status === "SUCCESS") {
    return "REFUNDED";
  }

  if (status === "REFUNDING" || status === "CREATED") {
    return "REFUND_PENDING";
  }

  return "PAID";
}

async function persistRefundResult(
  refund: RefundState,
  result: GatewayRefundResult,
  rawNotifyJson?: Record<string, unknown>,
) {
  return prisma.$transaction(async (tx) => {
    const updatedRefund = await tx.refundRecord.update({
      where: { id: refund.id },
      data: {
        providerRefundId: result.providerRefundId ?? refund.providerRefundId,
        status: result.status,
        rawRequestJson: result.rawRequestJson ? serializeJson(result.rawRequestJson) : undefined,
        rawResponseJson: result.rawResponseJson ? serializeJson(result.rawResponseJson) : undefined,
        rawNotifyJson: rawNotifyJson ? serializeJson(rawNotifyJson) : undefined,
        refundedAt: result.status === "SUCCESS" ? result.refundedAt || refund.refundedAt || new Date() : refund.refundedAt,
      },
    });

    await tx.paymentRecord.update({
      where: { id: refund.paymentRecordId },
      data: {
        status: refundStatusToPaymentStatus(result.status),
      },
    });

    const updatedOrder = await tx.order.update({
      where: { id: refund.orderId },
      data: {
        status: refundStatusToOrderStatus(result.status),
      },
    });

    const summarizedOrder = await updateOrderRefundSummary(
      tx,
      refund.orderId,
      refund.order.amountCent,
      refund.order.orderQuantity,
    );

    return {
      refund: updatedRefund,
      order: {
        ...updatedOrder,
        refundAmountCent: summarizedOrder.refundAmountCent,
        refundQuantity: summarizedOrder.refundQuantity,
      },
    };
  });
}

export function getClientIp(request: Request) {
  return getSecurityClientIp(request);
}

export async function createPaymentForOrder(input: {
  orderNo: string;
  payMethod?: PayMethod;
  clientIp?: string;
}) {
  const initialOrder = await loadOrderPaymentState(input.orderNo);

  if (!initialOrder) {
    throw new Error("订单不存在");
  }

  if (!retryableOrderStatuses.has(initialOrder.status)) {
    throw new Error(paymentRetryError(initialOrder));
  }

  let order = initialOrder;
  const latestPayment = order.paymentRecords[0] || null;

  if (latestPayment && activePaymentStatuses.has(latestPayment.status)) {
    await syncSinglePaymentAttempt(
      await loadPaymentState(latestPayment.id).then((value) => {
        if (!value) {
          throw new Error("支付记录不存在");
        }

        return value;
      }),
      { closeIfActive: true },
    );

    const refreshed = await loadOrderPaymentState(order.orderNo);

    if (!refreshed) {
      throw new Error("订单不存在");
    }

    order = refreshed;

    if (!retryableOrderStatuses.has(order.status)) {
      throw new Error(paymentRetryError(order));
    }
  }

  const payMethod = input.payMethod || payMethodForWayCode(latestPayment?.wayCode);
  const attemptNo = (order.paymentRecords[0]?.attemptNo || 0) + 1;

  const payment = await prisma.paymentRecord.create({
    data: {
      orderId: order.id,
      attemptNo,
      provider: providerForCurrentMode(),
      mchOrderNo: await generateMerchantOrderNo(),
      amountCent: order.amountCent,
      currency: order.currency,
      wayCode: wayCodeForPayMethod(payMethod),
      status: "CREATED",
    },
  });

  const paymentState = await loadPaymentState(payment.id);

  if (!paymentState) {
    throw new Error("支付记录不存在");
  }

  const gateway = realPaymentGateway();

  try {
    const targetLabel = order.package.category === "xhs" || order.package.categoryLabel.includes("小红书") ? "红薯账号" : "抖音号";
    const paymentBody = order.package.category === "xhs" || order.package.categoryLabel.includes("小红书")
      ? `${order.package.categoryLabel} ${targetLabel}:${order.targetAccount}`
      : `${order.package.categoryLabel} ${targetLabel}:${order.targetAccount} 合作码:${order.cooperationCode || "-"}`;

    const result = await gateway.createPayment({
      orderNo: order.orderNo,
      mchOrderNo: payment.mchOrderNo,
      amountCent: order.amountCent,
      currency: order.currency,
      subject: order.package.name,
      body: paymentBody,
      payMethod,
      clientIp: input.clientIp,
    });

    const persisted = await persistPaymentResult(paymentState, result);

    return {
      order: persisted.order,
      payment: persisted.payment,
      provider: providerForCurrentMode(),
    };
  } catch (error) {
    const failure = classifyOfficialPaymentError(error);
    const persisted = await persistPaymentResult(paymentState, {
      providerOrderId: paymentState.providerOrderId,
      status: "FAILED",
      payDataType: paymentState.payDataType,
      payData: paymentState.payData,
      rawResponseJson: {
        code: failure.code,
        message: failure.message,
      },
      paidAt: null,
    });

    return {
      order: persisted.order,
      payment: persisted.payment,
      provider: providerForCurrentMode(),
    };
  }
}

export async function createPurchase(input: {
  userId: string;
  packageId: string;
  targetAccount: string;
  cooperationCode?: string;
  orderQuantity: number;
  payMethod: PayMethod;
  remark?: string;
  clientIp?: string;
}) {
  const servicePackage = await prisma.servicePackage.findFirst({
    where: {
      id: input.packageId,
      isActive: true,
    },
  });

  if (!servicePackage) {
    throw new Error("套餐不存在或已下架");
  }

  const targetAccount = input.targetAccount.trim();
  const cooperationCode = input.cooperationCode?.trim() || "";
  const isXiaohongshu = servicePackage.category === "xhs" || servicePackage.categoryLabel.includes("小红书");

  if (!targetAccount) {
    throw new Error(isXiaohongshu ? "请输入红薯账号" : "请输入抖音号");
  }

  if (!isXiaohongshu && cooperationCode.length < 4) {
    throw new Error("请输入合作码");
  }

  const orderNo = await generateOrderNo();
  const normalizedQuantity = Math.max(
    servicePackage.minQuantity,
    Math.min(input.orderQuantity, servicePackage.maxQuantity),
  );
  const amountCent = servicePackage.priceCent * normalizedQuantity;

  await prisma.order.create({
    data: {
      orderNo,
      userId: input.userId,
      packageId: servicePackage.id,
      targetAccount,
      cooperationCode: isXiaohongshu ? null : cooperationCode,
      orderQuantity: normalizedQuantity,
      amountCent,
      currency: servicePackage.currency,
      remark: input.remark || null,
      status: "PENDING",
    },
  });

  const paymentResult = await createPaymentForOrder({
    orderNo,
    payMethod: input.payMethod,
    clientIp: input.clientIp,
  });

  return {
    order: paymentResult.order,
    payment: paymentResult.payment,
    package: servicePackage,
    provider: paymentResult.provider,
  };
}

export async function syncLatestPaymentForOrder(orderNo: string) {
  const order = await loadOrderPaymentState(orderNo);

  if (!order) {
    throw new Error("订单不存在");
  }

  const latestPayment = order.paymentRecords[0];

  if (!latestPayment) {
    throw new Error("订单暂无支付记录");
  }

  const paymentState = await loadPaymentState(latestPayment.id);

  if (!paymentState) {
    throw new Error("支付记录不存在");
  }

  return syncSinglePaymentAttempt(paymentState);
}

export async function reconcileActiveOfficialPayments(input?: {
  limit?: number;
  minAgeMinutes?: number;
}) {
  const limit = Math.min(Math.max(input?.limit ?? 20, 1), 100);
  const minAgeMinutes = Math.min(Math.max(input?.minAgeMinutes ?? 2, 0), 120);
  const cutoff = new Date(Date.now() - minAgeMinutes * 60 * 1000);
  const payments = await prisma.paymentRecord.findMany({
    where: {
      provider: "OFFICIAL",
      status: {
        in: ["CREATED", "PAYING"],
      },
      updatedAt: {
        lte: cutoff,
      },
    },
    include: latestPaymentInclude,
    orderBy: {
      updatedAt: "asc",
    },
    take: limit,
  });
  const results: Array<{
    id: string;
    mchOrderNo: string;
    status?: PaymentStatus;
    orderStatus?: OrderStatus;
    error?: string;
  }> = [];

  for (const payment of payments) {
    try {
      const synced = await syncSinglePaymentAttempt(payment);
      results.push({
        id: payment.id,
        mchOrderNo: payment.mchOrderNo,
        status: synced.payment.status,
        orderStatus: synced.order.status,
      });
    } catch (error) {
      results.push({
        id: payment.id,
        mchOrderNo: payment.mchOrderNo,
        error: error instanceof Error ? error.message : "支付补偿查询失败",
      });
    }
  }

  return {
    checked: payments.length,
    results,
  };
}

export async function createRefundForOrder(input: {
  orderId: string;
  amountCent?: number;
  reason?: string;
  clientIp?: string;
}) {
  const order = await loadOrderPaymentStateById(input.orderId);

  if (!order) {
    throw new Error("订单不存在");
  }

  if (
    !paidOrderStatuses.has(order.status) ||
    order.status === "REFUND_PENDING" ||
    order.status === "REFUNDED" ||
    order.completedQuantity >= order.orderQuantity
  ) {
    throw new Error(refundErrorMessage(order));
  }

  if (order.refundRecords.some((item) => item.status === "CREATED" || item.status === "REFUNDING" || item.status === "SUCCESS")) {
    throw new Error("该订单已有退款记录，请勿重复提交");
  }

  const payment = order.paymentRecords.find((item) => item.status === "PAID");

  if (!payment) {
    throw new Error("未找到可退款的支付记录");
  }

  const refundAmountCent = input.amountCent ?? order.amountCent;

  if (refundAmountCent <= 0) {
    throw new Error("退款金额必须大于 0");
  }

  if (refundAmountCent > order.amountCent) {
    throw new Error("退款金额不能超过订单实付金额");
  }

  const refundNo = await generateRefundNo();
  const refund = await prisma.refundRecord.create({
    data: {
      orderId: order.id,
      paymentRecordId: payment.id,
      provider: payment.provider,
      refundNo,
      mchRefundNo: refundNo,
      amountCent: refundAmountCent,
      currency: order.currency,
      reason: (input.reason || "未履约原路退回").slice(0, 255),
      status: "CREATED",
    },
  });

  const refundState = await loadRefundState(refund.id);

  if (!refundState) {
    throw new Error("退款记录不存在");
  }

  if (payment.provider !== "OFFICIAL") {
    throw new Error("历史非官方支付记录不可通过线上通道退款");
  }

  const gateway = realPaymentGateway();

  try {
    const result = await gateway.createRefund({
      orderNo: order.orderNo,
      mchOrderNo: payment.mchOrderNo,
      providerOrderId: payment.providerOrderId,
      mchRefundNo: refundState.mchRefundNo,
      amountCent: refundAmountCent,
      currency: order.currency,
      reason: refundState.reason,
      clientIp: input.clientIp,
      wayCode: payment.wayCode,
    });

    return persistRefundResult(refundState, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "发起退款失败";
    return persistRefundResult(refundState, {
      providerRefundId: refundState.providerRefundId,
      status: "FAILED",
      rawResponseJson: {
        message,
      },
      refundedAt: null,
    });
  }
}

export async function syncRefundRecordStatus(id: string) {
  const refund = await loadRefundState(id);

  if (!refund) {
    throw new Error("退款记录不存在");
  }

  if (refund.status === "SUCCESS" || refund.status === "FAILED" || refund.status === "CLOSED") {
    return {
      refund,
      order: refund.order,
    };
  }

  if (refund.provider !== "OFFICIAL") {
    return {
      refund,
      order: refund.order,
    };
  }

  const gateway = realPaymentGateway();

  if (!gateway) {
    throw new Error("未找到可用的支付网关");
  }

  const result = await gateway.queryRefund({
    mchOrderNo: refund.paymentRecord.mchOrderNo,
    mchRefundNo: refund.mchRefundNo,
    providerRefundId: refund.providerRefundId,
    wayCode: refund.paymentRecord.wayCode,
  });

  return persistRefundResult(refund, result);
}

export async function handlePayNotify(result: GatewayPayNotifyResult) {
  const payment = await prisma.paymentRecord.findUnique({
    where: { mchOrderNo: result.mchOrderNo },
    include: latestPaymentInclude,
  });

  if (!payment || result.amountCent !== payment.amountCent) {
    throw new Error("支付通知校验失败");
  }

  if (payment.status === "FAILED" && result.status === "PAID") {
    const confirmed = await realPaymentGateway().queryPayment({
      mchOrderNo: payment.mchOrderNo,
      providerOrderId: result.providerOrderId,
      wayCode: payment.wayCode,
    });

    if (confirmed.status !== "PAID" || confirmed.providerOrderId !== result.providerOrderId) {
      throw new Error("失败流水支付通知二次查单失败");
    }

    return persistPaymentResult(payment, {
      ...confirmed,
      providerOrderId: confirmed.providerOrderId || result.providerOrderId,
      paidAt: confirmed.paidAt || result.paidAt,
    }, result.rawNotifyJson);
  }

  return persistPaymentResult(payment, {
    providerOrderId: result.providerOrderId,
    status: result.status,
    payDataType: payment.payDataType,
    payData: payment.payData,
    paidAt: result.paidAt,
  }, result.rawNotifyJson);
}

export async function handleRefundNotify(result: GatewayRefundNotifyResult) {
  const refund = await prisma.refundRecord.findUnique({
    where: { mchRefundNo: result.mchRefundNo },
    include: refundStateInclude,
  });

  if (!refund || result.amountCent !== refund.amountCent) {
    throw new Error("退款通知校验失败");
  }

  return persistRefundResult(refund, {
    providerRefundId: result.providerRefundId,
    status: result.status,
    refundedAt: result.refundedAt,
  }, result.rawNotifyJson);
}

export async function updateOrderManagementStatus(input: {
  orderId: string;
  action: "PROCESSING" | "PROGRESS" | "COMPLETE" | "RETURN_PROCESSING";
  completedQuantity?: number;
}) {
  const order = await loadOrderPaymentStateById(input.orderId);

  if (!order) {
    throw new Error("订单不存在");
  }

  if (input.action === "PROCESSING") {
    if (order.status !== "PAID") {
      throw new Error("只有已支付订单才能接单处理");
    }

    if (order.executedAt) {
      throw new Error("该订单已经处于处理中");
    }

    return prisma.order.update({
      where: { id: order.id },
      data: {
        executedAt: new Date(),
      },
    });
  }

  if (input.action === "PROGRESS") {
    if (order.status !== "PAID") {
      throw new Error("只有已支付订单才能提交交付进度");
    }

    if (typeof input.completedQuantity !== "number") {
      throw new Error("请输入已完成数量");
    }

    if (input.completedQuantity > order.orderQuantity) {
      throw new Error("已完成数量不能超过下单数量");
    }

    return prisma.order.update({
      where: { id: order.id },
      data: {
        completedQuantity: input.completedQuantity,
        currentQuantity: order.initialQuantity === null ? order.currentQuantity : order.initialQuantity + input.completedQuantity,
        executedAt: order.executedAt ?? new Date(),
        status: "PAID",
      },
    });
  }

  if (input.action === "RETURN_PROCESSING") {
    if (order.status !== "FULFILLED") {
      throw new Error("只有已完成订单才能退回处理中");
    }

    return prisma.order.update({
      where: { id: order.id },
      data: {
        executedAt: order.executedAt ?? new Date(),
        status: "PAID",
      },
    });
  }

  if (order.status !== "PAID") {
    throw new Error("只有已支付订单才能完成订单");
  }

  if (!order.executedAt) {
    throw new Error("请先将订单标记为处理中");
  }

  if (typeof input.completedQuantity !== "number") {
    throw new Error("完成订单前必须填写已完成数量");
  }

  if (input.completedQuantity > order.orderQuantity) {
    throw new Error("已完成数量不能超过下单数量");
  }

  return prisma.order.update({
    where: { id: order.id },
    data: {
      completedQuantity: input.completedQuantity,
      currentQuantity: order.initialQuantity === null ? order.currentQuantity : order.initialQuantity + input.completedQuantity,
      status: "FULFILLED",
    },
  });
}
