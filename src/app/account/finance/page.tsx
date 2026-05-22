import Link from "next/link";
import { redirect } from "next/navigation";
import { LedgerType } from "@prisma/client";

import { AccountLayout } from "@/components/account-layout";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { getUserSession } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

const financeTabs = [
  { key: "", label: "全部" },
  { key: "payments", label: "购买商品" },
  { key: "REFUND", label: "退款" },
  { key: "ADJUSTMENT", label: "系统调整" },
];

const ledgerTypeLabels: Record<LedgerType, string> = {
  ADJUSTMENT: "系统调整",
  PURCHASE: "余额扣款",
  RECHARGE: "充值",
  REFUND: "退款",
};

type FinanceRow = {
  amountCent: number;
  balanceAfterCent?: number;
  createdAt: Date;
  detail: string;
  id: string;
  label: string;
  title: string;
};

export default async function AccountFinancePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const session = await getUserSession();

  if (!session) {
    redirect("/login");
  }

  const { type: rawType = "" } = await searchParams;
  const type = ["", "payments", "REFUND", "ADJUSTMENT"].includes(rawType) ? rawType : "";
  const hiddenLedgerTypes: LedgerType[] = [LedgerType.RECHARGE, LedgerType.PURCHASE];
  const ledgerType = Object.values(LedgerType).includes(type as LedgerType) &&
    !hiddenLedgerTypes.includes(type as LedgerType)
    ? (type as LedgerType)
    : undefined;
  const showPayments = !type || type === "payments";
  const showRefundRows = !type || type === "payments" || type === "REFUND";
  const showLedgers = !type || Boolean(ledgerType);

  const [user, ledgers, payments, refunds] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: session.id } }),
    showLedgers
      ? prisma.balanceLedger.findMany({
        where: {
          userId: session.id,
          ...(ledgerType ? { type: ledgerType } : { type: { notIn: hiddenLedgerTypes } }),
        },
          orderBy: { createdAt: "desc" },
          take: 100,
        })
      : Promise.resolve([]),
    showPayments
      ? prisma.paymentRecord.findMany({
          where: {
            status: "PAID",
            order: { userId: session.id },
          },
          include: {
            order: {
              include: {
                package: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 100,
        })
      : Promise.resolve([]),
    showRefundRows
      ? prisma.refundRecord.findMany({
          where: {
            status: "SUCCESS",
            order: { userId: session.id },
          },
          include: {
            order: {
              include: {
                package: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 100,
        })
      : Promise.resolve([]),
  ]);

  const rows: FinanceRow[] = [
    ...payments.map((record) => ({
      amountCent: -record.amountCent,
      createdAt: record.paidAt || record.createdAt,
      detail: `订单 ${record.order.orderNo}`,
      id: `payment-${record.id}`,
      label: "购买商品",
      title: record.order.package.name,
    })),
    ...refunds.map((record) => ({
      amountCent: record.amountCent,
      createdAt: record.refundedAt || record.createdAt,
      detail: `订单 ${record.order.orderNo} 原路退款`,
      id: `refund-${record.id}`,
      label: "退款",
      title: record.order.package.name,
    })),
    ...ledgers.map((ledger) => ({
      amountCent: ledger.amountCent,
      balanceAfterCent: ledger.balanceAfterCent,
      createdAt: ledger.createdAt,
      detail: ledger.remark || (ledger.relatedOrderId ? `关联订单 ${ledger.relatedOrderId}` : "账户余额变动"),
      id: `ledger-${ledger.id}`,
      label: ledgerTypeLabels[ledger.type],
      title: ledgerTypeLabels[ledger.type],
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <AccountLayout active="finance" user={user}>
      <section className="account-section">
        <div className="account-section-head">
          <h2>收支明细</h2>
        </div>

        <div className="account-tabs finance-tabs">
          {financeTabs.map((tab) => (
            <Link
              className={type === tab.key ? "active" : ""}
              href={tab.key ? `/account/finance?type=${tab.key}` : "/account/finance"}
              key={tab.key || "all"}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {rows.length ? (
          <div className="finance-list">
            {rows.map((row) => (
              <div className="finance-row" key={row.id}>
                <div>
                  <span>{row.label}</span>
                  <strong>{row.title}</strong>
                  <p>{row.detail}</p>
                </div>
                <div className="finance-row-side">
                  <strong className={`money ${row.amountCent >= 0 ? "positive" : "negative"}`}>
                    {row.amountCent >= 0 ? "+" : "-"}
                    {formatMoney(Math.abs(row.amountCent), "cny")}
                  </strong>
                  <span>{row.createdAt.toLocaleString("zh-CN")}</span>
                  {typeof row.balanceAfterCent === "number" ? (
                    <em>余额 {formatMoney(row.balanceAfterCent, "cny")}</em>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <span>暂无收支记录</span>
          </div>
        )}
      </section>
    </AccountLayout>
  );
}
