import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin-shell";
import { getAdminSession } from "@/lib/admin-auth";
import { formatMoney, maskPhone } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminFinancePage() {
  const session = await getAdminSession();

  if (!session) {
    redirect("/admin/login");
  }

  const [ledgers, paidPayments, refundedPayments] = await Promise.all([
    prisma.balanceLedger.findMany({
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.paymentRecord.findMany({
      where: { status: "PAID" },
      include: {
        order: {
          include: {
            package: true,
            user: true,
          },
        },
      },
      orderBy: [{ paidAt: "desc" }, { updatedAt: "desc" }],
      take: 100,
    }),
    prisma.refundRecord.findMany({
      where: { status: "SUCCESS" },
      include: {
        order: {
          include: {
            user: true,
            package: true,
          },
        },
      },
      orderBy: [{ refundedAt: "desc" }, { updatedAt: "desc" }],
      take: 100,
    }),
  ]);

  const grossCent = paidPayments.reduce((sum, payment) => sum + payment.amountCent, 0);
  const refundCent = refundedPayments.reduce((sum, refund) => sum + refund.amountCent, 0);
  const netCent = grossCent - refundCent;

  const rows = [
    ...paidPayments.map((payment) => ({
      id: `payment-${payment.id}`,
      userPhone: payment.order.user.phone,
      type: `${payment.provider} 支付入账`,
      amountCent: payment.amountCent,
      balanceAfterCent: null as number | null,
      relatedOrder: payment.order.orderNo,
      remark: payment.order.package.name,
      createdAt: payment.paidAt || payment.updatedAt,
    })),
    ...refundedPayments.map((refund) => ({
      id: `refund-${refund.id}`,
      userPhone: refund.order.user.phone,
      type: `${refund.provider} 原路退款`,
      amountCent: -refund.amountCent,
      balanceAfterCent: null as number | null,
      relatedOrder: refund.order.orderNo,
      remark: refund.reason || refund.order.package.name,
      createdAt: refund.refundedAt || refund.updatedAt,
    })),
    ...ledgers.map((ledger) => ({
      id: `ledger-${ledger.id}`,
      userPhone: ledger.user.phone,
      type: ledger.type,
      amountCent: ledger.amountCent,
      balanceAfterCent: ledger.balanceAfterCent,
      relatedOrder: ledger.relatedOrderId || "-",
      remark: ledger.remark || "-",
      createdAt: ledger.createdAt,
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 100);

  return (
    <AdminShell username={session.username}>
      <div className="section-title">
        <div>
          <h1>财务明细</h1>
          <p>记录充值、购买、退款和手动调整流水。</p>
        </div>
      </div>
      <div className="admin-finance-summary">
        <div className="panel">
          <span>收款总额</span>
          <strong>{formatMoney(grossCent, "cny")}</strong>
        </div>
        <div className="panel">
          <span>退款总额</span>
          <strong>{formatMoney(refundCent, "cny")}</strong>
        </div>
        <div className="panel">
          <span>净收入</span>
          <strong>{formatMoney(netCent, "cny")}</strong>
        </div>
      </div>
      <div className="panel table-wrap">
        <table className="data-table mobile-card-table">
          <thead>
            <tr>
              <th>用户账号</th>
              <th>类型</th>
              <th>金额</th>
              <th>变动后余额</th>
              <th>关联订单</th>
              <th>备注</th>
              <th>时间</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td data-label="用户账号">{maskPhone(row.userPhone)}</td>
                <td data-label="类型">{row.type}</td>
                <td data-label="金额">{formatMoney(row.amountCent, "cny")}</td>
                <td data-label="变动后余额">{row.balanceAfterCent === null ? "-" : formatMoney(row.balanceAfterCent, "cny")}</td>
                <td data-label="关联订单">{row.relatedOrder}</td>
                <td data-label="备注">{row.remark}</td>
                <td data-label="时间">{row.createdAt.toLocaleString("zh-CN")}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7}>暂无数据</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
