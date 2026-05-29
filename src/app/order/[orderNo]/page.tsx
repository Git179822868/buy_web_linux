import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, UserRound } from "lucide-react";

import { OrderPaymentPanel } from "@/components/order-payment-panel";
import { formatMoney, maskPhone } from "@/lib/money";
import { customerOrderStatus, paymentStatusLabel, refundStatusLabel } from "@/lib/order-labels";
import { prisma } from "@/lib/prisma";
import { getUserSession } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ orderNo: string }>;
}) {
  const { orderNo } = await params;
  const session = await getUserSession();

  if (!session) {
    redirect(`/login?next=${encodeURIComponent(`/order/${orderNo}`)}`);
  }

  const order = await prisma.order.findFirst({
    where: {
      orderNo,
      userId: session.id,
    },
    include: {
      user: true,
      package: true,
      paymentRecords: {
        orderBy: [{ attemptNo: "desc" }, { createdAt: "desc" }],
      },
      refundRecords: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!order) {
    notFound();
  }

  const payment = order.paymentRecords[0] || null;
  const isXiaohongshu = order.package.category === "xhs" || order.package.categoryLabel.includes("小红书");
  const customerStatus = customerOrderStatus(order);

  return (
    <div className="market-shell">
      <header className="market-header order-detail-header">
        <Link className="header-back-link" href="/account/orders">
          <ArrowLeft size={18} />
          <span>返回</span>
        </Link>
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
      <main className="main order-detail-main">
        <div className="workspace-grid order-detail-grid">
          <section className="order-detail-content">
            <div className="section-title order-detail-title">
              <div>
                <h1>订单 {order.orderNo}</h1>
                <p>{order.package.name}</p>
              </div>
              <span className={`status ${customerStatus.tone}`}>{customerStatus.label}</span>
            </div>

            <div className="panel order-customer-progress-panel">
              <div className="order-customer-progress-copy">
                <span>订单处理进度</span>
                <strong>{customerStatus.detail}</strong>
              </div>
              <div className="customer-progress-track" aria-label={`订单进度 ${customerStatus.progress}%`}>
                <span style={{ width: `${customerStatus.progress}%` }} />
              </div>
              <div className="order-customer-progress-meta">
                <span>已完成 {order.completedQuantity}/{order.orderQuantity} {order.package.unit}</span>
                <span>{customerStatus.progress}%</span>
              </div>
            </div>

            <div className="panel table-wrap order-info-panel">
              <table className="data-table">
                <tbody>
                  <tr>
                    <th>手机号</th>
                    <td>{maskPhone(order.user.phone)}</td>
                  </tr>
                  <tr>
                    <th>{isXiaohongshu ? "红薯账号" : "抖音号"}</th>
                    <td>{order.targetAccount}</td>
                  </tr>
                  {!isXiaohongshu ? (
                    <tr>
                      <th>合作码</th>
                      <td>{order.cooperationCode || "-"}</td>
                    </tr>
                  ) : null}
                  <tr>
                    <th>备注</th>
                    <td>{order.remark || "-"}</td>
                  </tr>
                  <tr>
                    <th>下单数量</th>
                    <td>
                      {order.orderQuantity} {order.package.unit}
                    </td>
                  </tr>
                  <tr>
                    <th>分类</th>
                    <td>{order.package.categoryLabel}</td>
                  </tr>
                  <tr>
                    <th>完成时间</th>
                    <td>{order.package.deliveryTime}</td>
                  </tr>
                  <tr>
                    <th>完成率</th>
                    <td>{order.package.completionRate}%</td>
                  </tr>
                  <tr>
                    <th>金额</th>
                    <td>{formatMoney(order.amountCent, order.currency)}</td>
                  </tr>
                  <tr>
                    <th>创建时间</th>
                    <td>{order.createdAt.toLocaleString("zh-CN")}</td>
                  </tr>
                  <tr>
                    <th>支付时间</th>
                    <td>{order.paidAt ? order.paidAt.toLocaleString("zh-CN") : "-"}</td>
                  </tr>
                  <tr>
                    <th>退款汇总</th>
                    <td>
                      {order.refundAmountCent > 0
                        ? `${formatMoney(order.refundAmountCent, order.currency)} / ${order.refundQuantity} ${order.package.unit}`
                        : "-"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="panel table-wrap order-history-panel">
              <h2>支付尝试记录</h2>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>尝试</th>
                    <th>渠道</th>
                    <th>状态</th>
                    <th>系统单号</th>
                    <th>创建时间</th>
                    <th>支付时间</th>
                  </tr>
                </thead>
                <tbody>
                  {order.paymentRecords.map((item) => (
                    <tr key={item.id}>
                      <td data-label="尝试">第 {item.attemptNo} 次</td>
                      <td data-label="渠道">{item.wayCode}</td>
                      <td data-label="状态">{paymentStatusLabel(item.status)}</td>
                      <td data-label="系统单号">{item.providerOrderId || "-"}</td>
                      <td data-label="创建时间">{item.createdAt.toLocaleString("zh-CN")}</td>
                      <td data-label="支付时间">{item.paidAt ? item.paidAt.toLocaleString("zh-CN") : "-"}</td>
                    </tr>
                  ))}
                  {order.paymentRecords.length === 0 ? (
                    <tr>
                      <td className="order-empty-cell" colSpan={6}>暂无支付尝试</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="panel table-wrap order-history-panel">
              <h2>退款记录</h2>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>退款单号</th>
                    <th>状态</th>
                    <th>金额</th>
                    <th>原因</th>
                    <th>创建时间</th>
                    <th>退款时间</th>
                  </tr>
                </thead>
                <tbody>
                  {order.refundRecords.map((item) => (
                    <tr key={item.id}>
                      <td data-label="退款单号">{item.refundNo}</td>
                      <td data-label="状态">{refundStatusLabel(item.status)}</td>
                      <td data-label="金额">{formatMoney(item.amountCent, item.currency)}</td>
                      <td data-label="原因">{item.reason}</td>
                      <td data-label="创建时间">{item.createdAt.toLocaleString("zh-CN")}</td>
                      <td data-label="退款时间">{item.refundedAt ? item.refundedAt.toLocaleString("zh-CN") : "-"}</td>
                    </tr>
                  ))}
                  {order.refundRecords.length === 0 ? (
                    <tr>
                      <td className="order-empty-cell" colSpan={6}>暂无退款记录</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <OrderPaymentPanel
            key={payment ? `${payment.id}:${payment.status}:${payment.wayCode}` : `none:${order.status}`}
            orderNo={order.orderNo}
            order={{
              amountCent: order.amountCent,
              createdAt: order.createdAt,
              currency: order.currency,
              packageName: order.package.name,
            }}
            payment={
              payment
                ? {
                    id: payment.id,
                    attemptNo: payment.attemptNo,
                    provider: payment.provider,
                    status: payment.status,
                    wayCode: payment.wayCode,
                    payDataType: payment.payDataType,
                    payData: payment.payData,
                    providerOrderId: payment.providerOrderId,
                    createdAt: payment.createdAt,
                    paidAt: payment.paidAt,
                  }
                : null
            }
            status={order.status}
          />
        </div>
      </main>
    </div>
  );
}
