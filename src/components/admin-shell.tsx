import { ClipboardList, CreditCard, PackagePlus, PanelLeft, UserRound, UsersRound } from "lucide-react";
import Link from "next/link";

import { AdminLogoutButton } from "@/components/admin-logout-button";
import { prisma } from "@/lib/prisma";

export async function AdminShell({
  children,
  username,
}: {
  children: React.ReactNode;
  username: string;
}) {
  const [admin, pendingConfirmationCount] = await Promise.all([
    prisma.adminUser.findUnique({
      where: { username },
      select: {
        name: true,
      },
    }),
    prisma.order.count({
      where: {
        status: "PAID",
      },
    }),
  ]);
  const brandLabel = admin?.name?.trim() || username;
  const brandMark = brandLabel.slice(0, 1).toUpperCase() || "A";
  const pendingBadge = pendingConfirmationCount > 99 ? "99+" : String(pendingConfirmationCount);

  return (
    <div className="admin-shell">
      <input aria-label="后台菜单" className="admin-menu-state" id="admin-mobile-menu" type="checkbox" />
      <label className="admin-mobile-menu-button" htmlFor="admin-mobile-menu">
        <span className="brand-mark">{brandMark}</span>
        <span>菜单</span>
      </label>
      <label aria-hidden="true" className="admin-mobile-menu-backdrop" htmlFor="admin-mobile-menu" />
      <aside className="sidebar">
        <Link className="brand" href="/admin">
          <span className="brand-mark">{brandMark}</span>
          {brandLabel}
        </Link>
        <div className="sidebar-nav">
          <Link href="/admin">
            <PanelLeft size={16} /> 控制台
          </Link>
          <Link href="/admin/profile">
            <UserRound size={16} /> 账号信息
          </Link>
          <Link href="/admin/orders">
            <ClipboardList size={16} />
            <span>订单列表</span>
            {pendingConfirmationCount > 0 ? <span className="sidebar-count-badge">{pendingBadge}</span> : null}
          </Link>
          <Link href="/admin/packages">
            <PackagePlus size={16} /> 商品管理
          </Link>
          <Link href="/admin/users">
            <UsersRound size={16} /> 用户管理
          </Link>
          <Link href="/admin/finance">
            <CreditCard size={16} /> 财务明细
          </Link>
          <AdminLogoutButton />
        </div>
        <p className="muted" style={{ marginTop: 28 }}>
          当前账号：{username}
        </p>
      </aside>
      <main className="admin-content">{children}</main>
    </div>
  );
}
