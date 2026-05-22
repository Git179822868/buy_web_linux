"use client";

import Link from "next/link";
import { UserRound } from "lucide-react";

type MarketHeaderProps = {
  active?: "home" | "orders";
  loginHref: string;
  showUserAvatar: boolean;
};

export function MarketHeader({ active = "home", loginHref, showUserAvatar }: MarketHeaderProps) {
  return (
    <header className="market-header">
      <nav className="market-nav" aria-label="主导航">
        <Link className={active === "home" ? "active" : ""} href="/">
          首页
        </Link>
        <Link className={active === "orders" ? "active" : ""} href="/account/orders">
          订单
        </Link>
      </nav>
      <div className="market-header-actions">
        {showUserAvatar ? (
          <Link className="user-avatar" href="/account" title="个人中心">
            <UserRound size={24} />
          </Link>
        ) : (
          <Link className="login-pill" href={loginHref}>
            登录/注册
          </Link>
        )}
      </div>
    </header>
  );
}
