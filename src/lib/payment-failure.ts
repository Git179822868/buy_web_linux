export function paymentFailureReason(rawResponseJson: unknown) {
  if (!rawResponseJson || typeof rawResponseJson !== "object" || Array.isArray(rawResponseJson)) {
    return null;
  }

  const payload = rawResponseJson as { code?: unknown; message?: unknown };
  const code = typeof payload.code === "string" ? payload.code : "";

  if (code === "CONFIG_MISSING") {
    return "真实支付配置不完整，请联系管理员。";
  }

  if (code === "TIMEOUT") {
    return "支付通道响应超时，请稍后重试。";
  }

  if (code === "UPSTREAM_UNAVAILABLE") {
    return "支付通道暂时不可用，请稍后重试。";
  }

  return typeof payload.message === "string" && payload.message.trim()
    ? payload.message
    : null;
}
