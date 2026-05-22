import { NextResponse } from "next/server";

import { JeepayGateway } from "@/lib/jeepay";
import { handlePayNotify } from "@/lib/purchase";
import { securitySwitchEnabled } from "@/lib/security";

async function parseNotifyBody(request: Request) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return (await request.json()) as Record<string, unknown>;
  }

  const form = await request.formData();
  return Object.fromEntries(form.entries()) as Record<string, unknown>;
}

export async function POST(request: Request) {
  if (securitySwitchEnabled("PAYMENT_WRITE_DISABLED")) {
    return new NextResponse("fail", { status: 503 });
  }

  try {
    const params = await parseNotifyBody(request);
    const gateway = new JeepayGateway();
    const verified = gateway.verifyPayNotify(params);
    await handlePayNotify(verified);
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
