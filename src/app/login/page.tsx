import { redirect } from "next/navigation";
import Link from "next/link";

import { UserLoginForm } from "@/components/user-login-form";
import { createCaptchaChallenge } from "@/lib/captcha";
import { getUserSession } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

function safeNextPath(next?: string) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/account";
  }

  return next;
}

export default async function UserLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await getUserSession();
  const { next } = await searchParams;
  const nextPath = safeNextPath(next);

  if (session) {
    redirect(nextPath);
  }

  return (
    <main className="user-login-page">
      <section className="login-visual" />
      <section className="user-login-panel">
        <Link className="login-close" href="/">
          ×
        </Link>
        <h1>登录</h1>
        <p>账号关注与新媒体服务订单中心</p>
        <UserLoginForm initialCaptcha={createCaptchaChallenge()} nextPath={nextPath} />
      </section>
    </main>
  );
}
