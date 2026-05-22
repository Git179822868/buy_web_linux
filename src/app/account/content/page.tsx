import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageSquareText, PackageCheck } from "lucide-react";

import { AccountLayout } from "@/components/account-layout";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { getUserSession } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

const contentTabs = [
  { key: "favorites", label: "我的收藏" },
  { key: "workorders", label: "工单管理" },
];

export default async function AccountContentPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getUserSession();

  if (!session) {
    redirect("/login");
  }

  const { tab = "favorites" } = await searchParams;
  const activeTab = tab === "workorders" ? "workorders" : "favorites";

  const [user, recentOrders, recommendedPackages] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: session.id } }),
    prisma.order.findMany({
      where: { userId: session.id },
      include: { package: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.servicePackage.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      take: 6,
    }),
  ]);

  const packageMap = new Map<string, (typeof recommendedPackages)[number]>();
  recentOrders.forEach((order) => packageMap.set(order.package.id, order.package));
  recommendedPackages.forEach((item) => packageMap.set(item.id, item));
  const packages = Array.from(packageMap.values()).slice(0, 6);

  return (
    <AccountLayout active="content" user={user}>
      <section className="account-section">
        <div className="account-section-head">
          <h2>{activeTab === "favorites" ? "我的收藏" : "工单管理"}</h2>
          <Link href="/">浏览套餐</Link>
        </div>

        <div className="account-tabs">
          {contentTabs.map((item) => (
            <Link
              className={activeTab === item.key ? "active" : ""}
              href={`/account/content?tab=${item.key}`}
              key={item.key}
            >
              {item.label}
            </Link>
          ))}
        </div>

        {activeTab === "favorites" ? (
          packages.length ? (
            <div className="content-package-grid">
              {packages.map((item) => (
                <Link className="content-package-card" href={`/checkout?packageId=${item.id}`} key={item.id}>
                  <div className="content-package-image">
                    <Image alt={item.name} fill sizes="180px" src={item.imageUrl} />
                  </div>
                  <div>
                    <span>
                      <PackageCheck size={14} />
                      {item.categoryLabel}
                    </span>
                    <strong>{item.name}</strong>
                    <p>{item.deliveryTime} · 完成率 {item.completionRate}%</p>
                    <b>{formatMoney(item.priceCent, item.currency)}</b>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <span>暂无收藏套餐</span>
              <Link className="primary-button" href="/">去选择套餐</Link>
            </div>
          )
        ) : (
          <div className="empty-state support-empty">
            <MessageSquareText size={42} />
            <span>暂无工单</span>
            <Link className="primary-button" href="/account/support">联系客服</Link>
          </div>
        )}
      </section>
    </AccountLayout>
  );
}
