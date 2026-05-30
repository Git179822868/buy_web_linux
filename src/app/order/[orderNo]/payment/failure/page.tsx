import { PaymentResultCard } from "@/components/payment-result-card";
import { loadPaymentResult } from "@/lib/payment-result-page";

export const dynamic = "force-dynamic";

export default async function PaymentFailurePage({
  params,
}: {
  params: Promise<{ orderNo: string }>;
}) {
  const { orderNo } = await params;
  const result = await loadPaymentResult(orderNo, "failure");

  if (result.paid) {
    return (
      <PaymentResultCard
        amountText={result.amountText}
        message="支付平台已经确认到账，订单会进入处理队列。"
        primaryHref="/account/orders"
        primaryLabel="返回用户中心"
        rows={[
          { label: "支付账单", value: result.payment?.providerOrderId || result.payment?.mchOrderNo || result.order.orderNo },
          { label: "支付时间", value: result.order.paidAt ? new Date(result.order.paidAt).toLocaleString("zh-CN", { hour12: false }) : "-" },
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

  return (
    <PaymentResultCard
      amountText={result.amountText}
      message={result.pending ? "当前还没有收到支付成功确认，请回到订单页刷新或重新拉起支付。" : "支付失败或订单已关闭，请回到订单页重新拉起支付。"}
      primaryHref={`/order/${result.order.orderNo}`}
      primaryLabel="返回订单重新支付"
      rows={[
        { label: "支付账单", value: result.payment?.providerOrderId || result.payment?.mchOrderNo || result.order.orderNo },
        { label: "支付状态", value: result.payment?.status || result.order.status },
        { label: "失败原因", value: result.failureReason || (result.pending ? "支付结果暂未确认" : "支付通道暂时不可用，请稍后重试。") },
        { label: "订单编号", value: result.order.orderNo },
      ]}
      secondaryHref={`/order/${result.order.orderNo}/payment/success`}
      secondaryLabel="刷新付款结果"
      siteName={result.siteName}
      title={result.pending ? "支付待确认" : "支付未完成"}
      tone={result.pending ? "pending" : "failure"}
    />
  );
}
