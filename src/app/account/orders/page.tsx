import Link from "next/link";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { OrderStatus } from "@prisma/client";

import { AccountLayout } from "@/components/account-layout";
import { formatMoney } from "@/lib/money";
import { customerOrderStatus, paymentStatusLabel } from "@/lib/order-labels";
import { prisma } from "@/lib/prisma";
import { getUserSession } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

const statusTabs = [
  { key: "", label: "全部" },
  { key: "PENDING", label: "待支付" },
  { key: "PAYING", label: "进行中" },
  { key: "PAID", label: "处理中" },
  { key: "FULFILLED", label: "已完成" },
  { key: "REFUND_PENDING", label: "退款中" },
  { key: "REFUNDED", label: "已退款" },
  { key: "PAYMENT_FAILED", label: "异常中" },
];

export default async function AccountOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; target?: string }>;
}) {
  const session = await getUserSession();

  if (!session) {
    redirect("/login");
  }

  const { q, status, target } = await searchParams;
  const keyword = q?.trim();
  const targetKeyword = target?.trim();
  const statusFilter = status && Object.values(OrderStatus).includes(status as OrderStatus)
    ? (status as OrderStatus)
    : undefined;
  const [user, orders] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: session.id } }),
    prisma.order.findMany({
      where: {
        userId: session.id,
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(keyword
          ? {
              OR: [
                { orderNo: { contains: keyword } },
                { package: { name: { contains: keyword } } },
              ],
            }
          : {}),
        ...(targetKeyword ? { targetAccount: { contains: targetKeyword } } : {}),
      },
      include: { package: true, paymentRecords: { orderBy: [{ attemptNo: "desc" }, { createdAt: "desc" }], take: 1 } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return (
    <AccountLayout active="orders" user={user}>
      <section className="account-section">
        <div className="account-section-head">
          <h2>我的订单</h2>
          <Link href="/">继续购买</Link>
        </div>

        <div className="account-tabs">
          {statusTabs.map((tab) => (
            <Link
              className={(status || "") === tab.key ? "active" : ""}
              href={tab.key ? `/account/orders?status=${tab.key}` : "/account/orders"}
              key={tab.key || "all"}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        <form className="account-order-search">
          {statusFilter ? <input name="status" type="hidden" value={statusFilter} /> : null}
          <input defaultValue={keyword || ""} name="q" placeholder="请输入你的订单号或套餐名" />
          <input defaultValue={targetKeyword || ""} name="target" placeholder="请输入抖音号" />
          <button className="primary-button" type="submit">
            <Search size={17} />
            查询
          </button>
        </form>

        {orders.length ? (
          <div className="table-wrap account-table">
            <table className="data-table">
              <thead>
                <tr>
                  <th>订单号</th>
                  <th>套餐</th>
                  <th>抖音号</th>
                  <th>合作码</th>
                  <th>数量</th>
                  <th>支付</th>
                  <th>金额</th>
                  <th>状态</th>
                  <th>时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const customerStatus = customerOrderStatus(order);

                  return (
                    <tr key={order.id}>
                      <td data-label="订单号">{order.orderNo}</td>
                      <td data-label="套餐">{order.package.name}</td>
                      <td data-label="抖音号">{order.targetAccount}</td>
                      <td data-label="合作码">{order.cooperationCode || "-"}</td>
                      <td data-label="数量">{order.orderQuantity}</td>
                      <td data-label="支付">{paymentStatusLabel(order.paymentRecords[0]?.status)}</td>
                      <td data-label="金额">{formatMoney(order.amountCent, order.currency)}</td>
                      <td data-label="状态">
                        <div className="customer-order-state">
                          <div className="customer-order-state-head">
                            <span className={`status ${customerStatus.tone}`}>{customerStatus.label}</span>
                            <small>{customerStatus.progress}%</small>
                          </div>
                          <div className="customer-progress-track" aria-label={`订单进度 ${customerStatus.progress}%`}>
                            <span style={{ width: `${customerStatus.progress}%` }} />
                          </div>
                          <p>{customerStatus.detail}</p>
                        </div>
                      </td>
                      <td data-label="时间">{order.createdAt.toLocaleString("zh-CN")}</td>
                      <td data-label="操作">
                        <Link href={`/order/${order.orderNo}`}>查看</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <span>暂无匹配订单</span>
            <Link className="primary-button" href="/">去购买套餐</Link>
          </div>
        )}
      </section>
    </AccountLayout>
  );
}
