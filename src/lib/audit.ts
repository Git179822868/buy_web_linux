import { Prisma } from "@prisma/client";

import type { AdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function writeAudit(input: {
  admin: AdminSession;
  action: string;
  targetType: string;
  targetId?: string;
  detail?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      adminUserId: input.admin.id,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId || null,
      detailJson: input.detail ? (input.detail as Prisma.InputJsonObject) : undefined,
    },
  });
}
