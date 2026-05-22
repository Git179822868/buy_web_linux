import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const baseUrl = (process.env.ADMIN_TEST_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const baseOrigin = new URL(baseUrl).origin;
const username = process.env.ADMIN_TEST_USERNAME || process.env.ADMIN_SEED_USERNAME || "admin";
const password = process.env.ADMIN_TEST_PASSWORD || process.env.ADMIN_SEED_PASSWORD || "Admin@123456";
const stamp = `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;

const created = {
  orderIds: [],
  packageIds: [],
  paymentIds: [],
  refundIds: [],
  userIds: [],
};

let cookieHeader = "";
let passed = 0;

function log(message) {
  console.log(`[admin-smoke] ${message}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function splitSetCookie(value) {
  if (!value) {
    return [];
  }

  return value.split(/,(?=\s*[^;,]+=)/g).map((item) => item.trim()).filter(Boolean);
}

function captureCookies(response) {
  const headers = response.headers;
  const rawCookies = typeof headers.getSetCookie === "function"
    ? headers.getSetCookie()
    : splitSetCookie(headers.get("set-cookie"));
  const cookies = rawCookies
    .map((item) => item.split(";")[0])
    .filter(Boolean);

  if (cookies.length) {
    cookieHeader = cookies.join("; ");
  }
}

async function readJson(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const method = (options.method || "GET").toUpperCase();

  if (cookieHeader) {
    headers.set("cookie", cookieHeader);
  }

  if (!headers.has("origin") && method !== "GET" && method !== "HEAD") {
    headers.set("origin", baseOrigin);
  }

  if (options.json !== undefined) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    body: options.json === undefined ? options.body : JSON.stringify(options.json),
    headers,
    method,
  });

  captureCookies(response);

  return response;
}

async function expectStatus(name, promise, expectedStatus) {
  const response = await promise;
  const body = await readJson(response);

  assert(response.status === expectedStatus, `${name} expected ${expectedStatus}, got ${response.status}: ${JSON.stringify(body)}`);
  passed += 1;
  log(`PASS ${name}`);

  return { body, response };
}

async function expectOk(name, promise) {
  const response = await promise;
  const body = await readJson(response);

  assert(response.ok, `${name} expected 2xx, got ${response.status}: ${JSON.stringify(body)}`);
  passed += 1;
  log(`PASS ${name}`);

  return { body, response };
}

async function expectPage(name, path, requiredText) {
  const response = await request(path);
  const text = await response.text();

  assert(response.status === 200, `${name} expected 200, got ${response.status}`);
  assert(text.includes(requiredText), `${name} did not include "${requiredText}"`);
  assert(!/Runtime Error|PrismaClientKnownRequestError|Unhandled Runtime Error/.test(text), `${name} rendered a framework error overlay`);
  passed += 1;
  log(`PASS ${name}`);
}

async function expectCrossOriginBlocked(name, path, method, json) {
  await expectStatus(
    name,
    request(path, {
      headers: { origin: "https://evil.example" },
      json,
      method,
    }),
    403,
  );
}

function uniquePhone() {
  return `139${String(Date.now()).slice(-8)}`;
}

async function createTestUser(label) {
  const user = await prisma.user.create({
    data: {
      nickname: `autotest-${label}`,
      passwordHash: "autotest-not-for-login",
      phone: uniquePhone(),
    },
  });

  created.userIds.push(user.id);
  return user;
}

async function createTestPackage(label) {
  const item = await prisma.servicePackage.create({
    data: {
      baseQuantity: 1000,
      category: "account_follow",
      categoryLabel: "账号关注",
      completionRate: 95,
      currency: "cny",
      deliveryTime: "1小时",
      description: `autotest ${label}`,
      filterKey: "normal",
      filterLabel: "自动化测试",
      imageUrl: "/assets/package-thumb.png",
      isActive: true,
      maxQuantity: 100000,
      minQuantity: 1000,
      name: `autotest-${label}`,
      platformCode: "AT",
      priceCent: 10,
      productType: "NORMAL",
      slug: `autotest-${label}-${stamp}`.slice(0, 80),
      sortOrder: 9999,
      unit: "个",
    },
  });

  created.packageIds.push(item.id);
  return item;
}

async function createPaidOrder(label, input = {}) {
  const user = input.user || await createTestUser(label);
  const servicePackage = input.package || await createTestPackage(label);
  const orderNo = `BWTEST${stamp}${label}`.slice(0, 64);
  const order = await prisma.order.create({
    data: {
      amountCent: input.amountCent ?? 1000,
      cooperationCode: `AUTO-${label}`,
      currency: "cny",
      currentQuantity: input.initialQuantity ?? 1000,
      initialQuantity: input.initialQuantity ?? 1000,
      orderNo,
      orderQuantity: input.orderQuantity ?? 1000,
      packageId: servicePackage.id,
      paidAt: new Date(),
      remark: `autotest ${label}`,
      status: "PAID",
      targetAccount: `autotest-${label}`,
      userId: user.id,
    },
  });
  const payment = await prisma.paymentRecord.create({
    data: {
      amountCent: order.amountCent,
      currency: "cny",
      mchOrderNo: `${orderNo}-PAY`,
      orderId: order.id,
      paidAt: new Date(),
      provider: "MOCK",
      status: "PAID",
      wayCode: "wechat_native",
    },
  });

  created.orderIds.push(order.id);
  created.paymentIds.push(payment.id);

  return { order, payment, servicePackage, user };
}

async function cleanup() {
  const filters = {
    orderIds: [...new Set(created.orderIds)],
    packageIds: [...new Set(created.packageIds)],
    paymentIds: [...new Set(created.paymentIds)],
    refundIds: [...new Set(created.refundIds)],
    userIds: [...new Set(created.userIds)],
  };

  const refundWhere = [
    filters.refundIds.length ? { id: { in: filters.refundIds } } : undefined,
    filters.orderIds.length ? { orderId: { in: filters.orderIds } } : undefined,
  ].filter(Boolean);
  const paymentWhere = [
    filters.paymentIds.length ? { id: { in: filters.paymentIds } } : undefined,
    filters.orderIds.length ? { orderId: { in: filters.orderIds } } : undefined,
  ].filter(Boolean);

  if (refundWhere.length) {
    await prisma.refundRecord.deleteMany({ where: { OR: refundWhere } });
  }

  if (paymentWhere.length) {
    await prisma.paymentRecord.deleteMany({ where: { OR: paymentWhere } });
  }

  if (filters.orderIds.length) {
    await prisma.order.deleteMany({ where: { id: { in: filters.orderIds } } });
  }

  if (filters.packageIds.length) {
    await prisma.servicePackage.deleteMany({ where: { id: { in: filters.packageIds } } });
  }

  if (filters.userIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: filters.userIds } } });
  }
}

async function main() {
  log(`baseUrl=${baseUrl}`);

  await expectStatus("unauthenticated packages API is rejected", request("/api/admin/packages"), 401);

  await expectOk(
    "admin login",
    request("/api/admin/auth/login", {
      json: { password, username },
      method: "POST",
    }),
  );
  assert(cookieHeader.includes("buyweb_admin_session="), "admin login did not set session cookie");

  await expectPage("admin dashboard renders", "/admin", "控制台");
  await expectPage("admin profile renders", "/admin/profile", "账号信息");
  await expectPage("admin orders renders", "/admin/orders", "订单管理");
  await expectPage("admin packages renders", "/admin/packages", "商品管理");
  await expectPage("admin users renders", "/admin/users", "用户管理");
  await expectPage("admin finance renders", "/admin/finance", "财务明细");

  const { body: packagesBody } = await expectOk("packages GET", request("/api/admin/packages"));
  assert(Array.isArray(packagesBody.packages), "packages GET did not return an array");

  await expectCrossOriginBlocked("cross-origin package create is blocked", "/api/admin/packages", "POST", {});

  const packagePayload = {
    baseQuantity: 1000,
    category: "xhs",
    categoryLabel: "小红书推广",
    completionRate: 95,
    deliveryTime: "1小时",
    description: "自动化测试商品",
    filterKey: "normal",
    filterLabel: "测试筛选",
    imageUrl: "/assets/package-thumb.png",
    isActive: true,
    maxQuantity: 2000,
    minQuantity: 1000,
    name: `自动化测试商品-${stamp}`,
    platformCode: "AT",
    priceCent: 10,
    productType: "NORMAL",
    sortOrder: 9999,
    unit: "个",
  };
  const { body: createdPackageBody } = await expectOk(
    "package create",
    request("/api/admin/packages", {
      json: packagePayload,
      method: "POST",
    }),
  );
  const apiPackage = createdPackageBody.package;
  assert(apiPackage?.id, "package create did not return an id");
  created.packageIds.push(apiPackage.id);

  const { body: patchedPackageBody } = await expectOk(
    "package patch",
    request(`/api/admin/packages/${apiPackage.id}`, {
      json: { isActive: false },
      method: "PATCH",
    }),
  );
  assert(patchedPackageBody.package?.isActive === false, "package patch did not update isActive");

  await expectOk("package delete", request(`/api/admin/packages/${apiPackage.id}`, { method: "DELETE" }));
  created.packageIds = created.packageIds.filter((id) => id !== apiPackage.id);

  const testUser = await createTestUser("status");
  await expectCrossOriginBlocked("cross-origin user status is blocked", `/api/admin/users/${testUser.id}/status`, "PATCH", { status: "DISABLED" });
  const { body: disabledUserBody } = await expectOk(
    "user disable",
    request(`/api/admin/users/${testUser.id}/status`, {
      json: { status: "DISABLED" },
      method: "PATCH",
    }),
  );
  assert(disabledUserBody.user?.status === "DISABLED", "user disable did not persist DISABLED");
  await expectOk(
    "user enable",
    request(`/api/admin/users/${testUser.id}/status`, {
      json: { status: "ACTIVE" },
      method: "PATCH",
    }),
  );

  const processingCase = await createPaidOrder("processing", { user: testUser });
  await expectCrossOriginBlocked("cross-origin order status is blocked", `/api/admin/orders/${processingCase.order.id}/status`, "PATCH", { action: "PROCESSING" });
  const { body: processingBody } = await expectOk(
    "order start processing",
    request(`/api/admin/orders/${processingCase.order.id}/status`, {
      json: { action: "PROCESSING" },
      method: "PATCH",
    }),
  );
  assert(processingBody.order?.executedAt, "order start processing did not set executedAt");

  const { body: progressBody } = await expectOk(
    "order progress update",
    request(`/api/admin/orders/${processingCase.order.id}/status`, {
      json: { action: "PROGRESS", completedQuantity: 400 },
      method: "PATCH",
    }),
  );
  assert(progressBody.order?.completedQuantity === 400, "order progress did not persist completedQuantity");
  assert(progressBody.order?.currentQuantity === 1400, "order progress did not update currentQuantity");
  assert(progressBody.order?.status === "PAID", "order progress should not complete the order");

  await expectStatus(
    "order complete requires completed quantity",
    request(`/api/admin/orders/${processingCase.order.id}/status`, {
      json: { action: "COMPLETE" },
      method: "PATCH",
    }),
    400,
  );

  const { body: completeBody } = await expectOk(
    "order partial complete",
    request(`/api/admin/orders/${processingCase.order.id}/status`, {
      json: { action: "COMPLETE", completedQuantity: 750 },
      method: "PATCH",
    }),
  );
  assert(completeBody.order?.status === "FULFILLED", "order complete did not mark fulfilled");
  assert(completeBody.order?.completedQuantity === 750, "order complete did not keep submitted completedQuantity");
  assert(completeBody.order?.currentQuantity === 1750, "order complete did not advance currentQuantity to initial + submitted quantity");

  const { body: returnedBody } = await expectOk(
    "order return to processing",
    request(`/api/admin/orders/${processingCase.order.id}/status`, {
      json: { action: "RETURN_PROCESSING" },
      method: "PATCH",
    }),
  );
  assert(returnedBody.order?.status === "PAID", "order return to processing did not restore paid status");

  const { body: fullProgressBody } = await expectOk(
    "order full progress does not auto complete",
    request(`/api/admin/orders/${processingCase.order.id}/status`, {
      json: { action: "PROGRESS", completedQuantity: 1000 },
      method: "PATCH",
    }),
  );
  assert(fullProgressBody.order?.completedQuantity === 1000, "full progress did not persist completedQuantity");
  assert(fullProgressBody.order?.status === "PAID", "full progress should wait for explicit complete action");

  const { body: finalCompleteBody } = await expectOk(
    "order final complete",
    request(`/api/admin/orders/${processingCase.order.id}/status`, {
      json: { action: "COMPLETE", completedQuantity: 1000 },
      method: "PATCH",
    }),
  );
  assert(finalCompleteBody.order?.status === "FULFILLED", "final complete did not mark fulfilled");
  assert(finalCompleteBody.order?.currentQuantity === 2000, "final complete did not advance currentQuantity to initial + orderQuantity");

  const refundCase = await createPaidOrder("refund", { amountCent: 5000, user: testUser });
  await expectCrossOriginBlocked("cross-origin refund create is blocked", `/api/admin/orders/${refundCase.order.id}/refunds`, "POST", { amountCent: 1000, reason: "跨站测试" });
  await expectOk(
    "refund case start processing",
    request(`/api/admin/orders/${refundCase.order.id}/status`, {
      json: { action: "PROCESSING" },
      method: "PATCH",
    }),
  );
  await expectOk(
    "refund case partial complete",
    request(`/api/admin/orders/${refundCase.order.id}/status`, {
      json: { action: "COMPLETE", completedQuantity: 500 },
      method: "PATCH",
    }),
  );
  const { body: refundBody } = await expectOk(
    "partial completed order refund create",
    request(`/api/admin/orders/${refundCase.order.id}/refunds`, {
      json: { amountCent: 1000, reason: "自动化测试退款" },
      method: "POST",
    }),
  );
  assert(refundBody.refund?.amountCent === 1000, "refund create did not keep selected amount");
  created.refundIds.push(refundBody.refund.id);

  const adminBeforeProfilePatch = await prisma.adminUser.findUnique({ where: { username } });

  await expectCrossOriginBlocked("cross-origin profile patch is blocked", "/api/admin/profile", "PATCH", { name: "blocked" });
  await expectOk(
    "profile patch",
    request("/api/admin/profile", {
      json: {
        avatarUrl: adminBeforeProfilePatch?.avatarUrl || "",
        bio: adminBeforeProfilePatch?.bio || "",
        name: adminBeforeProfilePatch?.name || "",
        phone: adminBeforeProfilePatch?.phone || "",
      },
      method: "PATCH",
    }),
  );

  const setting = await prisma.siteSetting.findUnique({ where: { id: 1 } });
  const contacts = await prisma.contactSetting.findMany({ orderBy: { sortOrder: "asc" } });
  await expectCrossOriginBlocked("cross-origin settings patch is blocked", "/api/admin/settings", "PATCH", {});
  await expectOk(
    "settings patch keeps existing contacts",
    request("/api/admin/settings", {
      json: {
        copyright: setting?.copyright || "",
        contacts: contacts.map((contact) => ({
          id: contact.id,
          isEnabled: contact.isEnabled,
          label: contact.label,
          qrUrl: contact.qrUrl || "",
          sortOrder: contact.sortOrder,
          type: contact.type,
          value: contact.value || "",
        })),
        description: setting?.description || "",
        icpNo: setting?.icpNo || "",
        icoUrl: setting?.icoUrl || "",
        keywords: setting?.keywords || "",
        logoUrl: setting?.logoUrl || "",
        operator: setting?.operator || "",
        siteName: setting?.siteName || "账号关注投放商城",
      },
      method: "PATCH",
    }),
  );

  await expectCrossOriginBlocked("cross-origin contact upload is blocked", "/api/admin/contact-qr", "POST", {});
  await expectStatus(
    "contact upload rejects missing file",
    request("/api/admin/contact-qr", {
      body: new FormData(),
      method: "POST",
    }),
    400,
  );

  await expectCrossOriginBlocked("cross-origin password patch is blocked", "/api/admin/password", "PATCH", {});
  await expectStatus(
    "password patch rejects wrong current password",
    request("/api/admin/password", {
      json: {
        confirmPassword: "Autotest12345!",
        currentPassword: "wrong-password",
        newPassword: "Autotest12345!",
      },
      method: "PATCH",
    }),
    400,
  );

  await expectCrossOriginBlocked("cross-origin logout is blocked", "/api/admin/auth/logout", "POST", {});
  await expectOk("admin logout", request("/api/admin/auth/logout", { method: "POST" }));

  log(`completed ${passed} assertions`);
}

try {
  await main();
} finally {
  await cleanup().catch((error) => {
    console.error("[admin-smoke] cleanup failed", error);
    process.exitCode = 1;
  });
  await prisma.$disconnect();
}
