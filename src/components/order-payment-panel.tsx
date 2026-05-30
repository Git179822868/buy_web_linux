"use client";

import { ExternalLink, RefreshCw, ScanLine } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { payMethodForWayCode, payMethodOptions, type PayMethod } from "@/lib/payment-gateway";
import { paymentStatusLabel } from "@/lib/order-labels";
import { usePaymentSurface } from "@/lib/use-payment-surface";

type Payment = {
  id: string;
  attemptNo: number;
  failureReason: string | null;
  provider: string;
  status: string;
  wayCode: string;
  payDataType: string | null;
  payData: string | null;
  providerOrderId: string | null;
  createdAt: string | Date;
  paidAt: string | Date | null;
};

type OrderSummary = {
  amountCent: number;
  currency: string;
  packageName: string;
  createdAt: string | Date;
};

type GeneratedQrCode = {
  source: string;
  dataUrl: string;
};

export function OrderPaymentPanel({
  orderNo,
  order,
  status,
  payment,
}: {
  orderNo: string;
  order: OrderSummary;
  status: string;
  payment: Payment | null;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [payMethod, setPayMethod] = useState<PayMethod>(payMethodForWayCode(payment?.wayCode));
  const [qrCode, setQrCode] = useState<GeneratedQrCode | null>(null);
  const [isPending, startTransition] = useTransition();
  const paymentFormRef = useRef<HTMLDivElement | null>(null);
  const { isMobileSurface, isWeChatBrowser } = usePaymentSurface();
  const paid = status === "PAID" || status === "FULFILLED";
  const paymentFailed = status === "PAYMENT_FAILED" || payment?.status === "FAILED";
  const refundPending = status === "REFUND_PENDING";
  const refunded = status === "REFUNDED";
  const visiblePayMethods = useMemo(() => {
    const surface = isMobileSurface ? "mobile" : "desktop";
    return payMethodOptions.filter((method) => method.surfaces.includes(surface));
  }, [isMobileSurface]);
  const activePayMethod = useMemo(() => {
    const visibleIds = new Set(visiblePayMethods.map((method) => method.id));

    if (visibleIds.has(payMethod)) {
      return payMethod;
    }

    const paymentMethod = payMethodForWayCode(payment?.wayCode);
    if (visibleIds.has(paymentMethod)) {
      return paymentMethod;
    }

    return isMobileSurface ? "wechat_h5" : "wechat_native";
  }, [isMobileSurface, payMethod, payment?.wayCode, visiblePayMethods]);
  const qrDataUrl = payment?.payDataType === "codeUrl" && qrCode?.source === payment.payData
    ? qrCode.dataUrl
    : "";

  useEffect(() => {
    if (payment?.payDataType !== "codeUrl" || !payment.payData) {
      return;
    }

    let cancelled = false;
    const source = payment.payData;

    QRCode.toDataURL(source, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 256,
    })
      .then((value) => {
        if (!cancelled) {
          setQrCode({
            dataUrl: value,
            source,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrCode(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [payment?.payData, payment?.payDataType]);

  function amountYuan() {
    return (order.amountCent / 100).toFixed(2);
  }

  function displayDate(value: string | Date) {
    return new Date(value).toLocaleString("zh-CN", { hour12: false });
  }

  function queryPayment() {
    setError("");
    startTransition(async () => {
      const response = await fetch(`/api/orders/${orderNo}/payments/query`, {
        method: "POST",
      });
      const json = await response.json();

      if (!response.ok) {
        setError(json.message || "查询支付状态失败");
        return;
      }

      router.refresh();
    });
  }

  function retryPayment() {
    setError("");
    startTransition(async () => {
      const response = await fetch(`/api/orders/${orderNo}/payments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ payMethod: activePayMethod }),
      });
      const json = await response.json();

      if (!response.ok) {
        setError(json.message || "重新拉起支付失败");
        return;
      }

      if (json.payment?.status === "FAILED") {
        setError(json.payment.failureReason || "支付失败，请稍后重试");
      }

      router.refresh();
    });
  }

  function submitEmbeddedPaymentForm() {
    const form = paymentFormRef.current?.querySelector("form");

    if (!form) {
      setError("当前支付表单不可用，请重新支付。");
      return;
    }

    form.setAttribute("target", "_blank");
    form.submit();
  }

  if (refundPending) {
    return (
      <div className="panel side-panel">
        <h2>退款处理中</h2>
        <p className="muted">退款申请已经提交，系统会等待支付通道确认原路退回结果。</p>
        <button className="secondary-button" onClick={() => router.refresh()} type="button">
          <RefreshCw size={17} />
          刷新订单状态
        </button>
      </div>
    );
  }

  if (refunded) {
    return (
      <div className="panel side-panel">
        <h2>订单已退款</h2>
        <p className="muted">该订单已经完成原路退款，后续如有问题请联系在线客服。</p>
      </div>
    );
  }

  if (paid) {
    return (
      <div className="panel side-panel">
        <h2>支付完成</h2>
        <p className="muted">订单已支付成功，客服会按订单信息进入处理队列。</p>
      </div>
    );
  }

  return (
    <div className="panel side-panel">
      <h2>支付处理</h2>
      <div className="summary-line">
        <span>支付状态</span>
        <strong>{paymentStatusLabel(payment?.status || "CREATED")}</strong>
      </div>
      <div className="summary-line">
        <span>支付尝试</span>
        <strong>{payment ? `第 ${payment.attemptNo} 次` : "暂无"}</strong>
      </div>
      <div className="summary-line">
        <span>支付系统单号</span>
        <strong>{payment?.providerOrderId || "-"}</strong>
      </div>

      <div className="field" style={{ marginTop: 12 }}>
        <label>选择支付方式</label>
        <div className="checkout-method-grid compact">
          {visiblePayMethods.map((method) => (
            <button
              className={`checkout-method ${activePayMethod === method.id ? "active" : ""}`}
              key={method.id}
              onClick={() => setPayMethod(method.id)}
              type="button"
            >
              <span className="checkout-method-copy">
                <strong>{method.label}</strong>
                <small>{method.helper}</small>
              </span>
            </button>
          ))}
        </div>
        {isWeChatBrowser ? (
          <span className="field-hint">
            微信内浏览器一期不支持直接拉起 H5 支付，请使用系统浏览器打开，或在电脑端扫码完成支付。
          </span>
        ) : null}
      </div>

      {paymentFailed ? (
        <div className="form-stack">
          <div className="payment-failure-card">
            <strong>支付失败</strong>
            <p>{payment?.failureReason || "支付通道暂时不可用，请稍后重试。"}</p>
            <div className="payment-meta-list">
              <div>
                <span>订单编号</span>
                <strong>{orderNo}</strong>
              </div>
              <div>
                <span>支付尝试</span>
                <strong>{payment ? `第 ${payment.attemptNo} 次` : "-"}</strong>
              </div>
              <div>
                <span>失败时间</span>
                <strong>{payment ? displayDate(payment.createdAt) : "-"}</strong>
              </div>
            </div>
          </div>
          {error ? <p className="error-text">{error}</p> : null}
          <div className="button-row">
            <button className="secondary-button" disabled={isPending} onClick={queryPayment} type="button">
              <RefreshCw size={17} />
              刷新状态
            </button>
            <button className="primary-button" disabled={isPending} onClick={retryPayment} type="button">
              <RefreshCw size={17} />
              重新支付
            </button>
          </div>
        </div>
      ) : null}

      {!paymentFailed && (payment?.provider === "OFFICIAL" || payment?.provider === "JEEPAY") ? (
        <div className="form-stack">
          <div className="payment-checkout-card">
            <div className="payment-checkout-head">
              <strong>{amountYuan()}</strong>
              <span>元</span>
            </div>
            <div className="payment-checkout-body">
              {payment.payDataType === "codeImgUrl" && payment.payData ? (
                <div className="payment-qr-frame">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="支付二维码" src={payment.payData} />
                </div>
              ) : null}
              {payment.payDataType === "codeUrl" && qrDataUrl ? (
                <div className="payment-qr-frame">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="微信支付二维码" src={qrDataUrl} />
                </div>
              ) : null}
              {(payment.payDataType === "codeImgUrl" || payment.payDataType === "codeUrl") && payment.payData ? (
                <div className="payment-scan-hint">
                  <ScanLine size={34} />
                  <span>
                    手机打开微信
                    <br />
                    扫一扫完成支付
                  </span>
                </div>
              ) : null}
              {(payment.payDataType === "payUrl" || (payment.payDataType === "codeUrl" && !qrDataUrl)) && payment.payData ? (
                <a className="primary-button payment-wide-action" href={payment.payData} rel="noreferrer" target="_blank">
                  <ExternalLink size={17} />
                  打开支付链接
                </a>
              ) : null}
              {payment.payDataType === "form" && payment.payData ? (
                <>
                  <div ref={paymentFormRef} className="payment-form" dangerouslySetInnerHTML={{ __html: payment.payData }} />
                  <button className="primary-button payment-wide-action" onClick={submitEmbeddedPaymentForm} type="button">
                    <ExternalLink size={17} />
                    前往支付宝支付
                  </button>
                </>
              ) : null}
              <div className="payment-meta-list">
                <div>
                  <span>商品名称</span>
                  <strong>{order.packageName}</strong>
                </div>
                <div>
                  <span>订单编号</span>
                  <strong>{orderNo}</strong>
                </div>
                <div>
                  <span>订单时间</span>
                  <strong>{displayDate(order.createdAt)}</strong>
                </div>
              </div>
            </div>
          </div>
          {!payment.payData ? (
            <p className="muted">当前支付尝试没有可用的二维码或跳转地址，请刷新状态或重新拉起支付。</p>
          ) : null}
          {error ? <p className="error-text">{error}</p> : null}
          <div className="button-row">
            <button className="secondary-button" disabled={isPending} onClick={queryPayment} type="button">
              <RefreshCw size={17} />
              刷新状态
            </button>
            <button className="primary-button" disabled={isPending} onClick={retryPayment} type="button">
              <RefreshCw size={17} />
              重新支付
            </button>
          </div>
        </div>
      ) : null}

      {!payment ? (
        <div className="form-stack">
          {error ? <p className="error-text">{error}</p> : null}
          <button className="primary-button" disabled={isPending} onClick={retryPayment} type="button">
            <RefreshCw size={17} />
            确认支付
          </button>
        </div>
      ) : null}
      {payment && payment.provider !== "OFFICIAL" && payment.provider !== "JEEPAY" ? (
        <div className="form-stack">
          <p className="muted">当前订单存在旧支付记录，请重新拉起官方支付。</p>
          {error ? <p className="error-text">{error}</p> : null}
          <button className="primary-button" disabled={isPending} onClick={retryPayment} type="button">
            <RefreshCw size={17} />
            确认支付
          </button>
        </div>
      ) : null}
    </div>
  );
}
