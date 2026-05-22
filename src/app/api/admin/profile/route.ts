import { NextResponse } from "next/server";

import { requireAdminWriteRequest } from "@/lib/admin-api";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request) {
  const { admin, response } = await requireAdminWriteRequest(request);

  if (response) {
    return response;
  }

  const body = (await request.json()) as {
    name?: string;
    phone?: string;
    avatarUrl?: string;
    bio?: string;
  };
  const updated = await prisma.adminUser.update({
    where: { id: admin.id },
    data: {
      name: body.name || null,
      phone: body.phone || null,
      avatarUrl: body.avatarUrl || null,
      bio: body.bio || null,
    },
  });

  await writeAudit({
    admin,
    action: "ADMIN_PROFILE_UPDATE",
    targetType: "admin_user",
    targetId: updated.id,
  });

  return NextResponse.json({ admin: updated });
}
