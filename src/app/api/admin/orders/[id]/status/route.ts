import { NextResponse } from "next/server";

import { requireAdminWriteRequest } from "@/lib/admin-api";
import { writeAudit } from "@/lib/audit";
import { updateOrderManagementStatus } from "@/lib/purchase";
import { updateOrderManagementSchema, validationErrorMessage } from "@/lib/validation";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { admin, response } = await requireAdminWriteRequest(request);

    if (response) {
      return response;
    }

    const { id } = await context.params;
    const body = await request.json();
    const input = updateOrderManagementSchema.parse(body);
    const order = await updateOrderManagementStatus({
      orderId: id,
      action: input.action,
      completedQuantity: input.completedQuantity,
    });

    await writeAudit({
      admin,
      action: "ORDER_MANAGEMENT_UPDATE",
      targetType: "order",
      targetId: order.id,
      detail: {
        orderNo: order.orderNo,
        action: input.action,
        completedQuantity: input.completedQuantity,
        status: order.status,
        executedAt: order.executedAt,
      },
    });

    return NextResponse.json({ order });
  } catch (error) {
    return NextResponse.json({ message: validationErrorMessage(error, "更新订单状态失败") }, { status: 400 });
  }
}
