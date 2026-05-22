"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export function UserLogoutButton() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <button className="account-menu-item" onClick={logout} type="button">
      <LogOut size={18} />
      退出登录
    </button>
  );
}
