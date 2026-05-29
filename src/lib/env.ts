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

export type PaymentProviderMode = "mock" | "official";

export function paymentProvider() {
  const provider = process.env.PAYMENT_PROVIDER?.toLowerCase();

  if (provider === "official") {
    return "official";
  }

  return "mock";
}
