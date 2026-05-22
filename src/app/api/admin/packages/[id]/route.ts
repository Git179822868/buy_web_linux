import { NextResponse } from "next/server";

import { requireAdminWriteRequest } from "@/lib/admin-api";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { packageSchema, validationErrorMessage } from "@/lib/validation";

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
    const input = packageSchema.partial().parse(await request.json());
    const data = { ...input };

    if (!data.slug) {
      delete data.slug;
    }

    const servicePackage = await prisma.servicePackage.update({
      where: { id },
      data,
    });

    await writeAudit({
      admin,
      action: "PACKAGE_UPDATE",
      targetType: "package",
      targetId: servicePackage.id,
      detail: { slug: servicePackage.slug },
    });

    return NextResponse.json({ package: servicePackage });
  } catch (error) {
    return NextResponse.json({ message: validationErrorMessage(error, "更新套餐失败") }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { admin, response } = await requireAdminWriteRequest(request);

    if (response) {
      return response;
    }

    const { id } = await context.params;
    const servicePackage = await prisma.servicePackage.findUnique({
      where: { id },
    });

    if (!servicePackage) {
      return NextResponse.json({ message: "商品不存在" }, { status: 404 });
    }

    const orderCount = await prisma.order.count({
      where: { packageId: id },
    });

    if (orderCount > 0) {
      return NextResponse.json(
        { message: "该商品已有订单记录，不能永久删除，请使用下架隐藏商品" },
        { status: 400 },
      );
    }

    await prisma.servicePackage.delete({
      where: { id },
    });

    await writeAudit({
      admin,
      action: "PACKAGE_DELETE",
      targetType: "package",
      targetId: servicePackage.id,
      detail: { slug: servicePackage.slug, name: servicePackage.name },
    });

    return NextResponse.json({ deleted: true, package: servicePackage });
  } catch (error) {
    return NextResponse.json({ message: validationErrorMessage(error, "删除商品失败") }, { status: 400 });
  }
}
