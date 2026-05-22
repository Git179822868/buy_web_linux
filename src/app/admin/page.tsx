import { OrderStatus } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin-shell";
import { getAdminSession } from "@/lib/admin-auth";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const statusOrder: OrderStatus[] = [
  "PENDING",
  "PAYING",
  "PAID",
  "FULFILLED",
  "REFUND_PENDING",
  "REFUNDED",
  "PAYMENT_FAILED",
  "CANCELLED",
  "CLOSED",
];

const statusLabels: Record<OrderStatus, string> = {
  PENDING: "待支付",
  PAYING: "支付中",
  PAID: "已支付",
  PAYMENT_FAILED: "支付失败",
  CANCELLED: "已取消",
  FULFILLED: "已完成",
  REFUND_PENDING: "退款中",
  REFUNDED: "已退款",
  CLOSED: "已关闭",
};

const chartMetricConfig = {
  salesCent: {
    axis: "amount",
    color: "#4b5563",
    label: "销售总金额",
  },
  paidOrderCount: {
    axis: "count",
    color: "#ef4444",
    label: "销售订单数",
  },
  newUserCount: {
    axis: "count",
    color: "#f59e0b",
    label: "注册数量",
  },
} as const;

const chartMetricKeys = Object.keys(chartMetricConfig) as ChartMetricKey[];
const defaultMetricKeys: ChartMetricKey[] = ["salesCent", "paidOrderCount", "newUserCount"];

type ChartMetricKey = keyof typeof chartMetricConfig;

type DashboardSearchParams = Promise<{
  end?: string;
  metrics?: string | string[];
  start?: string;
}>;

type ChartPoint = {
  key: string;
  label: string;
  newUserCount: number;
  paidOrderCount: number;
  salesCent: number;
};

type MetricSummary = Pick<ChartPoint, "newUserCount" | "paidOrderCount" | "salesCent">;

function startOfDay(date: Date) {
  const next = new Date(date);

  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);

  next.setHours(23, 59, 59, 999);
  return next;
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);

  next.setDate(next.getDate() + amount);
  return next;
}

function toDayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDateInput(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return startOfDay(parsed);
}

function formatDateInput(date: Date) {
  return toDayKey(date);
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatAxisAmount(amountCent: number) {
  const amount = amountCent / 100;

  if (Math.abs(amount) >= 10000) {
    return `${(amount / 10000).toFixed(Math.abs(amount) >= 100000 ? 0 : 1)}万`;
  }

  return amount.toLocaleString("zh-CN", { maximumFractionDigits: 0 });
}

function normalizeMetricSelection(value?: string | string[]) {
  const rawValues = Array.isArray(value) ? value : value ? [value] : [];
  const selected = new Set<string>();

  for (const rawValue of rawValues) {
    for (const part of rawValue.split(",")) {
      const normalized = part.trim();

      if (normalized) {
        selected.add(normalized);
      }
    }
  }

  const metrics = chartMetricKeys.filter((key) => selected.has(key));

  return metrics.length ? metrics : [...defaultMetricKeys];
}

function summarizePoints(points: ChartPoint[]): MetricSummary {
  return points.reduce<MetricSummary>(
    (summary, point) => ({
      newUserCount: summary.newUserCount + point.newUserCount,
      paidOrderCount: summary.paidOrderCount + point.paidOrderCount,
      salesCent: summary.salesCent + point.salesCent,
    }),
    {
      newUserCount: 0,
      paidOrderCount: 0,
      salesCent: 0,
    },
  );
}

function formatMetricValue(metricKey: ChartMetricKey, value: number) {
  return chartMetricConfig[metricKey].axis === "amount"
    ? formatMoney(value, "cny")
    : value.toLocaleString("zh-CN");
}

function buildDashboardHref(start: Date, end: Date, metrics: ChartMetricKey[]) {
  const search = new URLSearchParams();

  search.set("start", formatDateInput(start));
  search.set("end", formatDateInput(end));

  for (const metric of metrics) {
    search.append("metrics", metric);
  }

  return `/admin?${search.toString()}`;
}

function AdminStatsLineChart({
  metrics,
  points,
}: {
  metrics: ChartMetricKey[];
  points: ChartPoint[];
}) {
  const amountMetrics = metrics.filter((metric) => chartMetricConfig[metric].axis === "amount");
  const countMetrics = metrics.filter((metric) => chartMetricConfig[metric].axis === "count");
  const chartWidth = Math.max(900, points.length * 74);
  const chartHeight = 320;
  const padding = { bottom: 50, left: 62, right: 62, top: 28 };
  const plotHeight = chartHeight - padding.top - padding.bottom;
  const plotWidth = chartWidth - padding.left - padding.right;
  const pointStep = points.length > 1 ? plotWidth / (points.length - 1) : 0;
  const amountMax = amountMetrics.length
    ? Math.max(...points.flatMap((point) => amountMetrics.map((metric) => point[metric])), 1)
    : 1;
  const countMax = countMetrics.length
    ? Math.max(...points.flatMap((point) => countMetrics.map((metric) => point[metric])), 1)
    : 1;
  const tickFractions = Array.from({ length: 5 }, (_, index) => index / 4);
  const labelEvery = Math.max(1, Math.ceil(points.length / 10));

  function xForIndex(index: number) {
    if (points.length === 1) {
      return padding.left + plotWidth / 2;
    }

    return padding.left + pointStep * index;
  }

  function yForValue(value: number, axisMax: number) {
    if (axisMax <= 0) {
      return padding.top + plotHeight;
    }

    return padding.top + plotHeight - (value / axisMax) * plotHeight;
  }

  return (
    <div className="stats-chart-scroll">
      <svg
        className="stats-chart-svg"
        height={chartHeight}
        role="img"
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        width={chartWidth}
      >
        <title>后台统计折线图</title>

        {tickFractions.map((fraction) => {
          const y = padding.top + plotHeight - fraction * plotHeight;

          return (
            <line
              key={`grid-${fraction}`}
              stroke="#e6efeb"
              strokeDasharray={fraction === 0 ? undefined : "5 5"}
              strokeWidth={1}
              x1={padding.left}
              x2={chartWidth - padding.right}
              y1={y}
              y2={y}
            />
          );
        })}

        {amountMetrics.length ? (
          <>
            <text fill="#7b8a85" fontSize="12" x={padding.left - 40} y={padding.top - 8}>
              金额
            </text>
            {tickFractions.map((fraction) => {
              const y = padding.top + plotHeight - fraction * plotHeight;

              return (
                <text
                  fill="#8a9892"
                  fontSize="12"
                  key={`left-${fraction}`}
                  textAnchor="end"
                  x={padding.left - 10}
                  y={y + 4}
                >
                  {formatAxisAmount(amountMax * fraction)}
                </text>
              );
            })}
          </>
        ) : null}

        {countMetrics.length ? (
          <>
            <text fill="#7b8a85" fontSize="12" textAnchor="end" x={chartWidth - 10} y={padding.top - 8}>
              数量
            </text>
            {tickFractions.map((fraction) => {
              const y = padding.top + plotHeight - fraction * plotHeight;

              return (
                <text
                  fill="#8a9892"
                  fontSize="12"
                  key={`right-${fraction}`}
                  textAnchor="start"
                  x={chartWidth - padding.right + 10}
                  y={y + 4}
                >
                  {Math.round(countMax * fraction)}
                </text>
              );
            })}
          </>
        ) : null}

        {metrics.map((metric) => {
          const config = chartMetricConfig[metric];
          const axisMax = config.axis === "amount" ? amountMax : countMax;
          const linePath = points
            .map((point, index) => `${xForIndex(index)},${yForValue(point[metric], axisMax)}`)
            .join(" ");

          return (
            <g key={metric}>
              <polyline
                fill="none"
                points={linePath}
                stroke={config.color}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
              />
              {points.map((point, index) => (
                <circle
                  cx={xForIndex(index)}
                  cy={yForValue(point[metric], axisMax)}
                  fill="#ffffff"
                  key={`${metric}-${point.key}`}
                  r={4}
                  stroke={config.color}
                  strokeWidth={2}
                >
                  <title>
                    {`${point.key} ${config.label} ${formatMetricValue(metric, point[metric])}`}
                  </title>
                </circle>
              ))}
            </g>
          );
        })}

        {points.map((point, index) => {
          const shouldRender = index % labelEvery === 0 || index === points.length - 1;

          if (!shouldRender) {
            return null;
          }

          return (
            <text
              fill="#8a9892"
              fontSize="12"
              key={`x-${point.key}`}
              textAnchor="middle"
              x={xForIndex(index)}
              y={chartHeight - 16}
            >
              {point.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: DashboardSearchParams;
}) {
  const session = await getAdminSession();

  if (!session) {
    redirect("/admin/login");
  }

  const params = await searchParams;
  const now = new Date();
  const today = startOfDay(now);
  const defaultEnd = today;
  const defaultStart = addDays(today, -6);
  const maxRangeDays = 90;

  let selectedStart = parseDateInput(params.start) ?? defaultStart;
  let selectedEnd = parseDateInput(params.end) ?? defaultEnd;

  if (selectedStart > selectedEnd) {
    [selectedStart, selectedEnd] = [selectedEnd, selectedStart];
  }

  if (selectedEnd > today) {
    selectedEnd = today;
  }

  const selectedSpan = Math.floor((selectedEnd.getTime() - selectedStart.getTime()) / 86400000) + 1;

  if (selectedSpan > maxRangeDays) {
    selectedStart = addDays(selectedEnd, -(maxRangeDays - 1));
  }

  const selectedMetricKeys = normalizeMetricSelection(params.metrics);
  const selectedRangeEnd = endOfDay(selectedEnd);
  const yesterdayStart = addDays(today, -1);
  const yesterdayEnd = endOfDay(yesterdayStart);

  const [
    orderCount,
    activePackageCount,
    userCount,
    paidOrderCount,
    refundOrderCount,
    paidTotals,
    userBalances,
    selectedPaidOrders,
    selectedUsers,
    yesterdayPaidOrders,
    yesterdayUsers,
    statusGroups,
    topPackageGroups,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.servicePackage.count({ where: { isActive: true } }),
    prisma.user.count(),
    prisma.order.count({ where: { paidAt: { not: null } } }),
    prisma.order.count({ where: { refundAmountCent: { gt: 0 } } }),
    prisma.order.aggregate({
      where: { paidAt: { not: null } },
      _sum: { amountCent: true, refundAmountCent: true },
    }),
    prisma.user.aggregate({
      _sum: { balanceCent: true },
    }),
    prisma.order.findMany({
      where: {
        paidAt: {
          gte: selectedStart,
          lte: selectedRangeEnd,
        },
      },
      select: {
        amountCent: true,
        paidAt: true,
      },
      orderBy: { paidAt: "asc" },
    }),
    prisma.user.findMany({
      where: {
        createdAt: {
          gte: selectedStart,
          lte: selectedRangeEnd,
        },
      },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.order.findMany({
      where: {
        paidAt: {
          gte: yesterdayStart,
          lte: yesterdayEnd,
        },
      },
      select: {
        amountCent: true,
      },
    }),
    prisma.user.findMany({
      where: {
        createdAt: {
          gte: yesterdayStart,
          lte: yesterdayEnd,
        },
      },
      select: { createdAt: true },
    }),
    prisma.order.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.order.groupBy({
      by: ["packageId"],
      where: { paidAt: { not: null } },
      _count: { _all: true },
      _sum: { amountCent: true, orderQuantity: true },
      orderBy: {
        _sum: { amountCent: "desc" },
      },
      take: 5,
    }),
  ]);

  const chartPointMap = new Map<string, ChartPoint>();

  for (let day = new Date(selectedStart); day <= selectedEnd; day = addDays(day, 1)) {
    const key = toDayKey(day);

    chartPointMap.set(key, {
      key,
      label: day.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" }),
      newUserCount: 0,
      paidOrderCount: 0,
      salesCent: 0,
    });
  }

  for (const order of selectedPaidOrders) {
    if (!order.paidAt) {
      continue;
    }

    const point = chartPointMap.get(toDayKey(order.paidAt));

    if (point) {
      point.salesCent += order.amountCent;
      point.paidOrderCount += 1;
    }
  }

  for (const user of selectedUsers) {
    const point = chartPointMap.get(toDayKey(user.createdAt));

    if (point) {
      point.newUserCount += 1;
    }
  }

  const chartPoints = Array.from(chartPointMap.values());
  const selectedSummary = summarizePoints(chartPoints);
  const yesterdaySummary: MetricSummary = {
    newUserCount: yesterdayUsers.length,
    paidOrderCount: yesterdayPaidOrders.length,
    salesCent: yesterdayPaidOrders.reduce((sum, item) => sum + item.amountCent, 0),
  };

  const grossSalesCent = paidTotals._sum.amountCent ?? 0;
  const refundTotalCent = paidTotals._sum.refundAmountCent ?? 0;
  const netRevenueCent = grossSalesCent - refundTotalCent;
  const totalBalanceCent = userBalances._sum.balanceCent ?? 0;
  const statusCountMap = new Map(statusGroups.map((item) => [item.status, item._count._all]));
  const fulfilledCount = statusCountMap.get("FULFILLED") ?? 0;
  const pendingCount =
    (statusCountMap.get("PENDING") ?? 0) +
    (statusCountMap.get("PAYING") ?? 0) +
    (statusCountMap.get("REFUND_PENDING") ?? 0);
  const averageOrderCent = paidOrderCount ? Math.round(grossSalesCent / paidOrderCount) : 0;
  const selectedAverageOrderCent = selectedSummary.paidOrderCount
    ? Math.round(selectedSummary.salesCent / selectedSummary.paidOrderCount)
    : 0;
  const paymentRate = orderCount ? paidOrderCount / orderCount : 0;
  const fulfillmentRate = paidOrderCount ? fulfilledCount / paidOrderCount : 0;
  const refundRate = grossSalesCent ? refundTotalCent / grossSalesCent : 0;

  const topPackageIds = topPackageGroups.map((item) => item.packageId);
  const topPackageRecords = topPackageIds.length
    ? await prisma.servicePackage.findMany({
        where: { id: { in: topPackageIds } },
        select: {
          categoryLabel: true,
          id: true,
          name: true,
        },
      })
    : [];

  const packageMap = new Map(
    topPackageRecords.map((item) => [
      item.id,
      { categoryLabel: item.categoryLabel, name: item.name },
    ]),
  );

  const topPackages = topPackageGroups.map((item) => ({
    categoryLabel: packageMap.get(item.packageId)?.categoryLabel ?? "未知分类",
    id: item.packageId,
    name: packageMap.get(item.packageId)?.name ?? "已删除商品",
    orderQuantity: item._sum.orderQuantity ?? 0,
    paidOrderCount: item._count._all,
    salesCent: item._sum.amountCent ?? 0,
  }));

  const statusBreakdown = statusOrder.map((status) => ({
    count: statusCountMap.get(status) ?? 0,
    label: statusLabels[status],
    status,
  }));

  const rangeLinks = [
    { label: "近7天", start: addDays(today, -6), end: today },
    { label: "近15天", start: addDays(today, -14), end: today },
    { label: "近30天", start: addDays(today, -29), end: today },
  ];

  return (
    <AdminShell username={session.username}>
      <div className="section-title">
        <div>
          <h1>控制台</h1>
          <p>把后台统计改成可选时间区间的折线图，按天查看销售、注册和订单走势。</p>
        </div>
        <div className="panel stats-note-panel">
          <span className="muted">统计更新时间</span>
          <strong>{now.toLocaleString("zh-CN")}</strong>
          <small>销售额和订单数按支付时间统计，注册数按创建时间统计。</small>
        </div>
      </div>

      <div className="admin-card-grid admin-card-grid-wide">
        <div className="metric-card">
          <span className="muted">销售总金额</span>
          <strong>{formatMoney(grossSalesCent, "cny")}</strong>
          <small>昨日累计 {formatMoney(yesterdaySummary.salesCent, "cny")}</small>
        </div>
        <div className="metric-card">
          <span className="muted">销售订单数</span>
          <strong>{paidOrderCount}</strong>
          <small>昨日累计 {yesterdaySummary.paidOrderCount}</small>
        </div>
        <div className="metric-card">
          <span className="muted">注册数量</span>
          <strong>{userCount}</strong>
          <small>昨日累计 {yesterdaySummary.newUserCount}</small>
        </div>
        <div className="metric-card">
          <span className="muted">净入账</span>
          <strong>{formatMoney(netRevenueCent, "cny")}</strong>
          <small>已退款 {formatMoney(refundTotalCent, "cny")}</small>
        </div>
        <div className="metric-card">
          <span className="muted">上架商品</span>
          <strong>{activePackageCount}</strong>
          <small>{topPackages[0] ? `成交第一：${topPackages[0].name}` : "暂无成交商品"}</small>
        </div>
        <div className="metric-card">
          <span className="muted">全部订单</span>
          <strong>{orderCount}</strong>
          <small>支付转化率 {formatPercent(paymentRate)}</small>
        </div>
        <div className="metric-card">
          <span className="muted">用户余额池</span>
          <strong>{formatMoney(totalBalanceCent, "cny")}</strong>
          <small>平均客单价 {formatMoney(averageOrderCent, "cny")}</small>
        </div>
      </div>

      <section className="panel stats-chart-panel">
        <div className="stats-chart-header">
          <div>
            <h2>统计数据</h2>
            <p>选择日期区间和指标，折线图会按天展示对应走势。</p>
          </div>
          <div className="stats-chart-range-note">
            <span className="muted">当前区间</span>
            <strong>
              {formatDateInput(selectedStart)} 至 {formatDateInput(selectedEnd)}
            </strong>
            <small>{chartPoints.length} 天数据</small>
          </div>
        </div>

        <form className="stats-filter-form">
          <div className="stats-filter-row">
            <div className="stats-date-range">
              <label className="stats-date-field">
                <span>开始日期</span>
                <input defaultValue={formatDateInput(selectedStart)} name="start" type="date" />
              </label>
              <span className="muted">至</span>
              <label className="stats-date-field">
                <span>结束日期</span>
                <input defaultValue={formatDateInput(selectedEnd)} name="end" type="date" />
              </label>
            </div>

            <div className="button-row">
              <button className="primary-button" type="submit">
                查询走势
              </button>
              <Link className="secondary-button" href="/admin">
                重置
              </Link>
            </div>
          </div>

          <div className="stats-filter-row">
            <div className="stats-range-links">
              {rangeLinks.map((item) => {
                const active = formatDateInput(item.start) === formatDateInput(selectedStart)
                  && formatDateInput(item.end) === formatDateInput(selectedEnd);

                return (
                  <Link
                    className={`stats-range-link ${active ? "active" : ""}`}
                    href={buildDashboardHref(item.start, item.end, selectedMetricKeys)}
                    key={item.label}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>

            <div className="stats-metric-selector">
              {chartMetricKeys.map((metricKey) => (
                <label
                  className={`stats-metric-option ${selectedMetricKeys.includes(metricKey) ? "active" : ""}`}
                  key={metricKey}
                >
                  <input
                    defaultChecked={selectedMetricKeys.includes(metricKey)}
                    name="metrics"
                    type="checkbox"
                    value={metricKey}
                  />
                  <span
                    className="stats-metric-dot"
                    style={{ backgroundColor: chartMetricConfig[metricKey].color }}
                  />
                  <strong>{chartMetricConfig[metricKey].label}</strong>
                </label>
              ))}
            </div>
          </div>
        </form>

        <div className="stats-chart-summary-grid">
          <div className="stats-chart-summary-card">
            <span>区间销售额</span>
            <strong>{formatMoney(selectedSummary.salesCent, "cny")}</strong>
            <small>日均 {formatMoney(Math.round(selectedSummary.salesCent / chartPoints.length), "cny")}</small>
          </div>
          <div className="stats-chart-summary-card">
            <span>区间支付订单</span>
            <strong>{selectedSummary.paidOrderCount}</strong>
            <small>区间客单价 {formatMoney(selectedAverageOrderCent, "cny")}</small>
          </div>
          <div className="stats-chart-summary-card">
            <span>区间注册数量</span>
            <strong>{selectedSummary.newUserCount}</strong>
            <small>平均每日 {Math.round(selectedSummary.newUserCount / chartPoints.length)}</small>
          </div>
        </div>

        <AdminStatsLineChart metrics={selectedMetricKeys} points={chartPoints} />
      </section>

      <div className="dashboard-grid">
        <section className="panel stats-panel">
          <div className="stats-panel-head">
            <div>
              <h2>订单状态分布</h2>
              <p>按全量订单查看支付、履约和售后状态，方便识别积压和异常节点。</p>
            </div>
            <strong>{orderCount}</strong>
          </div>
          <div className="distribution-list">
            {statusBreakdown.map((item) => (
              <div className="distribution-row" key={item.status}>
                <div className="distribution-copy">
                  <span className={`status ${item.status}`}>{item.label}</span>
                  <strong>{item.count}</strong>
                </div>
                <div className="distribution-bar">
                  <div
                    className={`distribution-fill ${item.status}`}
                    style={{
                      minWidth: item.count > 0 ? 10 : 0,
                      width: `${orderCount ? (item.count / orderCount) * 100 : 0}%`,
                    }}
                  />
                </div>
                <small>{formatPercent(orderCount ? item.count / orderCount : 0)}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="panel stats-panel">
          <div className="stats-panel-head">
            <div>
              <h2>运营健康度</h2>
              <p>折线图区间结果和全站经营指标放在一起，便于快速判断走势是否健康。</p>
            </div>
            <strong>{formatPercent(fulfillmentRate)}</strong>
          </div>
          <div className="stats-summary-list">
            <div className="summary-line">
              <span>区间销售额</span>
              <strong>{formatMoney(selectedSummary.salesCent, "cny")}</strong>
            </div>
            <div className="summary-line">
              <span>区间支付订单</span>
              <strong>{selectedSummary.paidOrderCount}</strong>
            </div>
            <div className="summary-line">
              <span>区间注册数</span>
              <strong>{selectedSummary.newUserCount}</strong>
            </div>
            <div className="summary-line">
              <span>支付转化率</span>
              <strong>{formatPercent(paymentRate)}</strong>
            </div>
            <div className="summary-line">
              <span>履约完成率</span>
              <strong>{formatPercent(fulfillmentRate)}</strong>
            </div>
            <div className="summary-line">
              <span>退款率</span>
              <strong>{formatPercent(refundRate)}</strong>
            </div>
            <div className="summary-line">
              <span>退款订单数</span>
              <strong>{refundOrderCount}</strong>
            </div>
            <div className="summary-line">
              <span>待处理订单</span>
              <strong>{pendingCount}</strong>
            </div>
          </div>
        </section>
      </div>

      <section className="panel stats-panel stats-table-panel">
        <div className="stats-panel-head">
          <div>
            <h2>商品成交排行</h2>
            <p>按累计销售额排序，快速看出后台最能带来收入的套餐。</p>
          </div>
          <strong>TOP {topPackages.length}</strong>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>商品</th>
                <th>销售额</th>
                <th>支付订单</th>
                <th>下单数量</th>
              </tr>
            </thead>
            <tbody>
              {topPackages.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="table-cell-stack">
                      <strong>{item.name}</strong>
                      <span>{item.categoryLabel}</span>
                    </div>
                  </td>
                  <td>{formatMoney(item.salesCent, "cny")}</td>
                  <td>{item.paidOrderCount}</td>
                  <td>{item.orderQuantity}</td>
                </tr>
              ))}
              {topPackages.length === 0 ? (
                <tr>
                  <td colSpan={4}>暂无成交商品数据</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
