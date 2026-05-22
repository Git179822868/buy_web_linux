import { redirect } from "next/navigation";

import { AdminProfileWorkspace } from "@/components/admin-profile-workspace";
import { AdminShell } from "@/components/admin-shell";
import { getAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminProfilePage() {
  const session = await getAdminSession();

  if (!session) {
    redirect("/admin/login");
  }

  const [profile, setting, contacts] = await Promise.all([
    prisma.adminUser.findUniqueOrThrow({
      where: { id: session.id },
    }),
    prisma.siteSetting.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1, siteName: "账号关注投放商城" },
    }),
    prisma.contactSetting.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  return (
    <AdminShell username={session.username}>
      <AdminProfileWorkspace
        contacts={contacts.map((item) => ({
          id: item.id,
          isEnabled: item.isEnabled,
          label: item.label,
          qrUrl: item.qrUrl,
          sortOrder: item.sortOrder,
          type: item.type,
          value: item.value,
        }))}
        profile={{
          avatarUrl: profile.avatarUrl,
          bio: profile.bio,
          name: profile.name,
          phone: profile.phone,
          username: profile.username,
        }}
        setting={{
          copyright: setting.copyright,
          description: setting.description,
          icoUrl: setting.icoUrl,
          icpNo: setting.icpNo,
          keywords: setting.keywords,
          logoUrl: setting.logoUrl,
          operator: setting.operator,
          siteName: setting.siteName,
        }}
      />
    </AdminShell>
  );
}
