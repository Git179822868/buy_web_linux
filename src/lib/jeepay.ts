import { createHash } from "crypto";
import type { PaymentStatus, RefundStatus } from "@prisma/client";

import { appPublicUrl, requiredEnv } from "@/lib/env";
import type {
  GatewayPayNotifyResult,
  GatewayPaymentResult,
  GatewayRefundNotifyResult,
  GatewayRefundResult,
  PayMethod,
  PaymentGateway,
} from "@/lib/payment-gateway";
import { wayCodeForPayMethod } from "@/lib/payment-gateway";

type JeepayBaseResponse<TData> = {
  code: number;
  msg?: string;
  sign?: string;
  data?: TData;
};

type JeepayPaymentData = {
  payOrderId?: string;
  mchOrderNo?: string;
  orderState?: number;
  state?: number;
  payDataType?: string;
  payData?: string;
  successTime?: number | string;
  errCode?: string;
  errMsg?: string;
};

type JeepayRefundData = {
  refundOrderId?: string;
  mchRefundNo?: string;
  payOrderId?: string;
  state?: number;
  refundAmount?: number;
  successTime?: number | string;
  errCode?: string;
  errMsg?: string;
};

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

export function signJeepay(params: Record<string, unknown>, appSecret: string) {
  const base = Object.entries(params)
    .filter(([key, value]) => key !== "sign" && value !== undefined && value !== null && value !== "")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("&");

  return createHash("md5")
    .update(`${base}&key=${appSecret}`, "utf8")
    .digest("hex")
    .toUpperCase();
}

export function verifyJeepaySign(params: Record<string, unknown>, appSecret: string) {
  const sign = params.sign;

  if (typeof sign !== "string") {
    return false;
  }

  return signJeepay(params, appSecret) === sign.toUpperCase();
}

export function channelExtraForWayCode(wayCode: string) {
  if (wayCode === "ALI_PC" || wayCode === "ALI_WAP" || wayCode === "WX_H5") {
    return JSON.stringify({ payDataType: "payUrl" });
  }

  if (wayCode === "QR_CASHIER" || wayCode === "WX_NATIVE") {
    return JSON.stringify({ payDataType: "codeImgUrl" });
  }

  return "";
}

export function jeepayConfig() {
  return {
    gatewayUrl: requiredEnv("JEEPAY_GATEWAY_URL").replace(/\/$/, ""),
    mchNo: requiredEnv("JEEPAY_MCH_NO"),
    appId: requiredEnv("JEEPAY_APP_ID"),
    appSecret: requiredEnv("JEEPAY_APP_SECRET"),
  };
}

function normalizeJeepayPaymentStatus(state?: number): PaymentStatus {
  if (state === 2) {
    return "PAID";
  }

  if (state === 3) {
    return "FAILED";
  }

  if (state === 5) {
    return "REFUNDED";
  }

  if (state === 6 || state === 4) {
    return "CLOSED";
  }

  if (state === 1) {
    return "PAYING";
  }

  return "CREATED";
}

function normalizeJeepayRefundStatus(state?: number): RefundStatus {
  if (state === 2) {
    return "SUCCESS";
  }

  if (state === 3) {
    return "FAILED";
  }

  if (state === 4) {
    return "CLOSED";
  }

  if (state === 1) {
    return "REFUNDING";
  }

  return "CREATED";
}

async function postJeepay<TData>(path: string, payload: Record<string, unknown>) {
  const config = jeepayConfig();
  const requestBody: Record<string, unknown> = {
    mchNo: config.mchNo,
    appId: config.appId,
    reqTime: Date.now(),
    version: "1.0",
    signType: "MD5",
    ...payload,
  };

  requestBody.sign = signJeepay(requestBody, config.appSecret);

  const response = await fetch(`${config.gatewayUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(requestBody),
    cache: "no-store",
  });

  const json = (await response.json()) as JeepayBaseResponse<TData>;

  return {
    requestBody,
    response: json,
  };
}

function assertValidNotify(params: Record<string, unknown>) {
  const config = jeepayConfig();

  if (params.mchNo !== config.mchNo || params.appId !== config.appId) {
    throw new Error("Jeepay merchant mismatch");
  }

  if (!verifyJeepaySign(params, config.appSecret)) {
    throw new Error("Jeepay sign verification failed");
  }
}

export class JeepayGateway implements PaymentGateway {
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
    const wayCode = wayCodeForPayMethod(input.payMethod);
    const { requestBody, response } = await postJeepay<JeepayPaymentData>("/api/pay/unifiedOrder", {
      mchOrderNo: input.mchOrderNo,
      wayCode,
      amount: input.amountCent,
      currency: input.currency.toLowerCase(),
      clientIp: input.clientIp || "127.0.0.1",
      subject: input.subject.slice(0, 64),
      body: input.body.slice(0, 256),
      notifyUrl: `${appPublicUrl()}/api/payments/jeepay/notify`,
      returnUrl: `${appPublicUrl()}/order/${input.orderNo}`,
      expiredTime: 7200,
      channelExtra: channelExtraForWayCode(wayCode),
    });

    const data = response.data;
    const status =
      response.code === 0
        ? normalizeJeepayPaymentStatus(data?.orderState ?? data?.state)
        : ("FAILED" as const);

    return {
      providerOrderId: data?.payOrderId || null,
      status,
      payDataType: data?.payDataType || null,
      payData: data?.payData || null,
      rawRequestJson: requestBody,
      rawResponseJson: response as Record<string, unknown>,
      paidAt: status === "PAID" ? parseProviderTime(data?.successTime) || new Date() : null,
    };
  }

  async queryPayment(input: {
    mchOrderNo: string;
    providerOrderId?: string | null;
  }): Promise<GatewayPaymentResult> {
    const { requestBody, response } = await postJeepay<JeepayPaymentData>("/api/pay/query", {
      ...(input.providerOrderId ? { payOrderId: input.providerOrderId } : { mchOrderNo: input.mchOrderNo }),
    });

    const data = response.data;
    const status =
      response.code === 0
        ? normalizeJeepayPaymentStatus(data?.state ?? data?.orderState)
        : ("FAILED" as const);

    return {
      providerOrderId: data?.payOrderId || input.providerOrderId || null,
      status,
      payDataType: data?.payDataType || null,
      payData: data?.payData || null,
      rawRequestJson: requestBody,
      rawResponseJson: response as Record<string, unknown>,
      paidAt: status === "PAID" ? parseProviderTime(data?.successTime) || new Date() : null,
    };
  }

  async closePayment(input: {
    mchOrderNo: string;
    providerOrderId?: string | null;
  }): Promise<GatewayPaymentResult> {
    const { requestBody, response } = await postJeepay<JeepayPaymentData>("/api/pay/close", {
      ...(input.providerOrderId ? { payOrderId: input.providerOrderId } : { mchOrderNo: input.mchOrderNo }),
    });

    const data = response.data;
    const status =
      response.code === 0
        ? normalizeJeepayPaymentStatus(data?.state ?? data?.orderState ?? 6)
        : ("FAILED" as const);

    return {
      providerOrderId: data?.payOrderId || input.providerOrderId || null,
      status,
      payDataType: data?.payDataType || null,
      payData: data?.payData || null,
      rawRequestJson: requestBody,
      rawResponseJson: response as Record<string, unknown>,
      paidAt: status === "PAID" ? parseProviderTime(data?.successTime) || new Date() : null,
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
  }): Promise<GatewayRefundResult> {
    const { requestBody, response } = await postJeepay<JeepayRefundData>("/api/refund/refundOrder", {
      mchRefundNo: input.mchRefundNo,
      ...(input.providerOrderId ? { payOrderId: input.providerOrderId } : { mchOrderNo: input.mchOrderNo }),
      refundAmount: input.amountCent,
      currency: input.currency.toLowerCase(),
      refundReason: input.reason.slice(0, 128),
      clientIp: input.clientIp || "127.0.0.1",
      notifyUrl: `${appPublicUrl()}/api/refunds/notify/jeepay`,
    });

    const data = response.data;
    const status =
      response.code === 0
        ? normalizeJeepayRefundStatus(data?.state)
        : ("FAILED" as const);

    return {
      providerRefundId: data?.refundOrderId || null,
      status,
      rawRequestJson: requestBody,
      rawResponseJson: response as Record<string, unknown>,
      refundedAt: status === "SUCCESS" ? parseProviderTime(data?.successTime) || new Date() : null,
    };
  }

  async queryRefund(input: {
    mchRefundNo: string;
    providerRefundId?: string | null;
  }): Promise<GatewayRefundResult> {
    const { requestBody, response } = await postJeepay<JeepayRefundData>("/api/refund/query", {
      ...(input.providerRefundId ? { refundOrderId: input.providerRefundId } : { mchRefundNo: input.mchRefundNo }),
    });

    const data = response.data;
    const status =
      response.code === 0
        ? normalizeJeepayRefundStatus(data?.state)
        : ("FAILED" as const);

    return {
      providerRefundId: data?.refundOrderId || input.providerRefundId || null,
      status,
      rawRequestJson: requestBody,
      rawResponseJson: response as Record<string, unknown>,
      refundedAt: status === "SUCCESS" ? parseProviderTime(data?.successTime) || new Date() : null,
    };
  }

  verifyPayNotify(params: Record<string, unknown>): GatewayPayNotifyResult {
    assertValidNotify(params);

    return {
      mchOrderNo: String(params.mchOrderNo || ""),
      providerOrderId: params.payOrderId ? String(params.payOrderId) : null,
      amountCent: Number(params.amount ?? params.payAmount ?? 0),
      status: normalizeJeepayPaymentStatus(Number(params.state ?? params.orderState)),
      paidAt:
        Number(params.state ?? params.orderState) === 2
          ? parseProviderTime(params.successTime) || new Date()
          : null,
      rawNotifyJson: params,
    };
  }

  verifyRefundNotify(params: Record<string, unknown>): GatewayRefundNotifyResult {
    assertValidNotify(params);

    return {
      mchRefundNo: String(params.mchRefundNo || ""),
      providerRefundId: params.refundOrderId ? String(params.refundOrderId) : null,
      amountCent: Number(params.refundAmount ?? params.amount ?? 0),
      status: normalizeJeepayRefundStatus(Number(params.state)),
      refundedAt:
        Number(params.state) === 2
          ? parseProviderTime(params.successTime) || new Date()
          : null,
      rawNotifyJson: params,
    };
  }
}
