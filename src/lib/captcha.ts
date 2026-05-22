import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "crypto";

const CAPTCHA_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CAPTCHA_TTL_MS = 5 * 60 * 1000;

type CaptchaPayload = {
  answerHash: string;
  expiresAt: number;
  nonce: string;
};

function captchaSecret() {
  return process.env.AUTH_SECRET || "dev-secret-change-me-dev-secret-change-me";
}

function base64url(input: string) {
  return Buffer.from(input, "utf8").toString("base64url");
}

function fromBase64url(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function signPayload(payload: string) {
  return createHmac("sha256", captchaSecret()).update(payload).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function normalizeAnswer(answer: string) {
  return answer.trim().toUpperCase().replace(/\s/g, "");
}

function hashAnswer(answer: string, nonce: string) {
  return createHash("sha256")
    .update(`${normalizeAnswer(answer)}:${nonce}:${captchaSecret()}`, "utf8")
    .digest("hex");
}

function randomCode() {
  let value = "";

  for (let index = 0; index < 5; index += 1) {
    value += CAPTCHA_ALPHABET[randomInt(0, CAPTCHA_ALPHABET.length)];
  }

  return value;
}

function captchaSvg(code: string) {
  const chars = code.split("");
  const noise = Array.from({ length: 8 }, (_, index) => {
    const x1 = randomInt(0, 120);
    const y1 = randomInt(6, 42);
    const x2 = randomInt(0, 120);
    const y2 = randomInt(6, 42);
    const color = index % 2 === 0 ? "#79a7ff" : "#22b8a0";

    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1.2" opacity="0.36"/>`;
  }).join("");
  const letters = chars
    .map((char, index) => {
      const x = 15 + index * 20;
      const y = randomInt(27, 36);
      const rotate = randomInt(-15, 16);

      return `<text x="${x}" y="${y}" transform="rotate(${rotate} ${x} ${y})">${char}</text>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="126" height="48" viewBox="0 0 126 48">
    <rect width="126" height="48" rx="8" fill="#f3f7ff"/>
    <path d="M0 34 C24 18 45 48 67 28 S105 12 126 25" fill="none" stroke="#d8e5ff" stroke-width="7" opacity="0.8"/>
    ${noise}
    <g font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="24" font-weight="800" fill="#28344d" letter-spacing="2">${letters}</g>
  </svg>`;
}

export function createCaptchaChallenge() {
  const code = randomCode();
  const nonce = randomBytes(16).toString("hex");
  const payload: CaptchaPayload = {
    answerHash: hashAnswer(code, nonce),
    expiresAt: Date.now() + CAPTCHA_TTL_MS,
    nonce,
  };
  const payloadText = JSON.stringify(payload);
  const encodedPayload = base64url(payloadText);
  const token = `${encodedPayload}.${signPayload(encodedPayload)}`;
  const image = Buffer.from(captchaSvg(code), "utf8").toString("base64");

  return {
    expiresAt: payload.expiresAt,
    imageData: `data:image/svg+xml;base64,${image}`,
    token,
  };
}

export function verifyCaptchaChallenge(token: string, answer: string) {
  const [payloadPart, signature] = token.split(".");

  if (!payloadPart || !signature || !answer.trim()) {
    return false;
  }

  if (!safeEqual(signPayload(payloadPart), signature)) {
    return false;
  }

  try {
    const payload = JSON.parse(fromBase64url(payloadPart)) as CaptchaPayload;

    if (!payload.expiresAt || payload.expiresAt < Date.now() || !payload.nonce || !payload.answerHash) {
      return false;
    }

    return safeEqual(hashAnswer(answer, payload.nonce), payload.answerHash);
  } catch {
    return false;
  }
}
