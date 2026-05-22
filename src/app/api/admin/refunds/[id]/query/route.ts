import { NextResponse } from "next/server";

import { requireAdminWriteRequest } from "@/lib/admin-api";
import { syncRefundRecordStatus } from "@/lib/purchase";
import { validationErrorMessage } from "@/lib/validation";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { response } = await requireAdminWriteRequest(request);

  if (response) {
    return response;
  }

  try {
    const { id } = await context.params;
    const result = await syncRefundRecordStatus(id);

    return NextResponse.json({
      refund: {
        id: result.refund.id,
        refundNo: result.refund.refundNo,
        status: result.refund.status,
        amountCent: result.refund.amountCent,
        providerRefundId: result.refund.providerRefundId,
        refundedAt: result.refund.refundedAt,
      },
      order: {
        id: result.order.id,
        orderNo: result.order.orderNo,
        status: result.order.status,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: validationErrorMessage(error, "查询退款状态失败") },
      { status: 400 },
    );
  }
}
