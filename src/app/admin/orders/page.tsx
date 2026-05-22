import { redirect } from "next/navigation";
import { OrderStatus } from "@prisma/client";
import Link from "next/link";

import { AdminOrdersTable } from "@/components/admin-orders-table";
import { AdminShell } from "@/components/admin-shell";
import { getAdminSession } from "@/lib/admin-auth";
import { orderStatusLabel } from "@/lib/order-labels";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const orderStatusFilters: OrderStatus[] = [
  "PENDING",
  "PAYING",
  "PAID",
  "PAYMENT_FAILED",
  "CANCELLED",
  "FULFILLED",
  "REFUND_PENDING",
  "REFUNDED",
  "CLOSED",
];

function buildOrdersHref(keyword: string | undefined, status: OrderStatus | "") {
  const search = new URLSearchParams();

  if (keyword) {
    search.set("q", keyword);
  }

  if (status) {
    search.set("status", status);
  }

  const query = search.toString();

  return query ? `/admin/orders?${query}` : "/admin/orders";
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const session = await getAdminSession();

  if (!session) {
    redirect("/admin/login");
  }

  const { q, status } = await searchParams;
  const keyword = q?.trim();
  const statusFilter = status && Object.values(OrderStatus).includes(status as OrderStatus)
    ? (status as OrderStatus)
    : undefined;
  const orders = await prisma.order.findMany({
    where: {
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(keyword
        ? {
            OR: [
              { orderNo: { contains: keyword } },
              { user: { phone: { contains: keyword } } },
              { package: { name: { contains: keyword } } },
              { targetAccount: { contains: keyword } },
              { cooperationCode: { contains: keyword } },
            ],
          }
        : {}),
    },
    include: {
      user: true,
      package: true,
      paymentRecords: {
        orderBy: [{ attemptNo: "desc" }, { createdAt: "desc" }],
        take: 1,
      },
      refundRecords: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <AdminShell username={session.username}>
      <div className="toolbar">
        <div className="section-title" style={{ marginBottom: 0 }}>
          <div>
            <h1>订单管理</h1>
            <p>查询用户购买信息，查看支付状态并推进客服处理。</p>
          </div>
        </div>
        <form>
          <input defaultValue={keyword || ""} name="q" placeholder="订单号 / 手机号 / 套餐" />
          {statusFilter ? <input name="status" type="hidden" value={statusFilter} /> : null}
          <div className="admin-status-filter" aria-label="订单状态筛选">
            <Link
              className={`status-filter-chip ${!statusFilter ? "active" : ""}`}
              href={buildOrdersHref(keyword, "")}
            >
              全部状态
            </Link>
            {orderStatusFilters.map((item) => (
              <Link
                className={`status-filter-chip ${statusFilter === item ? "active" : ""}`}
                href={buildOrdersHref(keyword, item)}
                key={item}
              >
                {orderStatusLabel(item)}
              </Link>
            ))}
          </div>
          <button className="primary-button" type="submit">
            查询
          </button>
        </form>
      </div>

      <AdminOrdersTable
        orders={orders.map((order) => ({
          id: order.id,
          orderNo: order.orderNo,
          phone: order.user.phone,
          targetAccount: order.targetAccount,
          cooperationCode: order.cooperationCode,
          remark: order.remark,
          packageName: order.package.name,
          orderQuantity: order.orderQuantity,
          initialQuantity: order.initialQuantity,
          currentQuantity: order.currentQuantity,
          completedQuantity: order.completedQuantity,
          executedAt: order.executedAt,
          refundAmountCent: order.refundAmountCent,
          refundQuantity: order.refundQuantity,
          amountCent: order.amountCent,
          currency: order.currency,
          status: order.status,
          paymentStatus: order.paymentRecords[0]?.status || null,
          latestRefundId: order.refundRecords[0]?.id || null,
          latestRefundStatus: order.refundRecords[0]?.status || null,
          paidAt: order.paidAt,
          createdAt: order.createdAt,
        }))}
      />
    </AdminShell>
  );
}
