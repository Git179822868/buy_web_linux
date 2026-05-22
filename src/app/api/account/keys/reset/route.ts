import { randomBytes } from "crypto";
import { NextResponse } from "next/server";

import { userAppSecret } from "@/lib/account-keys";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest, userUnauthorizedResponse } from "@/lib/user-auth";

export async function POST(request: Request) {
  const session = await getUserFromRequest(request);

  if (!session) {
    return userUnauthorizedResponse();
  }

  const user = await prisma.user.update({
    where: { id: session.id },
    data: {
      apiSecretSalt: randomBytes(24).toString("base64url"),
    },
    select: {
      apiSecretSalt: true,
      id: true,
      phone: true,
    },
  });

  return NextResponse.json({
    appSecret: userAppSecret(user),
  });
}
