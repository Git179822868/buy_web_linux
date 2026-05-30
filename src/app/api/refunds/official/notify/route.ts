import { NextResponse } from "next/server";

import { OfficialCompositeGateway } from "@/lib/payment-gateway";
import { handleRefundNotify } from "@/lib/purchase";
import { securitySwitchEnabled } from "@/lib/security";

async function parseSignedJsonNotify(request: Request) {
  const rawBody = await request.text();

  return {
    __officialRawBody: rawBody,
    __officialTimestamp: request.headers.get("x-buy-web-timestamp") || "",
    __officialSignature: request.headers.get("x-buy-web-signature") || "",
  };
}

export async function POST(request: Request) {
  if (securitySwitchEnabled("PAYMENT_WRITE_DISABLED")) {
    return new NextResponse("fail", { status: 503 });
  }

  try {
    const params = await parseSignedJsonNotify(request);
    const gateway = new OfficialCompositeGateway();
    const verified = gateway.verifyRefundNotify(params);
    await handleRefundNotify(verified);
  } catch {
    return new NextResponse("fail", { status: 400 });
  }

  return new NextResponse("success", {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
    },
  });
}
