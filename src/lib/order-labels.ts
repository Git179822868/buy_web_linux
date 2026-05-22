export const orderStatusLabels: Record<string, string> = {
  PENDING: "待支付",
  PAYING: "支付中",
  PAID: "已支付",
  PAYMENT_FAILED: "支付失败",
  CANCELLED: "已取消",
  FULFILLED: "已完成",
  REFUND_PENDING: "退款中",
  REFUNDED: "已退款",
  CLOSED: "已关闭",
};

export const paymentStatusLabels: Record<string, string> = {
  CREATED: "待支付",
  PAYING: "支付中",
  PAID: "已支付",
  FAILED: "支付失败",
  CLOSED: "已关闭",
  REFUND_PENDING: "退款中",
  REFUNDED: "已退款",
};

export const refundStatusLabels: Record<string, string> = {
  CREATED: "已创建",
  REFUNDING: "退款中",
  SUCCESS: "已退款",
  FAILED: "退款失败",
  CLOSED: "已关闭",
};

type CustomerOrderStatusInput = {
  status: string;
  orderQuantity: number;
  completedQuantity?: number | null;
  refundQuantity?: number | null;
  executedAt?: Date | string | null;
};

export function orderStatusLabel(status: string) {
  return orderStatusLabels[status] || status;
}

export function paymentStatusLabel(status?: string | null) {
  return status ? paymentStatusLabels[status] || status : "-";
}

export function refundStatusLabel(status?: string | null) {
  return status ? refundStatusLabels[status] || status : "-";
}

export function orderProgressPercent(order: CustomerOrderStatusInput) {
  if (order.status === "FULFILLED") {
    return 100;
  }

  const base = Math.max(order.orderQuantity || 0, 1);
  const completed = Math.max(order.completedQuantity || 0, 0);

  return Math.max(0, Math.min(100, Math.round((completed / base) * 100)));
}

export function customerOrderStatus(order: CustomerOrderStatusInput) {
  const progress = orderProgressPercent(order);
  const completed = Math.max(order.completedQuantity || 0, 0);
  const total = Math.max(order.orderQuantity || 0, 0);
  const refundQuantity = Math.max(order.refundQuantity || 0, 0);

  if (order.status === "FULFILLED") {
    return {
      detail: `已完成 ${total}/${total}`,
      label: "已完成",
      progress,
      tone: "FULFILLED",
    };
  }

  if (order.status === "REFUND_PENDING") {
    return {
      detail: refundQuantity > 0 ? `退款处理中 ${refundQuantity}/${total}` : "退款处理中",
      label: "退款中",
      progress,
      tone: "REFUND_PENDING",
    };
  }

  if (order.status === "REFUNDED") {
    return {
      detail: refundQuantity > 0 ? `已退款 ${refundQuantity}/${total}` : "订单已退款",
      label: "已退款",
      progress,
      tone: "REFUNDED",
    };
  }

  if (order.status === "PAID" && order.executedAt) {
    return {
      detail: completed > 0 ? `已完成 ${completed}/${total}` : "客服已接单，等待更新进度",
      label: completed > 0 ? "处理中" : "已接单",
      progress,
      tone: completed > 0 ? "PROCESSING" : "ACCEPTED",
    };
  }

  if (order.status === "PAID") {
    return {
      detail: "已支付，等待客服接单",
      label: "待接单",
      progress,
      tone: "PAID_WAITING",
    };
  }

  if (order.status === "PENDING") {
    return {
      detail: "等待用户付款",
      label: "待支付",
      progress: 0,
      tone: "PENDING",
    };
  }

  if (order.status === "PAYING") {
    return {
      detail: "正在确认支付结果",
      label: "支付中",
      progress: 0,
      tone: "PAYING",
    };
  }

  return {
    detail: orderStatusLabel(order.status),
    label: orderStatusLabel(order.status),
    progress,
    tone: order.status,
  };
}
