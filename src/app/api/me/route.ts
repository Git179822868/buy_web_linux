import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/user-auth";

export async function GET(request: Request) {
  const session = await getUserFromRequest(request);

  if (!session) {
    return NextResponse.json({ user: null });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      phone: true,
      nickname: true,
      userNo: true,
      avatarUrl: true,
      balanceCent: true,
      status: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ user });
}
