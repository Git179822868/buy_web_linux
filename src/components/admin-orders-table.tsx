"use client";

import { type FormEvent, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { orderStatusLabel, paymentStatusLabel } from "@/lib/order-labels";
import { formatMoney } from "@/lib/money";

type AdminOrder = {
  id: string;
  orderNo: string;
  phone: string;
  targetAccount: string;
  cooperationCode: string | null;
  remark: string | null;
  packageName: string;
  orderQuantity: number;
  initialQuantity: number | null;
  currentQuantity: number | null;
  completedQuantity: number;
  executedAt: string | Date | null;
  refundAmountCent: number;
  refundQuantity: number;
  amountCent: number;
  currency: string;
  status: string;
  paymentStatus: string | null;
  latestRefundId: string | null;
  latestRefundStatus: string | null;
  paidAt: string | Date | null;
  createdAt: string | Date;
};

type RefundDraft = {
  amountYuan: string;
  reason: string;
};

type CompleteDraft = {
  completedQuantity: string;
};

function formatAdminDateTime(value: string | Date | null) {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleString("zh-CN");
}

function refundQuantityPreview(order: AdminOrder, refundAmountCent: number) {
  if (refundAmountCent <= 0 || order.amountCent <= 0) {
    return 0;
  }

  return Math.max(1, Math.min(order.orderQuantity, Math.round((refundAmountCent / order.amountCent) * order.orderQuantity)));
}

function defaultRefundDraft(order: AdminOrder): RefundDraft {
  return {
    amountYuan: (order.amountCent / 100).toFixed(2),
    reason: "未履约原路退回",
  };
}

function orderManagementMeta(order: AdminOrder) {
  if (order.status === "FULFILLED") {
    return {
      label: "已完成",
      tone: "FULFILLED",
      note: "订单已处理完成",
    };
  }

  if (order.status === "REFUND_PENDING") {
    return {
      label: "退款处理中",
      tone: "REFUND_PENDING",
      note: `已提交 ${formatMoney(order.refundAmountCent || order.amountCent, order.currency)} 退款申请`,
    };
  }

  if (order.status === "REFUNDED") {
    const isPartialRefund = order.refundAmountCent > 0 && order.refundAmountCent < order.amountCent;
    return {
      label: isPartialRefund ? "部分退款" : "已退款",
      tone: "REFUNDED",
      note: isPartialRefund
        ? `已退 ${formatMoney(order.refundAmountCent, order.currency)}，约折算 ${order.refundQuantity}/${order.orderQuantity}`
        : "订单金额已原路退回",
    };
  }

  if (order.status === "PAID" && order.executedAt) {
    return {
      label: "处理中",
      tone: "PAYING",
      note: `接单时间 ${formatAdminDateTime(order.executedAt)}`,
    };
  }

  if (order.status === "PAID") {
    return {
      label: "待接单",
      tone: "PENDING",
      note: "用户已支付，等待客服处理",
    };
  }

  if (order.status === "CANCELLED") {
    return {
      label: "已取消",
      tone: "CANCELLED",
      note: "订单已关闭，不可继续处理",
    };
  }

  return {
    label: "等待用户",
    tone: order.status,
    note: `当前为${orderStatusLabel(order.status)}状态`,
  };
}

export function AdminOrdersTable({ orders }: { orders: AdminOrder[] }) {
  const router = useRouter();
  const fixedScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState("");
  const [refundDraft, setRefundDraft] = useState<RefundDraft | null>(null);
  const [refundEditorId, setRefundEditorId] = useState<string | null>(null);
  const [completeOrder, setCompleteOrder] = useState<AdminOrder | null>(null);
  const [completeDraft, setCompleteDraft] = useState<CompleteDraft | null>(null);
  const [tableScrollWidth, setTableScrollWidth] = useState(1740);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    function updateScrollWidth() {
      setTableScrollWidth(Math.max(1740, tableScrollRef.current?.scrollWidth ?? 0));
    }

    updateScrollWidth();
    window.addEventListener("resize", updateScrollWidth);

    if (typeof ResizeObserver === "undefined" || !tableScrollRef.current) {
      return () => window.removeEventListener("resize", updateScrollWidth);
    }

    const tableElement = tableScrollRef.current.querySelector("table");
    const observer = new ResizeObserver(updateScrollWidth);

    observer.observe(tableScrollRef.current);

    if (tableElement) {
      observer.observe(tableElement);
    }

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateScrollWidth);
    };
  }, [orders.length, refundEditorId]);

  function syncHorizontalScroll(source: "fixed" | "table") {
    const current = source === "fixed" ? fixedScrollRef.current : tableScrollRef.current;
    const target = source === "fixed" ? tableScrollRef.current : fixedScrollRef.current;

    if (current && target && target.scrollLeft !== current.scrollLeft) {
      target.scrollLeft = current.scrollLeft;
    }
  }

  function updateManagementAction(id: string, action: string, completedQuantity?: number) {
    setError("");
    setPendingAction(`${id}:${action}`);
    startTransition(async () => {
      const response = await fetch(`/api/admin/orders/${id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, completedQuantity }),
      });
      const json = await response.json();

      if (!response.ok) {
        setError(json.message || "处理状态更新失败");
      }

      setPendingAction("");
      router.refresh();
    });
  }

  function submitProgress(event: FormEvent<HTMLFormElement>, order: AdminOrder) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const completedQuantity = Number(formData.get("completedQuantity"));

    if (!Number.isInteger(completedQuantity) || completedQuantity < 0) {
      setError("请输入有效的已完成数量");
      return;
    }

    if (completedQuantity > order.orderQuantity) {
      setError("已完成数量不能超过下单数量");
      return;
    }

    updateManagementAction(order.id, "PROGRESS", completedQuantity);
  }

  function openCompleteDialog(order: AdminOrder) {
    setError("");
    closeRefundEditor();
    setCompleteOrder(order);
    setCompleteDraft({ completedQuantity: String(order.completedQuantity) });
  }

  function closeCompleteDialog() {
    setCompleteOrder(null);
    setCompleteDraft(null);
  }

  function patchCompleteDraft(value: string) {
    setCompleteDraft({ completedQuantity: value });
  }

  function submitCompleteOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!completeOrder || !completeDraft) {
      return;
    }

    const completedQuantity = Number(completeDraft.completedQuantity);

    if (!Number.isInteger(completedQuantity) || completedQuantity < 0) {
      setError("请输入有效的已完成数量");
      return;
    }

    if (completedQuantity > completeOrder.orderQuantity) {
      setError("已完成数量不能超过下单数量");
      return;
    }

    const orderId = completeOrder.id;
    closeCompleteDialog();
    updateManagementAction(orderId, "COMPLETE", completedQuantity);
  }

  function openRefundFromCompleteDialog() {
    const order = completeOrder;
    closeCompleteDialog();

    if (order) {
      openRefundEditor(order);
    }
  }

  function openRefundEditor(order: AdminOrder) {
    setError("");
    setRefundDraft(defaultRefundDraft(order));
    setRefundEditorId(order.id);
  }

  function closeRefundEditor() {
    setRefundDraft(null);
    setRefundEditorId(null);
  }

  function patchRefundDraft(key: keyof RefundDraft, value: string) {
    setRefundDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  function createRefund(order: AdminOrder) {
    if (!refundDraft) {
      return;
    }

    const numericAmount = Number(refundDraft.amountYuan);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("请输入有效的退款金额");
      return;
    }

    const amountCent = Math.round(numericAmount * 100);

    if (amountCent > order.amountCent) {
      setError("退款金额不能超过订单实付金额");
      return;
    }

    const previewQuantity = refundQuantityPreview(order, amountCent);
    const confirmed = window.confirm(
      `确认向订单 ${order.orderNo} 发起 ${formatMoney(amountCent, order.currency)} 退款吗？预计折算退款数量约 ${previewQuantity}/${order.orderQuantity}。`,
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setPendingAction(`${order.id}:refund`);
    startTransition(async () => {
      const response = await fetch(`/api/admin/orders/${order.id}/refunds`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amountCent,
          reason: refundDraft.reason || "未履约原路退回",
        }),
      });
      const json = await response.json();

      if (!response.ok) {
        setError(json.message || "发起退款失败");
      } else {
        closeRefundEditor();
      }

      setPendingAction("");
      router.refresh();
    });
  }

  function queryRefund(refundId: string) {
    setError("");
    setPendingAction(`${refundId}:refund-query`);
    startTransition(async () => {
      const response = await fetch(`/api/admin/refunds/${refundId}/query`, {
        method: "POST",
      });
      const json = await response.json();

      if (!response.ok) {
        setError(json.message || "查询退款状态失败");
      }

      setPendingAction("");
      router.refresh();
    });
  }

  const completeQuantityNumber = completeDraft ? Number(completeDraft.completedQuantity) : 0;
  const completeShortfall = Boolean(
    completeOrder &&
    Number.isFinite(completeQuantityNumber) &&
    completeQuantityNumber < completeOrder.orderQuantity,
  );

  return (
    <>
      {error ? <p className="error-text">{error}</p> : null}
      <div className="panel admin-orders-note">
        <strong>退款与进度说明</strong>
        <p>进度提交只保存已完成数量，不会自动完成订单；点击完成订单时必须再次填写实际完成数量。未足量完成的订单可以设置退费金额和原因，再确认发起原路退费。</p>
      </div>
      <div
        className="panel table-wrap admin-orders-table-wrap"
        onScroll={() => syncHorizontalScroll("table")}
        ref={tableScrollRef}
      >
        <table className="data-table admin-orders-table">
          <thead>
            <tr>
              <th>操作</th>
              <th>处理状态</th>
              <th>订单状态</th>
              <th>订单号</th>
              <th>手机号</th>
              <th>抖音号</th>
              <th>合作码</th>
              <th>备注</th>
              <th>套餐</th>
              <th>下单数量</th>
              <th>交付进度</th>
              <th>金额</th>
              <th>支付</th>
              <th>创建时间</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const progressBase = Math.max(order.orderQuantity, 1);
              const completedPercent = Math.max(
                0,
                Math.min(100, Math.round((order.completedQuantity / progressBase) * 100)),
              );
              const refundedPercent = Math.max(
                0,
                Math.min(100, Math.round((order.refundQuantity / progressBase) * 100)),
              );
              const management = orderManagementMeta(order);
              const canStartProcessing = order.status === "PAID" && !order.executedAt;
              const canComplete = order.status === "PAID" && Boolean(order.executedAt);
              const canReturnProcessing = order.status === "FULFILLED";
              const canUpdateProgress = order.status === "PAID";
              const hasRefundLock = ["CREATED", "REFUNDING", "SUCCESS"].includes(order.latestRefundStatus || "");
              const canRefund =
                (order.status === "PAID" || order.status === "FULFILLED") &&
                order.completedQuantity < order.orderQuantity &&
                order.refundAmountCent < order.amountCent &&
                !hasRefundLock;
              const canQueryRefund =
                Boolean(order.latestRefundId) &&
                ["CREATED", "REFUNDING"].includes(order.latestRefundStatus || "");

              return (
                <tr key={order.id}>
                  <td data-label="操作">
                    <div className="admin-order-actions">
                      {canStartProcessing ? (
                        <button
                          className="primary-button small"
                          disabled={isPending && pendingAction.startsWith(`${order.id}:`)}
                          onClick={() => updateManagementAction(order.id, "PROCESSING")}
                          type="button"
                        >
                          开始接单
                        </button>
                      ) : null}
                      {canComplete ? (
                        <button
                          className="primary-button small"
                          disabled={isPending && pendingAction.startsWith(`${order.id}:`)}
                          onClick={() => openCompleteDialog(order)}
                          type="button"
                        >
                          完成订单
                        </button>
                      ) : null}
                      {canReturnProcessing ? (
                        <button
                          className="secondary-button small"
                          disabled={isPending && pendingAction.startsWith(`${order.id}:`)}
                          onClick={() => updateManagementAction(order.id, "RETURN_PROCESSING")}
                          type="button"
                        >
                          退回处理中
                        </button>
                      ) : null}
                      {!canStartProcessing && !canComplete && !canReturnProcessing && !canRefund && !canQueryRefund ? (
                        <span className="admin-order-action-placeholder">当前无需处理</span>
                      ) : null}
                      {canRefund ? (
                        <button
                          className="secondary-button small"
                          disabled={isPending && pendingAction.startsWith(`${order.id}:`)}
                          onClick={() => openRefundEditor(order)}
                          type="button"
                        >
                          退费
                        </button>
                      ) : null}
                      {canQueryRefund && order.latestRefundId ? (
                        <button
                          className="secondary-button small"
                          disabled={isPending && pendingAction === `${order.latestRefundId}:refund-query`}
                          onClick={() => queryRefund(order.latestRefundId!)}
                          type="button"
                        >
                          刷新退款
                        </button>
                      ) : null}
                      {refundEditorId === order.id && refundDraft ? (
                        <div className="refund-editor">
                          <p className="refund-editor-warning">确认后会通过支付宝或微信商家通道发起原路退费，请先核对金额、原因和完成情况。</p>
                          <div className="field">
                            <label>退费金额（元）</label>
                            <input
                              inputMode="decimal"
                              min="0.01"
                              onChange={(event) => patchRefundDraft("amountYuan", event.target.value)}
                              step="0.01"
                              type="number"
                              value={refundDraft.amountYuan}
                            />
                            <small className="field-hint">本单最多可退 {formatMoney(order.amountCent, order.currency)}</small>
                          </div>
                          <div className="field">
                            <label>退费原因</label>
                            <textarea
                              onChange={(event) => patchRefundDraft("reason", event.target.value)}
                              rows={2}
                              value={refundDraft.reason}
                            />
                          </div>
                          <div className="refund-editor-summary">
                            <span>预计退费 {formatMoney(Math.max(0, Math.round((Number(refundDraft.amountYuan) || 0) * 100)), order.currency)}</span>
                            <span>预计折算数量约 {refundQuantityPreview(order, Math.max(0, Math.round((Number(refundDraft.amountYuan) || 0) * 100)))}/{order.orderQuantity}</span>
                            <span>未足量完成的订单支持按实际金额退费</span>
                          </div>
                          <div className="button-row">
                            <button
                              className="danger-button small"
                              disabled={isPending && pendingAction.startsWith(`${order.id}:`)}
                              onClick={() => createRefund(order)}
                              type="button"
                            >
                              确认退费
                            </button>
                            <button className="secondary-button small" onClick={closeRefundEditor} type="button">
                              取消
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td data-label="处理状态">
                    <div className="table-cell-stack order-management-copy">
                      <span className={`status ${management.tone}`}>{management.label}</span>
                      <span>{management.note}</span>
                    </div>
                  </td>
                  <td data-label="订单状态">
                    <span className={`status ${order.status}`}>{orderStatusLabel(order.status)}</span>
                  </td>
                  <td data-label="订单号">
                    <Link href={`/order/${order.orderNo}`} target="_blank">
                      {order.orderNo}
                    </Link>
                  </td>
                  <td data-label="手机号">{order.phone}</td>
                  <td className="order-highlight-cell" data-label="抖音号">{order.targetAccount}</td>
                  <td className="order-highlight-cell" data-label="合作码">{order.cooperationCode || "-"}</td>
                  <td data-label="备注">{order.remark || "-"}</td>
                  <td data-label="套餐">{order.packageName}</td>
                  <td data-label="下单数量">{order.orderQuantity}</td>
                  <td data-label="交付进度">
                    <div className="order-progress-cell">
                      <div
                        aria-hidden="true"
                        className="order-progress-track"
                      >
                        <div
                          className="order-progress-fill"
                          style={{ width: `${completedPercent}%` }}
                        />
                        {refundedPercent > 0 ? (
                          <div
                            className="order-progress-refund"
                            style={{ width: `${refundedPercent}%` }}
                          />
                        ) : null}
                      </div>
                      <div className="order-progress-copy">
                        <strong>{completedPercent}%</strong>
                        <div>
                          <span>
                            已完成 {order.completedQuantity}/{order.orderQuantity}
                            {order.refundQuantity > 0 ? `，退款 ${order.refundQuantity}` : ""}
                          </span>
                          <small>提交只记录进度，满额后仍需点击完成订单确认</small>
                        </div>
                      </div>
                      <form className="order-progress-form" onSubmit={(event) => submitProgress(event, order)}>
                        <input
                          aria-label={`订单 ${order.orderNo} 已完成数量`}
                          defaultValue={order.completedQuantity}
                          disabled={!canUpdateProgress || (isPending && pendingAction.startsWith(`${order.id}:`))}
                          inputMode="numeric"
                          max={order.orderQuantity}
                          min={0}
                          name="completedQuantity"
                          type="number"
                        />
                        <button
                          className="secondary-button small"
                          disabled={!canUpdateProgress || (isPending && pendingAction.startsWith(`${order.id}:`))}
                          type="submit"
                        >
                          提交进度
                        </button>
                      </form>
                    </div>
                  </td>
                  <td data-label="金额">{formatMoney(order.amountCent, order.currency)}</td>
                  <td data-label="支付">{paymentStatusLabel(order.paymentStatus)}</td>
                  <td data-label="创建时间">{formatAdminDateTime(order.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="admin-orders-fixed-scroll" aria-label="订单表横向滚动条">
        <span>左右滑动查看更多订单字段</span>
        <div
          className="admin-orders-fixed-scroll-track"
          onScroll={() => syncHorizontalScroll("fixed")}
          ref={fixedScrollRef}
        >
          <div className="admin-orders-scroll-spacer" style={{ width: tableScrollWidth }} />
        </div>
      </div>
      {completeOrder && completeDraft ? (
        <div className="admin-order-modal" role="dialog" aria-modal="true" aria-labelledby="complete-order-title">
          <button
            aria-label="关闭完成订单确认"
            className="admin-order-modal-backdrop"
            onClick={closeCompleteDialog}
            type="button"
          />
          <form className="admin-order-modal-panel" onSubmit={submitCompleteOrder}>
            <h2 id="complete-order-title">确认完成订单</h2>
            <p>为防止误点完成订单，必须填写这笔订单实际完成的人数。即使没有全部完成也可以确认完成，未完成部分可单独退费。</p>
            <div className="admin-order-modal-summary">
              <span>订单号</span>
              <strong>{completeOrder.orderNo}</strong>
              <span>套餐</span>
              <strong>{completeOrder.packageName}</strong>
              <span>下单数量</span>
              <strong>{completeOrder.orderQuantity}</strong>
            </div>
            <div className="field">
              <label htmlFor="complete-quantity">实际完成数量</label>
              <input
                id="complete-quantity"
                inputMode="numeric"
                max={completeOrder.orderQuantity}
                min={0}
                onChange={(event) => patchCompleteDraft(event.target.value)}
                type="number"
                value={completeDraft.completedQuantity}
              />
              <small className="field-hint">填写后订单会变为已完成；不会再根据进度自动完成。</small>
            </div>
            {completeShortfall ? (
              <div className="admin-order-shortfall">
                <strong>当前未足量完成</strong>
                <span>未完成 {completeOrder.orderQuantity - completeQuantityNumber}，可先取消并设置退费，或直接确认完成后再退费。</span>
                <button className="secondary-button small" onClick={openRefundFromCompleteDialog} type="button">
                  打开退费
                </button>
              </div>
            ) : null}
            <div className="button-row admin-order-modal-actions">
              <button className="secondary-button" onClick={closeCompleteDialog} type="button">
                取消
              </button>
              <button
                className="primary-button"
                disabled={isPending && pendingAction.startsWith(`${completeOrder.id}:`)}
                type="submit"
              >
                确认完成订单
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
