import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getUserFromRequest, userUnauthorizedResponse } from "@/lib/user-auth";
import { accountProfileSchema, validationErrorMessage } from "@/lib/validation";

export async function PATCH(request: Request) {
  const session = await getUserFromRequest(request);

  if (!session) {
    return userUnauthorizedResponse();
  }

  try {
    const input = accountProfileSchema.parse(await request.json());
    const user = await prisma.user.update({
      where: { id: session.id },
      data: {
        avatarUrl: input.avatarUrl || null,
        nickname: input.nickname,
      },
      select: {
        avatarUrl: true,
        nickname: true,
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    const message = validationErrorMessage(error, "保存资料失败");
    return NextResponse.json({ message }, { status: 400 });
  }
}
