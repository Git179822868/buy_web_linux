import Link from "next/link";
import { redirect } from "next/navigation";
import { Search, UserRound } from "lucide-react";

import { formatMoney, maskPhone } from "@/lib/money";
import { orderStatusLabel } from "@/lib/order-labels";
import { prisma } from "@/lib/prisma";
import { getUserSession } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

export default async function OrderSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const session = await getUserSession();

  if (!session) {
    redirect(`/login?next=${encodeURIComponent("/order/search")}`);
  }

  const keyword = q?.trim();
  const orders = keyword
    ? await prisma.order.findMany({
        where: {
          userId: session.id,
          OR: [{ orderNo: keyword }, { user: { phone: keyword } }],
        },
        include: {
          user: true,
          package: true,
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      })
    : [];

  return (
    <div className="market-shell">
      <header className="market-header">
        <nav className="market-nav" aria-label="主导航">
          <Link href="/">首页</Link>
          <Link className="active" href="/account/orders">订单</Link>
        </nav>
        <div className="market-header-actions">
          <Link className="user-avatar" href="/account">
            <UserRound size={24} />
          </Link>
        </div>
      </header>
      <main className="main">
        <div className="section-title">
          <div>
            <h1>订单查询</h1>
            <p>输入订单号或手机号查看购买记录。</p>
          </div>
        </div>

        <div className="panel" style={{ padding: 18 }}>
          <form className="button-row">
            <div className="field" style={{ flex: 1, minWidth: 260 }}>
              <label htmlFor="q">订单号 / 手机号</label>
              <input defaultValue={keyword || ""} id="q" name="q" placeholder="BW202605180001" />
            </div>
            <button className="primary-button" style={{ alignSelf: "end" }} type="submit">
              <Search size={17} />
              查询
            </button>
          </form>
        </div>

        {keyword ? (
          <div className="panel table-wrap" style={{ marginTop: 18 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>订单号</th>
                  <th>手机号</th>
                  <th>套餐</th>
                  <th>金额</th>
                  <th>状态</th>
                  <th>创建时间</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link href={`/order/${order.orderNo}`}>{order.orderNo}</Link>
                    </td>
                    <td>{maskPhone(order.user.phone)}</td>
                    <td>{order.package.name}</td>
                    <td>{formatMoney(order.amountCent, order.currency)}</td>
                    <td>
                      <span className={`status ${order.status}`}>{orderStatusLabel(order.status)}</span>
                    </td>
                    <td>{order.createdAt.toLocaleString("zh-CN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </main>
    </div>
  );
}
