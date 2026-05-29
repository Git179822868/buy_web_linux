import { PaymentResultCard } from "@/components/payment-result-card";
import { loadPaymentResult } from "@/lib/payment-result-page";

export const dynamic = "force-dynamic";

export default async function PaymentSuccessPage({
  params,
}: {
  params: Promise<{ orderNo: string }>;
}) {
  const { orderNo } = await params;
  const result = await loadPaymentResult(orderNo, "success");
  const paidAt = result.order.paidAt || result.payment?.paidAt;

  if (result.paid) {
    return (
      <PaymentResultCard
        amountText={result.amountText}
        message="我们会将订单资料发送至处理队列，客服会按订单信息继续执行。"
        primaryHref="/account/orders"
        primaryLabel="返回用户中心"
        rows={[
          { label: "支付账单", value: result.payment?.providerOrderId || result.payment?.mchOrderNo || result.order.orderNo },
          { label: "支付时间", value: paidAt ? new Date(paidAt).toLocaleString("zh-CN", { hour12: false }) : "-" },
          { label: "交易编号", value: result.payment?.providerOrderId || result.payment?.mchOrderNo || "-" },
          { label: "订单编号", value: result.order.orderNo },
        ]}
        secondaryHref={`/order/${result.order.orderNo}`}
        secondaryLabel="查看订单"
        siteName={result.siteName}
        title="您已成功支付"
        tone="success"
      />
    );
  }

  if (result.failed) {
    return (
      <PaymentResultCard
        amountText={result.amountText}
        message="支付通道返回失败或订单已经关闭，请回到订单页重新拉起支付。"
        primaryHref={`/order/${result.order.orderNo}`}
        primaryLabel="返回订单重新支付"
        rows={[
          { label: "支付账单", value: result.payment?.providerOrderId || result.payment?.mchOrderNo || result.order.orderNo },
          { label: "支付状态", value: result.payment?.status || result.order.status },
          { label: "订单编号", value: result.order.orderNo },
        ]}
        siteName={result.siteName}
        title="支付未完成"
        tone="failure"
      />
    );
  }

  return (
    <PaymentResultCard
      amountText={result.amountText}
      message="支付平台可能还在通知系统到账结果，请稍后刷新。如果已经付款但长时间未到账，请联系在线客服。"
      primaryHref={`/order/${result.order.orderNo}`}
      primaryLabel="查看订单状态"
      rows={[
        { label: "支付账单", value: result.payment?.providerOrderId || result.payment?.mchOrderNo || result.order.orderNo },
        { label: "支付状态", value: result.payment?.status || result.order.status },
        { label: "订单编号", value: result.order.orderNo },
      ]}
      secondaryHref={`/order/${result.order.orderNo}/payment/success`}
      secondaryLabel="刷新付款结果"
      siteName={result.siteName}
      title="正在确认支付"
      tone="pending"
    />
  );
}
