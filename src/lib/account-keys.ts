import { createHash, createHmac } from "crypto";

function apiSecretSeed() {
  return `${process.env.AUTH_SECRET || "dev-secret-change-me-dev-secret-change-me"}:user-api`;
}

export function userAppId(user: { id: string; userNo: number }) {
  const suffix = createHash("sha256").update(user.id).digest("hex").slice(0, 8);
  return `bw_${user.userNo}_${suffix}`;
}

export function userAppSecret(user: { apiSecretSalt?: string | null; id: string; phone: string }) {
  return createHmac("sha256", apiSecretSeed())
    .update(`${user.id}:${user.phone}:${user.apiSecretSalt || "v1"}`, "utf8")
    .digest("base64url")
    .slice(0, 42);
}
