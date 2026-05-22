import type { Metadata } from "next";

import { SiteFooter } from "@/components/site-footer";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "账号关注投放商城",
  description: "账号关注、点赞、播放套餐购买和订单管理系统",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
