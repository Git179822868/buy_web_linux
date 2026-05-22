export function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function appPublicUrl() {
  return (process.env.APP_PUBLIC_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function paymentProvider() {
  return process.env.PAYMENT_PROVIDER?.toLowerCase() === "jeepay"
    ? "jeepay"
    : "mock";
}
