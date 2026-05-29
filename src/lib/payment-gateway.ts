import { createHmac, timingSafeEqual } from "crypto";
import type { PaymentStatus, RefundStatus } from "@prisma/client";

import { appPublicUrl, requiredEnv } from "@/lib/env";

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
    wayCode?: string | null;
  }): Promise<GatewayPaymentResult>;
  closePayment(input: {
    mchOrderNo: string;
    providerOrderId?: string | null;
    wayCode?: string | null;
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
    wayCode?: string | null;
  }): Promise<GatewayRefundResult>;
  queryRefund(input: {
    mchOrderNo?: string | null;
    mchRefundNo: string;
    providerRefundId?: string | null;
    wayCode?: string | null;
  }): Promise<GatewayRefundResult>;
  verifyPayNotify(params: Record<string, unknown>): GatewayPayNotifyResult;
  verifyRefundNotify(params: Record<string, unknown>): GatewayRefundNotifyResult;
}

type OfficialGatewayResponse<TData> = {
  ok?: boolean;
  message?: string;
  data?: TData;
} & Partial<TData>;

type OfficialPaymentData = {
  providerOrderId?: string | null;
  status?: string;
  payDataType?: string | null;
  payData?: string | null;
  paidAt?: string | number | null;
};

type OfficialRefundData = {
  providerRefundId?: string | null;
  status?: string;
  refundedAt?: string | number | null;
};

const callbackSignatureFields = new Set([
  "__officialRawBody",
  "__officialTimestamp",
  "__officialSignature",
]);

function parseProviderTime(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numeric = Number(value);

  if (Number.isFinite(numeric) && numeric > 0) {
    return new Date(numeric);
  }

  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizePaymentStatus(value: unknown): PaymentStatus {
  const status = String(value || "CREATED").toUpperCase();

  if (status === "PAID" || status === "SUCCESS" || status === "TRADE_SUCCESS" || status === "PAY_SUCCESS") {
    return "PAID";
  }

  if (status === "FAILED" || status === "FAIL" || status === "TRADE_FAILED") {
    return "FAILED";
  }

  if (status === "CLOSED" || status === "CLOSE" || status === "TRADE_CLOSED") {
    return "CLOSED";
  }

  if (status === "REFUNDED") {
    return "REFUNDED";
  }

  if (status === "PAYING" || status === "WAIT_BUYER_PAY" || status === "USERPAYING") {
    return "PAYING";
  }

  return "CREATED";
}

function normalizeRefundStatus(value: unknown): RefundStatus {
  const status = String(value || "CREATED").toUpperCase();

  if (status === "SUCCESS" || status === "REFUNDED" || status === "REFUND_SUCCESS") {
    return "SUCCESS";
  }

  if (status === "FAILED" || status === "FAIL" || status === "REFUND_FAILED") {
    return "FAILED";
  }

  if (status === "CLOSED" || status === "CLOSE") {
    return "CLOSED";
  }

  if (status === "REFUNDING" || status === "PROCESSING") {
    return "REFUNDING";
  }

  return "CREATED";
}

function officialConfig() {
  return {
    gatewayUrl: requiredEnv("OFFICIAL_PAY_GATEWAY_URL").replace(/\/$/, ""),
    secret: requiredEnv("OFFICIAL_PAY_GATEWAY_SECRET"),
  };
}

function signPayload(secret: string, timestamp: string, body: string) {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${body}`, "utf8")
    .digest("hex");
}

function timingSafeEqualHex(a: string, b: string) {
  const aBuffer = Buffer.from(a, "hex");
  const bBuffer = Buffer.from(b, "hex");

  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
}

function responseData<TData>(response: OfficialGatewayResponse<TData>) {
  return (response.data || response) as TData;
}

async function postOfficial<TData>(path: string, payload: Record<string, unknown>) {
  const config = officialConfig();
  const body = JSON.stringify(payload);
  const timestamp = Date.now().toString();
  const signature = signPayload(config.secret, timestamp, body);
  const response = await fetch(`${config.gatewayUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-buy-web-timestamp": timestamp,
      "x-buy-web-signature": signature,
    },
    body,
    cache: "no-store",
  });
  const json = (await response.json()) as OfficialGatewayResponse<TData>;

  if (!response.ok || json.ok === false) {
    throw new Error(json.message || `Official payment gateway failed with HTTP ${response.status}`);
  }

  return {
    requestBody: payload,
    response: json,
  };
}

function cleanNotifyJson(params: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(params).filter(([key]) => !callbackSignatureFields.has(key)),
  );
}

function assertValidOfficialCallback(params: Record<string, unknown>) {
  const config = officialConfig();
  const rawBody = params.__officialRawBody;
  const timestamp = params.__officialTimestamp;
  const signature = params.__officialSignature;

  if (typeof rawBody !== "string" || typeof timestamp !== "string" || typeof signature !== "string") {
    throw new Error("Official callback signature headers are missing");
  }

  const requestTime = Number(timestamp);

  if (!Number.isFinite(requestTime) || Math.abs(Date.now() - requestTime) > 5 * 60 * 1000) {
    throw new Error("Official callback timestamp is invalid");
  }

  if (!timingSafeEqualHex(signPayload(config.secret, timestamp, rawBody), signature)) {
    throw new Error("Official callback signature verification failed");
  }
}

export class OfficialCompositeGateway implements PaymentGateway {
  async createPayment(input: {
    orderNo: string;
    mchOrderNo: string;
    amountCent: number;
    currency: string;
    subject: string;
    body: string;
    payMethod: PayMethod;
    clientIp?: string;
  }): Promise<GatewayPaymentResult> {
    const { requestBody, response } = await postOfficial<OfficialPaymentData>("/payments", {
      orderNo: input.orderNo,
      mchOrderNo: input.mchOrderNo,
      amountCent: input.amountCent,
      currency: input.currency.toLowerCase(),
      subject: input.subject.slice(0, 64),
      body: input.body.slice(0, 256),
      payMethod: input.payMethod,
      wayCode: wayCodeForPayMethod(input.payMethod),
      clientIp: input.clientIp || "127.0.0.1",
      notifyUrl: `${appPublicUrl()}/api/payments/official/notify`,
      returnUrl: `${appPublicUrl()}/order/${input.orderNo}/payment/success`,
    });
    const data = responseData<OfficialPaymentData>(response);

    return {
      providerOrderId: data.providerOrderId || null,
      status: normalizePaymentStatus(data.status),
      payDataType: data.payDataType || null,
      payData: data.payData || null,
      rawRequestJson: requestBody,
      rawResponseJson: response,
      paidAt: normalizePaymentStatus(data.status) === "PAID" ? parseProviderTime(data.paidAt) || new Date() : null,
    };
  }

  async queryPayment(input: {
    mchOrderNo: string;
    providerOrderId?: string | null;
    wayCode?: string | null;
  }): Promise<GatewayPaymentResult> {
    const { requestBody, response } = await postOfficial<OfficialPaymentData>("/payments/query", {
      mchOrderNo: input.mchOrderNo,
      providerOrderId: input.providerOrderId,
      wayCode: input.wayCode,
    });
    const data = responseData<OfficialPaymentData>(response);

    return {
      providerOrderId: data.providerOrderId || input.providerOrderId || null,
      status: normalizePaymentStatus(data.status),
      payDataType: data.payDataType || null,
      payData: data.payData || null,
      rawRequestJson: requestBody,
      rawResponseJson: response,
      paidAt: normalizePaymentStatus(data.status) === "PAID" ? parseProviderTime(data.paidAt) || new Date() : null,
    };
  }

  async closePayment(input: {
    mchOrderNo: string;
    providerOrderId?: string | null;
    wayCode?: string | null;
  }): Promise<GatewayPaymentResult> {
    const { requestBody, response } = await postOfficial<OfficialPaymentData>("/payments/close", {
      mchOrderNo: input.mchOrderNo,
      providerOrderId: input.providerOrderId,
      wayCode: input.wayCode,
    });
    const data = responseData<OfficialPaymentData>(response);

    return {
      providerOrderId: data.providerOrderId || input.providerOrderId || null,
      status: normalizePaymentStatus(data.status || "CLOSED"),
      payDataType: data.payDataType || null,
      payData: data.payData || null,
      rawRequestJson: requestBody,
      rawResponseJson: response,
      paidAt: normalizePaymentStatus(data.status) === "PAID" ? parseProviderTime(data.paidAt) || new Date() : null,
    };
  }

  async createRefund(input: {
    orderNo: string;
    mchOrderNo: string;
    providerOrderId?: string | null;
    mchRefundNo: string;
    amountCent: number;
    currency: string;
    reason: string;
    clientIp?: string;
    wayCode?: string | null;
  }): Promise<GatewayRefundResult> {
    const { requestBody, response } = await postOfficial<OfficialRefundData>("/refunds", {
      orderNo: input.orderNo,
      mchOrderNo: input.mchOrderNo,
      providerOrderId: input.providerOrderId,
      mchRefundNo: input.mchRefundNo,
      amountCent: input.amountCent,
      currency: input.currency.toLowerCase(),
      reason: input.reason.slice(0, 128),
      clientIp: input.clientIp || "127.0.0.1",
      notifyUrl: `${appPublicUrl()}/api/refunds/official/notify`,
      wayCode: input.wayCode,
    });
    const data = responseData<OfficialRefundData>(response);

    return {
      providerRefundId: data.providerRefundId || null,
      status: normalizeRefundStatus(data.status),
      rawRequestJson: requestBody,
      rawResponseJson: response,
      refundedAt: normalizeRefundStatus(data.status) === "SUCCESS" ? parseProviderTime(data.refundedAt) || new Date() : null,
    };
  }

  async queryRefund(input: {
    mchOrderNo?: string | null;
    mchRefundNo: string;
    providerRefundId?: string | null;
    wayCode?: string | null;
  }): Promise<GatewayRefundResult> {
    const { requestBody, response } = await postOfficial<OfficialRefundData>("/refunds/query", {
      mchOrderNo: input.mchOrderNo,
      mchRefundNo: input.mchRefundNo,
      providerRefundId: input.providerRefundId,
      wayCode: input.wayCode,
    });
    const data = responseData<OfficialRefundData>(response);

    return {
      providerRefundId: data.providerRefundId || input.providerRefundId || null,
      status: normalizeRefundStatus(data.status),
      rawRequestJson: requestBody,
      rawResponseJson: response,
      refundedAt: normalizeRefundStatus(data.status) === "SUCCESS" ? parseProviderTime(data.refundedAt) || new Date() : null,
    };
  }

  verifyPayNotify(params: Record<string, unknown>): GatewayPayNotifyResult {
    assertValidOfficialCallback(params);

    return {
      mchOrderNo: String(params.mchOrderNo || ""),
      providerOrderId: params.providerOrderId ? String(params.providerOrderId) : null,
      amountCent: Number(params.amountCent || 0),
      status: normalizePaymentStatus(params.status),
      paidAt: normalizePaymentStatus(params.status) === "PAID" ? parseProviderTime(params.paidAt) || new Date() : null,
      rawNotifyJson: cleanNotifyJson(params),
    };
  }

  verifyRefundNotify(params: Record<string, unknown>): GatewayRefundNotifyResult {
    assertValidOfficialCallback(params);

    return {
      mchRefundNo: String(params.mchRefundNo || ""),
      providerRefundId: params.providerRefundId ? String(params.providerRefundId) : null,
      amountCent: Number(params.amountCent || 0),
      status: normalizeRefundStatus(params.status),
      refundedAt: normalizeRefundStatus(params.status) === "SUCCESS" ? parseProviderTime(params.refundedAt) || new Date() : null,
      rawNotifyJson: cleanNotifyJson(params),
    };
  }
}
