import { redirect } from "next/navigation";
import { KeyRound, ShieldCheck } from "lucide-react";

import { AccountLayout } from "@/components/account-layout";
import { CopyButton } from "@/components/copy-button";
import { ResetKeyButton } from "@/components/reset-key-button";
import { userAppId, userAppSecret } from "@/lib/account-keys";
import { prisma } from "@/lib/prisma";
import { getUserSession } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

export default async function AccountKeysPage() {
  const session = await getUserSession();

  if (!session) {
    redirect("/login");
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.id } });
  const appId = userAppId(user);
  const appSecret = userAppSecret(user);

  return (
    <AccountLayout active="keys" user={user}>
      <section className="account-section">
        <div className="account-section-head">
          <h2>密钥管理</h2>
        </div>

        <div className="key-grid">
          <div className="key-box">
            <span>
              <KeyRound size={18} />
              AppId
            </span>
            <code>{appId}</code>
            <CopyButton value={appId} />
          </div>
          <div className="key-box">
            <span>
              <ShieldCheck size={18} />
              AppSecret
            </span>
            <code>{appSecret}</code>
            <CopyButton value={appSecret} />
          </div>
        </div>

        <div className="key-note">
          <strong>接口密钥只在当前账号下有效</strong>
          <span>后续接入 API 下单时可用于身份校验，正式上线前建议通过后台为账号启用接口权限。</span>
        </div>

        <ResetKeyButton />
      </section>
    </AccountLayout>
  );
}
