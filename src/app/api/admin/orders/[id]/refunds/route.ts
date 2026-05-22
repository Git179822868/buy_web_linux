import { NextResponse } from "next/server";

import { requireAdminFromRequest, unauthorizedResponse } from "@/lib/admin-auth";
import { writeAudit } from "@/lib/audit";
import { createRefundForOrder, getClientIp } from "@/lib/purchase";
import { assertSameOrigin, securityMaintenanceResponse } from "@/lib/security";
import { createRefundSchema, validationErrorMessage } from "@/lib/validation";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const originResponse = await assertSameOrigin(request);

  if (originResponse) {
    return originResponse;
  }

  const maintenance = securityMaintenanceResponse("PAYMENT_WRITE_DISABLED", "当前退款功能暂时维护，请稍后再试");

  if (maintenance) {
    return maintenance;
  }

  const admin = await requireAdminFromRequest(request);

  if (!admin) {
    return unauthorizedResponse();
  }

  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const input = createRefundSchema.parse(body);
    const result = await createRefundForOrder({
      orderId: id,
      amountCent: input.amountCent,
      reason: input.reason || undefined,
      clientIp: getClientIp(request),
    });

    await writeAudit({
      admin,
      action: "ORDER_REFUND_CREATE",
      targetType: "refund",
      targetId: result.refund.id,
      detail: {
        orderId: id,
        refundNo: result.refund.refundNo,
        status: result.refund.status,
        amountCent: result.refund.amountCent,
      },
    });

    return NextResponse.json({
      refund: {
        id: result.refund.id,
        refundNo: result.refund.refundNo,
        status: result.refund.status,
        amountCent: result.refund.amountCent,
        providerRefundId: result.refund.providerRefundId,
      },
      order: {
        id: result.order.id,
        orderNo: result.order.orderNo,
        status: result.order.status,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: validationErrorMessage(error, "发起退款失败") },
      { status: 400 },
    );
  }
}
