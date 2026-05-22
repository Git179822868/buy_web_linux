import { redirect } from "next/navigation";
import Link from "next/link";

import { LoginForm } from "@/components/login-form";
import { getAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const session = await getAdminSession();

  if (session) {
    redirect("/admin");
  }

  return (
    <main className="login-page">
      <section className="panel login-card">
        <Link className="brand" href="/">
          <span className="brand-mark">R</span>
          RouteDesk Logistics
        </Link>
        <h1>客服后台登录</h1>
        <p className="muted">管理订单、查询用户购买记录和维护物流套餐。</p>
        <LoginForm />
      </section>
    </main>
  );
}
