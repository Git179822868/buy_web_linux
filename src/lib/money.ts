export function formatMoney(amountCent: number, currency = "cny") {
  const normalized = currency.toUpperCase() === "CNY" ? "CNY" : currency.toUpperCase();

  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: normalized,
    currencyDisplay: "symbol",
  }).format(amountCent / 100);
}

export function maskPhone(phone: string) {
  if (phone.length < 7) {
    return phone;
  }

  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}
