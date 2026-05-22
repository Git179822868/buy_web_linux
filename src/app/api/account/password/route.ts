import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getUserFromRequest, userUnauthorizedResponse } from "@/lib/user-auth";
import { accountPasswordSchema, validationErrorMessage } from "@/lib/validation";

export async function PATCH(request: Request) {
  const session = await getUserFromRequest(request);

  if (!session) {
    return userUnauthorizedResponse();
  }

  try {
    const input = accountPasswordSchema.parse(await request.json());
    const user = await prisma.user.findUnique({ where: { id: session.id } });

    if (!user) {
      return userUnauthorizedResponse();
    }

    const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);

    if (!valid) {
      return NextResponse.json({ message: "当前密码错误" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(input.newPassword, 12),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = validationErrorMessage(error, "修改密码失败");
    return NextResponse.json({ message }, { status: 400 });
  }
}
