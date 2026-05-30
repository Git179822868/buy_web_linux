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

export type PaymentProviderMode = "official";

export function paymentProvider() {
  const provider = process.env.PAYMENT_PROVIDER?.toLowerCase();

  if (!provider || provider === "official") {
    return "official";
  }

  throw new Error("PAYMENT_PROVIDER must be official. Mock payment mode has been disabled.");
}
