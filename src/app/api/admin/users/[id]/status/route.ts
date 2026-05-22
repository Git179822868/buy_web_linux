import { NextResponse } from "next/server";

import { requireAdminWriteRequest } from "@/lib/admin-api";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { admin, response } = await requireAdminWriteRequest(request);

  if (response) {
    return response;
  }

  const { id } = await context.params;
  const body = (await request.json()) as { status?: "ACTIVE" | "DISABLED" };
  const user = await prisma.user.update({
    where: { id },
    data: { status: body.status === "DISABLED" ? "DISABLED" : "ACTIVE" },
  });

  await writeAudit({
    admin,
    action: "USER_STATUS_UPDATE",
    targetType: "user",
    targetId: user.id,
    detail: { status: user.status },
  });

  return NextResponse.json({ user });
}
