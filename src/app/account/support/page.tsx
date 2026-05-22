/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { redirect } from "next/navigation";
import { QrCode } from "lucide-react";

import { AccountLayout } from "@/components/account-layout";
import { CopyButton } from "@/components/copy-button";
import { prisma } from "@/lib/prisma";
import { getUserSession } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

const contactTypeLabels: Record<string, string> = {
  phone: "电话",
  qq: "QQ",
  support: "联系方式",
  wechat: "微信",
};

export default async function AccountSupportPage() {
  const session = await getUserSession();

  if (!session) {
    redirect("/login");
  }

  const [user, savedContacts] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: session.id } }),
    prisma.contactSetting.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
  ]);
  const contacts = savedContacts.filter((contact) => {
    const hasContent = Boolean(contact.value || contact.qrUrl);
    const isDefaultPlaceholder = contact.type === "support" && contact.label === "联系方式" && !hasContent;

    return !isDefaultPlaceholder && Boolean(contact.label || hasContent);
  });

  return (
    <AccountLayout active="support" user={user}>
      <section className="account-section">
        <div className="account-section-head">
          <h2>联系客服</h2>
          <Link href="/account/orders">查看订单</Link>
        </div>

        <div className="contact-list">
          {contacts.length ? (
            contacts.map((contact) => {
              const typeLabel = contactTypeLabels[contact.type] || contact.type.toUpperCase();
              const title = contact.label || typeLabel;
              const displayValue = contact.value || (contact.qrUrl ? "扫码添加客服" : "");
              const copyValue = contact.value || contact.label;

              return (
                <article className="support-contact-card" key={contact.id}>
                  <div className="support-contact-copy">
                    <span>{typeLabel}</span>
                    <strong>{title}</strong>
                    {displayValue ? <p>{displayValue}</p> : null}
                    {copyValue ? <CopyButton value={copyValue} /> : null}
                  </div>
                  {contact.qrUrl ? (
                    <div className="support-contact-side">
                      <div className="support-qr-preview">
                        <div className="support-qr-label">
                          <QrCode size={16} />
                          {typeLabel}二维码
                        </div>
                        <div className="support-qr-hover">
                          <img alt={`${contact.label} 二维码`} className="support-qr-thumb" src={contact.qrUrl} />
                          <div className="support-qr-popover">
                            <img alt={`${contact.label} 大图二维码`} src={contact.qrUrl} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })
          ) : (
            <div className="empty-state contact-empty">
              <span>客服信息待配置</span>
            </div>
          )}
        </div>
      </section>
    </AccountLayout>
  );
}
