import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { appPublicUrl } from "@/lib/env";
import { prisma } from "@/lib/prisma";

type SecurityScope = "ip" | "phone" | "username" | "user" | "order" | "system";

type RateLimitRule = {
  blockDurationMs?: number;
  eventType: string;
  identifier?: string | null;
  limit: number;
  reason?: string;
  scope: SecurityScope;
  windowMs: number;
};

type SecuritySubject = {
  id?: string;
  type?: string;
};

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function envFlag(name: string) {
  return ["1", "true", "yes", "on"].includes((process.env[name] || "").trim().toLowerCase());
}

function trustedProxyCount() {
  const parsed = Number.parseInt(process.env.TRUSTED_PROXY_COUNT || "1", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 1;
}

function normalizeIdentifier(value?: string | null) {
  const normalized = (value || "").trim().toLowerCase();
  return normalized || "unknown";
}

function requestPath(request: Request) {
  try {
    return new URL(request.url).pathname;
  } catch {
    return undefined;
  }
}

function requestOrigin(request: Request) {
  try {
    return new URL(request.url).origin;
  } catch {
    const host = request.headers.get("host");
    const proto = request.headers.get("x-forwarded-proto") || "http";
    return host ? `${proto}://${host}` : undefined;
  }
}

function addLocalhostAliases(origins: Set<string>, origin?: string) {
  if (!origin) {
    return;
  }

  try {
    const url = new URL(origin);
    const port = url.port ? `:${url.port}` : "";
    const protocol = url.protocol;
    const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

    if (!localHosts.has(url.hostname)) {
      return;
    }

    origins.add(`${protocol}//localhost${port}`);
    origins.add(`${protocol}//127.0.0.1${port}`);
    origins.add(`${protocol}//[::1]${port}`);
  } catch {
    // Ignore malformed local development origins.
  }
}

function allowedOrigins(request: Request) {
  const origins = new Set<string>();
  const current = requestOrigin(request);

  if (current) {
    origins.add(current);
    addLocalhostAliases(origins, current);
  }

  try {
    const publicOrigin = new URL(appPublicUrl()).origin;
    origins.add(publicOrigin);
    addLocalhostAliases(origins, publicOrigin);
  } catch {
    // APP_PUBLIC_URL is validated elsewhere; ignore malformed development values here.
  }

  return origins;
}

export function getClientIp(request: Request) {
  const realIp = request.headers.get("x-real-ip")?.split(",")[0]?.trim();

  if (realIp) {
    return realIp;
  }

  const forwarded = request.headers.get("x-forwarded-for");

  if (forwarded) {
    const parts = forwarded
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    const index = parts.length - trustedProxyCount() - 1;
    return parts[Math.max(0, index)] || parts[0] || "unknown";
  }

  return "unknown";
}

export function securityMaintenanceResponse(name: string, message: string) {
  if (!envFlag(name)) {
    return null;
  }

  return NextResponse.json({ message }, { status: 503 });
}

export function securitySwitchEnabled(name: string) {
  return envFlag(name);
}

export function tooManyRequestsResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    { message: "请求过于频繁，请稍后再试" },
    {
      headers: {
        "retry-after": String(Math.max(1, Math.ceil(retryAfterSeconds))),
      },
      status: 429,
    },
  );
}

export function securityForbiddenResponse(message = "请求已被安全策略拦截") {
  return NextResponse.json({ message }, { status: 403 });
}

export async function logSecurityEvent(input: {
  detail?: Record<string, unknown>;
  eventType: string;
  identifier?: string | null;
  ip?: string | null;
  request?: Request;
  scope: SecurityScope;
  subject?: SecuritySubject;
}) {
  await prisma.securityEvent.create({
    data: {
      detailJson: input.detail ? (input.detail as Prisma.InputJsonObject) : undefined,
      eventType: input.eventType,
      identifier: normalizeIdentifier(input.identifier),
      ip: input.ip || (input.request ? getClientIp(input.request) : undefined),
      method: input.request?.method,
      path: input.request ? requestPath(input.request) : undefined,
      scope: input.scope,
      subjectId: input.subject?.id,
      subjectType: input.subject?.type,
    },
  });
}

async function activeSecurityBlock(scope: SecurityScope, identifier?: string | null) {
  return prisma.securityBlock.findFirst({
    where: {
      identifier: normalizeIdentifier(identifier),
      scope,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  });
}

export async function isSecurityBlocked(scope: SecurityScope, identifier?: string | null) {
  return Boolean(await activeSecurityBlock(scope, identifier));
}

export async function checkSecurityBlocks(items: Array<{ identifier?: string | null; scope: SecurityScope }>) {
  for (const item of items) {
    const block = await activeSecurityBlock(item.scope, item.identifier);

    if (block) {
      return securityForbiddenResponse(block.reason || "请求已被安全策略拦截");
    }
  }

  return null;
}

export async function assertSameOrigin(request: Request) {
  if (!WRITE_METHODS.has(request.method.toUpperCase())) {
    return null;
  }

  const origin = request.headers.get("origin");

  if (!origin) {
    return null;
  }

  if (allowedOrigins(request).has(origin)) {
    return null;
  }

  await logSecurityEvent({
    detail: { origin },
    eventType: "ORIGIN_REJECTED",
    identifier: getClientIp(request),
    request,
    scope: "ip",
  });

  return securityForbiddenResponse("请求来源不可信，请刷新页面后重试");
}

export async function checkRateLimit(rules: RateLimitRule[], request?: Request) {
  const now = Date.now();

  for (const rule of rules) {
    const identifier = normalizeIdentifier(rule.identifier);
    const block = await activeSecurityBlock(rule.scope, identifier);

    if (block) {
      return securityForbiddenResponse(block.reason || "请求已被安全策略拦截");
    }

    const count = await prisma.securityEvent.count({
      where: {
        createdAt: { gte: new Date(now - rule.windowMs) },
        eventType: rule.eventType,
        identifier,
        scope: rule.scope,
      },
    });

    if (count >= rule.limit) {
      const reason = rule.reason || "请求过于频繁";

      if (rule.blockDurationMs) {
        await prisma.securityBlock.upsert({
          create: {
            createdBy: "rate-limit",
            expiresAt: new Date(now + rule.blockDurationMs),
            identifier,
            reason,
            scope: rule.scope,
          },
          update: {
            expiresAt: new Date(now + rule.blockDurationMs),
            reason,
          },
          where: {
            scope_identifier: {
              identifier,
              scope: rule.scope,
            },
          },
        });
      }

      await logSecurityEvent({
        detail: {
          limitedEventType: rule.eventType,
          limit: rule.limit,
          windowMs: rule.windowMs,
        },
        eventType: "RATE_LIMIT_REJECTED",
        identifier,
        request,
        scope: rule.scope,
      });

      return tooManyRequestsResponse(rule.windowMs / 1000);
    }
  }

  return null;
}

export async function consumeRateLimit(rules: RateLimitRule[], request?: Request, subject?: SecuritySubject) {
  const limited = await checkRateLimit(rules, request);

  if (limited) {
    return limited;
  }

  const ip = request ? getClientIp(request) : undefined;

  for (const rule of rules) {
    await logSecurityEvent({
      eventType: rule.eventType,
      identifier: rule.identifier,
      ip,
      request,
      scope: rule.scope,
      subject,
    });
  }

  return null;
}

export function ipRateLimitRule(request: Request, input: Omit<RateLimitRule, "identifier" | "scope">): RateLimitRule {
  return {
    ...input,
    identifier: getClientIp(request),
    scope: "ip",
  };
}

export function subjectRateLimitRule(
  scope: Exclude<SecurityScope, "ip" | "system">,
  identifier: string | null | undefined,
  input: Omit<RateLimitRule, "identifier" | "scope">,
): RateLimitRule {
  return {
    ...input,
    identifier,
    scope,
  };
}
