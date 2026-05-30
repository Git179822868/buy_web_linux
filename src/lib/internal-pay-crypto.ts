import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "crypto";

const ENVELOPE_VERSION = 1;
const ENVELOPE_ALGORITHM = "AES-256-GCM";
const ENVELOPE_KEY_ID = "primary";
const ENVELOPE_AAD = "buy_web:official-pay:v1";

type InternalPayEnvelope = {
  alg: typeof ENVELOPE_ALGORITHM;
  ciphertext: string;
  kid: typeof ENVELOPE_KEY_ID;
  nonce: string;
  tag: string;
  v: typeof ENVELOPE_VERSION;
};

function base64UrlEncode(value: Buffer) {
  return value.toString("base64url");
}

function base64UrlDecode(value: string, field: string) {
  try {
    return Buffer.from(value, "base64url");
  } catch {
    throw new Error(`Invalid encrypted payload ${field}`);
  }
}

function decodeFlexibleBase64(value: string) {
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(value)) {
    return null;
  }

  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");

  try {
    return Buffer.from(padded, "base64");
  } catch {
    return null;
  }
}

export function parseInternalEncryptionKey(secret: string) {
  const value = secret.trim();

  if (/^[a-f0-9]{64}$/i.test(value)) {
    return Buffer.from(value, "hex");
  }

  const decoded = decodeFlexibleBase64(value);

  if (decoded?.length === 32) {
    return decoded;
  }

  const raw = Buffer.from(value, "utf8");

  if (raw.length === 32) {
    return raw;
  }

  throw new Error("OFFICIAL_PAY_GATEWAY_ENCRYPTION_KEY must be exactly 32 bytes, base64/base64url encoded 32 bytes, or 64 hex characters");
}

export function encryptInternalPayPayload(payload: Record<string, unknown>, keySecret: string) {
  const key = parseInternalEncryptionKey(keySecret);
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);

  cipher.setAAD(Buffer.from(ENVELOPE_AAD, "utf8"));

  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const envelope: InternalPayEnvelope = {
    alg: ENVELOPE_ALGORITHM,
    ciphertext: base64UrlEncode(ciphertext),
    kid: ENVELOPE_KEY_ID,
    nonce: base64UrlEncode(nonce),
    tag: base64UrlEncode(cipher.getAuthTag()),
    v: ENVELOPE_VERSION,
  };

  return JSON.stringify(envelope);
}

export function decryptInternalPayPayload(body: string, keySecret: string) {
  let envelope: Partial<InternalPayEnvelope>;

  try {
    envelope = JSON.parse(body) as Partial<InternalPayEnvelope>;
  } catch {
    throw new Error("Invalid encrypted payload JSON");
  }

  if (
    envelope.v !== ENVELOPE_VERSION ||
    envelope.alg !== ENVELOPE_ALGORITHM ||
    envelope.kid !== ENVELOPE_KEY_ID ||
    typeof envelope.nonce !== "string" ||
    typeof envelope.ciphertext !== "string" ||
    typeof envelope.tag !== "string"
  ) {
    throw new Error("Invalid encrypted payload envelope");
  }

  const key = parseInternalEncryptionKey(keySecret);
  const decipher = createDecipheriv("aes-256-gcm", key, base64UrlDecode(envelope.nonce, "nonce"));

  decipher.setAAD(Buffer.from(ENVELOPE_AAD, "utf8"));
  decipher.setAuthTag(base64UrlDecode(envelope.tag, "tag"));

  const plaintext = Buffer.concat([
    decipher.update(base64UrlDecode(envelope.ciphertext, "ciphertext")),
    decipher.final(),
  ]).toString("utf8");

  const payload = JSON.parse(plaintext) as unknown;

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Encrypted payload must contain a JSON object");
  }

  return payload as Record<string, unknown>;
}

export function signInternalBody(secret: string, timestamp: string, body: string) {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${body}`, "utf8")
    .digest("hex");
}

export function timingSafeEqualHex(a: string, b: string) {
  if (!/^[a-f0-9]+$/i.test(a) || !/^[a-f0-9]+$/i.test(b)) {
    return false;
  }

  const aBuffer = Buffer.from(a, "hex");
  const bBuffer = Buffer.from(b, "hex");

  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
}
