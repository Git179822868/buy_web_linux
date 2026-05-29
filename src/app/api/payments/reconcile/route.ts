import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

import { reconcileActiveOfficialPayments } from "@/lib/purchase";
import { securitySwitchEnabled } from "@/lib/security";

function numberParam(value: string | null, fallback: number) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function secretMatches(actual: string | null, expected: string) {
  if (!actual) {
    return false;
  }

  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export async function POST(request: Request) {
  if (securitySwitchEnabled("PAYMENT_WRITE_DISABLED")) {
    return NextResponse.json({ message: "支付写入已暂停" }, { status: 503 });
  }

  const secret = process.env.PAYMENT_RECONCILE_SECRET;

  if (!secret) {
    return NextResponse.json({ message: "支付补偿密钥未配置" }, { status: 503 });
  }

  if (!secretMatches(request.headers.get("x-buy-web-reconcile-secret"), secret)) {
    return NextResponse.json({ message: "无权执行支付补偿" }, { status: 401 });
  }

  const url = new URL(request.url);
  const result = await reconcileActiveOfficialPayments({
    limit: numberParam(url.searchParams.get("limit"), 20),
    minAgeMinutes: numberParam(url.searchParams.get("minAgeMinutes"), 2),
  });

  return NextResponse.json(result);
}
