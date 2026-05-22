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
    siteName?: string;
    operator?: string;
    icpNo?: string;
    copyright?: string;
    keywords?: string;
    description?: string;
    logoUrl?: string;
    icoUrl?: string;
    contacts?: Array<{
      id?: string;
      type: string;
      label: string;
      value?: string;
      qrUrl?: string;
      isEnabled?: boolean;
      sortOrder?: number;
    }>;
  };

  const normalizedContacts = (body.contacts || [])
    .map((contact, index) => ({
      id: contact.id,
      type: contact.type.trim(),
      label: contact.label.trim(),
      value: contact.value?.trim() || "",
      qrUrl: contact.qrUrl?.trim() || "",
      isEnabled: Boolean(contact.isEnabled),
      sortOrder: Number(contact.sortOrder || (index + 1) * 10),
    }))
    .filter((contact) => contact.type && contact.label);

  const setting = await prisma.siteSetting.upsert({
    where: { id: 1 },
    update: {
      siteName: body.siteName || "账号关注投放商城",
      operator: body.operator || null,
      icpNo: body.icpNo || null,
      copyright: body.copyright || null,
      keywords: body.keywords || null,
      description: body.description || null,
      logoUrl: body.logoUrl || null,
      icoUrl: body.icoUrl || null,
    },
    create: {
      id: 1,
      siteName: body.siteName || "账号关注投放商城",
      operator: body.operator || null,
      icpNo: body.icpNo || null,
      copyright: body.copyright || null,
      keywords: body.keywords || null,
      description: body.description || null,
      logoUrl: body.logoUrl || null,
      icoUrl: body.icoUrl || null,
    },
  });

  const existingContacts = await prisma.contactSetting.findMany({
    select: { id: true },
  });
  const incomingIds = new Set(normalizedContacts.map((contact) => contact.id).filter(Boolean));
  const deleteIds = existingContacts
    .map((contact) => contact.id)
    .filter((id) => !incomingIds.has(id));

  if (deleteIds.length) {
    await prisma.contactSetting.deleteMany({
      where: { id: { in: deleteIds } },
    });
  }

  for (const contact of normalizedContacts) {
    if (contact.id) {
      await prisma.contactSetting.update({
        where: { id: contact.id },
        data: {
          type: contact.type,
          label: contact.label,
          value: contact.value || null,
          qrUrl: contact.qrUrl || null,
          isEnabled: Boolean(contact.isEnabled),
          sortOrder: Number(contact.sortOrder || 0),
        },
      });
    } else {
      await prisma.contactSetting.create({
        data: {
          type: contact.type,
          label: contact.label,
          value: contact.value || null,
          qrUrl: contact.qrUrl || null,
          isEnabled: Boolean(contact.isEnabled),
          sortOrder: Number(contact.sortOrder || 0),
        },
      });
    }
  }

  await writeAudit({
    admin,
    action: "SITE_SETTING_UPDATE",
    targetType: "site_setting",
    targetId: String(setting.id),
    detail: {
      contactCount: normalizedContacts.length,
    },
  });

  return NextResponse.json({ setting });
}
