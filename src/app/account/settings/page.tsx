import { redirect } from "next/navigation";

import { AccountLayout } from "@/components/account-layout";
import { AccountPasswordForm, AccountProfileForm } from "@/components/account-settings-forms";
import { prisma } from "@/lib/prisma";
import { getUserSession } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  const session = await getUserSession();

  if (!session) {
    redirect("/login");
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.id } });

  return (
    <AccountLayout active="settings" user={user}>
      <section className="account-section">
        <div className="account-section-head">
          <h2>账户设置</h2>
        </div>

        <div className="settings-grid">
          <div className="settings-panel">
            <h3>基础资料</h3>
            <AccountProfileForm user={user} />
          </div>
          <div className="settings-panel">
            <h3>重置密码</h3>
            <AccountPasswordForm />
          </div>
        </div>
      </section>
    </AccountLayout>
  );
}
