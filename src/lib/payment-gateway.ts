import type { PaymentStatus, RefundStatus } from "@prisma/client";

export type PayMethod =
  | "wechat_native"
  | "alipay_pc"
  | "wechat_h5"
  | "alipay_wap";

export type PaySurface = "desktop" | "mobile";

export const payMethodOptions: Array<{
  id: PayMethod;
  label: string;
  wayCode: string;
  helper: string;
  surfaces: PaySurface[];
}> = [
  {
    id: "wechat_native",
    label: "微信扫码",
    wayCode: "WX_NATIVE",
    helper: "适合 PC 网页微信扫码",
    surfaces: ["desktop"],
  },
  {
    id: "alipay_pc",
    label: "支付宝网页",
    wayCode: "ALI_PC",
    helper: "适合桌面浏览器跳转支付宝支付",
    surfaces: ["desktop"],
  },
  {
    id: "wechat_h5",
    label: "微信 H5",
    wayCode: "WX_H5",
    helper: "适合手机系统浏览器拉起微信支付",
    surfaces: ["mobile"],
  },
  {
    id: "alipay_wap",
    label: "支付宝 H5",
    wayCode: "ALI_WAP",
    helper: "适合手机系统浏览器拉起支付宝支付",
    surfaces: ["mobile"],
  },
];

export function wayCodeForPayMethod(payMethod: PayMethod) {
  return payMethodOptions.find((item) => item.id === payMethod)?.wayCode || "WX_NATIVE";
}

export function payMethodForWayCode(wayCode?: string | null) {
  return payMethodOptions.find((item) => item.wayCode === wayCode)?.id || "wechat_native";
}

export type GatewayPaymentResult = {
  providerOrderId: string | null;
  status: PaymentStatus;
  payDataType: string | null;
  payData: string | null;
  rawRequestJson?: Record<string, unknown> | null;
  rawResponseJson?: Record<string, unknown> | null;
  paidAt?: Date | null;
};

export type GatewayRefundResult = {
  providerRefundId: string | null;
  status: RefundStatus;
  rawRequestJson?: Record<string, unknown> | null;
  rawResponseJson?: Record<string, unknown> | null;
  refundedAt?: Date | null;
};

export type GatewayPayNotifyResult = {
  mchOrderNo: string;
  providerOrderId: string | null;
  amountCent: number;
  status: PaymentStatus;
  paidAt: Date | null;
  rawNotifyJson: Record<string, unknown>;
};

export type GatewayRefundNotifyResult = {
  mchRefundNo: string;
  providerRefundId: string | null;
  amountCent: number;
  status: RefundStatus;
  refundedAt: Date | null;
  rawNotifyJson: Record<string, unknown>;
};

export interface PaymentGateway {
  createPayment(input: {
    orderNo: string;
    mchOrderNo: string;
    amountCent: number;
    currency: string;
    subject: string;
    body: string;
    payMethod: PayMethod;
    clientIp?: string;
  }): Promise<GatewayPaymentResult>;
  queryPayment(input: {
    mchOrderNo: string;
    providerOrderId?: string | null;
  }): Promise<GatewayPaymentResult>;
  closePayment(input: {
    mchOrderNo: string;
    providerOrderId?: string | null;
  }): Promise<GatewayPaymentResult>;
  createRefund(input: {
    orderNo: string;
    mchOrderNo: string;
    providerOrderId?: string | null;
    mchRefundNo: string;
    amountCent: number;
    currency: string;
    reason: string;
    clientIp?: string;
  }): Promise<GatewayRefundResult>;
  queryRefund(input: {
    mchRefundNo: string;
    providerRefundId?: string | null;
  }): Promise<GatewayRefundResult>;
  verifyPayNotify(params: Record<string, unknown>): GatewayPayNotifyResult;
  verifyRefundNotify(params: Record<string, unknown>): GatewayRefundNotifyResult;
}

export class OfficialCompositeGateway implements PaymentGateway {
  private unsupported(): never {
    throw new Error("OfficialCompositeGateway is reserved for future direct-channel integration");
  }

  async createPayment(_input: {
    orderNo: string;
    mchOrderNo: string;
    amountCent: number;
    currency: string;
    subject: string;
    body: string;
    payMethod: PayMethod;
    clientIp?: string;
  }): Promise<GatewayPaymentResult> {
    void _input;
    return this.unsupported();
  }

  async queryPayment(_input: {
    mchOrderNo: string;
    providerOrderId?: string | null;
  }): Promise<GatewayPaymentResult> {
    void _input;
    return this.unsupported();
  }

  async closePayment(_input: {
    mchOrderNo: string;
    providerOrderId?: string | null;
  }): Promise<GatewayPaymentResult> {
    void _input;
    return this.unsupported();
  }

  async createRefund(_input: {
    orderNo: string;
    mchOrderNo: string;
    providerOrderId?: string | null;
    mchRefundNo: string;
    amountCent: number;
    currency: string;
    reason: string;
    clientIp?: string;
  }): Promise<GatewayRefundResult> {
    void _input;
    return this.unsupported();
  }

  async queryRefund(_input: {
    mchRefundNo: string;
    providerRefundId?: string | null;
  }): Promise<GatewayRefundResult> {
    void _input;
    return this.unsupported();
  }

  verifyPayNotify(_params: Record<string, unknown>): GatewayPayNotifyResult {
    void _params;
    return this.unsupported();
  }

  verifyRefundNotify(_params: Record<string, unknown>): GatewayRefundNotifyResult {
    void _params;
    return this.unsupported();
  }
}
