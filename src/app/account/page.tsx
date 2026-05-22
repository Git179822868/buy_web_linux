import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Clock3, FileText, PackageCheck } from "lucide-react";

import { AccountLayout } from "@/components/account-layout";
import { formatMoney } from "@/lib/money";
import { customerOrderStatus } from "@/lib/order-labels";
import { prisma } from "@/lib/prisma";
import { getUserSession } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await getUserSession();

  if (!session) {
    redirect("/login");
  }

  const [user, orders, orderCount, paidTotal, pendingCount, completedCount] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: session.id } }),
    prisma.order.findMany({
      where: { userId: session.id },
      include: { package: true, paymentRecords: { orderBy: [{ attemptNo: "desc" }, { createdAt: "desc" }], take: 1 } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.order.count({ where: { userId: session.id } }),
    prisma.order.aggregate({
      where: { userId: session.id, status: { in: ["PAID", "FULFILLED", "REFUND_PENDING", "REFUNDED"] } },
      _sum: { amountCent: true },
    }),
    prisma.order.count({ where: { userId: session.id, status: { in: ["PENDING", "PAYING", "PAYMENT_FAILED", "REFUND_PENDING"] } } }),
    prisma.order.count({ where: { userId: session.id, status: "FULFILLED" } }),
  ]);

  return (
    <AccountLayout active="overview" user={user}>
      <div className="account-cards">
        <div className="account-card metric">
          <div className="account-card-icon">
            <FileText size={20} />
          </div>
          <p>订单总数</p>
          <strong>{orderCount}</strong>
        </div>
        <div className="account-card metric">
          <div className="account-card-icon">
            <PackageCheck size={20} />
          </div>
          <p>已完成</p>
          <strong>{completedCount}</strong>
        </div>
        <div className="account-card metric">
          <div className="account-card-icon">
            <Clock3 size={20} />
          </div>
          <p>待处理</p>
          <strong>{pendingCount}</strong>
        </div>
      </div>

      <div className="account-overview-grid">
        <section className="account-section compact">
          <div className="account-section-head">
            <h2>消费统计</h2>
            <Link href="/account/finance">查看明细</Link>
          </div>
          <div className="wealth-row">
            <span>累计支付</span>
            <strong>{formatMoney(paidTotal._sum.amountCent || 0, "cny")}</strong>
          </div>
        </section>

        <section className="account-section compact">
          <div className="account-section-head">
            <h2>我的服务</h2>
            <Link href="/">继续购买</Link>
          </div>
          <div className="service-summary">
            <span>账号关注、点赞、播放、推广套餐</span>
            <strong>已开通</strong>
          </div>
        </section>
      </div>

      <section className="account-section">
        <div className="account-section-head">
          <h2>最近订单</h2>
          <Link href="/account/orders">
            全部订单 <ArrowRight size={15} />
          </Link>
        </div>
        {orders.length ? (
          <div className="account-order-list">
            {orders.map((order) => {
              const customerStatus = customerOrderStatus(order);

              return (
                <Link className="account-order-card" href={`/order/${order.orderNo}`} key={order.id}>
                  <div>
                    <span className="muted">{order.orderNo}</span>
                    <strong>{order.package.name}</strong>
                    <div className="account-order-progress" aria-label={`订单进度 ${customerStatus.progress}%`}>
                      <span>
                        <i style={{ width: `${customerStatus.progress}%` }} />
                      </span>
                      <small>{customerStatus.detail}</small>
                    </div>
                  </div>
                  <div>
                    <span className={`status ${customerStatus.tone}`}>{customerStatus.label}</span>
                    <strong>{formatMoney(order.amountCent, order.currency)}</strong>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <span>暂无订单</span>
            <Link className="primary-button" href="/">去选择套餐</Link>
          </div>
        )}
      </section>
    </AccountLayout>
  );
}
