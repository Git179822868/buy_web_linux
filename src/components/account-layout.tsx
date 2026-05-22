import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import {
  CreditCard,
  FileText,
  Headphones,
  Home,
  KeyRound,
  PackageCheck,
  Settings,
  UserRound,
} from "lucide-react";

import { CopyButton } from "@/components/copy-button";
import { UserLogoutButton } from "@/components/user-logout-button";
import { maskPhone } from "@/lib/money";

type AccountNavKey = "overview" | "orders" | "finance" | "content" | "settings" | "keys" | "support";

type AccountLayoutUser = {
  avatarUrl: string | null;
  balanceCent: number;
  createdAt: Date | string;
  nickname: string | null;
  phone: string;
  userNo: number;
};

const accountMenu: Array<{
  href: string;
  icon: ReactNode;
  key: AccountNavKey;
  label: string;
}> = [
  { href: "/account", icon: <Home size={18} />, key: "overview", label: "基础信息" },
  { href: "/account/orders", icon: <FileText size={18} />, key: "orders", label: "我的订单" },
  { href: "/account/finance", icon: <CreditCard size={18} />, key: "finance", label: "收支明细" },
  { href: "/account/content", icon: <PackageCheck size={18} />, key: "content", label: "内容管理" },
  { href: "/account/settings", icon: <Settings size={18} />, key: "settings", label: "账户设置" },
  { href: "/account/keys", icon: <KeyRound size={18} />, key: "keys", label: "密钥管理" },
  { href: "/account/support", icon: <Headphones size={18} />, key: "support", label: "联系客服" },
];

export function AccountLayout({
  active,
  children,
  user,
}: {
  active: AccountNavKey;
  children: ReactNode;
  user: AccountLayoutUser;
}) {
  const nickname = user.nickname || `用户${user.phone.slice(-4)}`;
  const localAvatarUrl = user.avatarUrl?.startsWith("/") ? user.avatarUrl : "";

  return (
    <div className="account-shell">
      <header className="account-topbar">
        <nav className="market-nav">
          <Link href="/">首页</Link>
          <Link href="/account/orders">订单</Link>
        </nav>
        <Link className="user-avatar" href="/account">
          <UserRound size={24} />
        </Link>
      </header>

      <main className="account-container">
        <section className="account-banner">
          <Image alt="" fill priority sizes="100vw" src="/assets/growth-hero.png" />
          <div className="account-profile">
            <div className="profile-avatar">
              {localAvatarUrl ? (
                <Image alt={nickname} fill sizes="96px" src={localAvatarUrl} />
              ) : (
                <UserRound size={58} />
              )}
            </div>
            <div className="profile-copy">
              <strong>{nickname}</strong>
              <span>{maskPhone(user.phone)}</span>
            </div>
            <div className="profile-id">
              <span>ID {user.userNo}</span>
              <CopyButton label="复制" value={String(user.userNo)} />
            </div>
          </div>
        </section>

        <div className="account-grid">
          <aside className="account-menu">
            {accountMenu.map((item) => (
              <Link
                className={`account-menu-item ${active === item.key ? "active" : ""}`}
                href={item.href}
                key={item.key}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
            <div className="account-menu-separator" />
            <UserLogoutButton />
          </aside>
          <section className="account-content">{children}</section>
        </div>
      </main>
    </div>
  );
}
