import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { requireAdminWriteRequest } from "@/lib/admin-api";
import { unauthorizedResponse } from "@/lib/admin-auth";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { accountPasswordSchema, validationErrorMessage } from "@/lib/validation";

export async function PATCH(request: Request) {
  const { admin, response } = await requireAdminWriteRequest(request);

  if (response) {
    return response;
  }

  try {
    const input = accountPasswordSchema.parse(await request.json());
    const adminUser = await prisma.adminUser.findUnique({
      where: { id: admin.id },
    });

    if (!adminUser) {
      return unauthorizedResponse();
    }

    const valid = await bcrypt.compare(input.currentPassword, adminUser.passwordHash);

    if (!valid) {
      return NextResponse.json({ message: "当前密码错误" }, { status: 400 });
    }

    await prisma.adminUser.update({
      where: { id: adminUser.id },
      data: {
        passwordHash: await bcrypt.hash(input.newPassword, 12),
      },
    });

    await writeAudit({
      action: "ADMIN_PASSWORD_UPDATE",
      admin,
      targetId: adminUser.id,
      targetType: "admin_user",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = validationErrorMessage(error, "修改密码失败");
    return NextResponse.json({ message }, { status: 400 });
  }
}
