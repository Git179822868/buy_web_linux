import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const packages = [
  {
    slug: "bd-follow-1k-normal",
    name: "【BD】不直播涨粉丝 1千起",
    description: "适合基础账号关注投放，普通粉丝，稳定交付。",
    category: "account_follow",
    categoryLabel: "账号关注",
    filterKey: "normal",
    filterLabel: "不直播账号关注（普通粉丝）",
    platformCode: "BD",
    unit: "个",
    productType: "NORMAL",
    priceTemplate: "默认模板",
    baseQuantity: 1000,
    minQuantity: 1000,
    maxQuantity: 1000000,
    allowRepeat: true,
    deliveryTime: "24-72小时",
    completionRate: 96,
    priceCent: 8,
    sortOrder: 10,
  },
  {
    slug: "qq-follow-10k-effective",
    name: "【QQ】不直播涨粉丝 1万起",
    description: "包有效账号关注，适合投放后稳定留存。",
    category: "account_follow",
    categoryLabel: "账号关注",
    filterKey: "effective",
    filterLabel: "不直播账号关注（包有效）",
    platformCode: "QQ",
    unit: "个",
    productType: "NORMAL",
    priceTemplate: "默认模板",
    baseQuantity: 10000,
    minQuantity: 10000,
    maxQuantity: 1000000,
    allowRepeat: true,
    deliveryTime: "24-96小时",
    completionRate: 94,
    priceCent: 8,
    sortOrder: 20,
  },
  {
    slug: "ad-follow-1k-proxy",
    name: "【AD】抖加代投（涨有效粉）",
    description: "适合需要投放托管的账号关注套餐。",
    category: "account_follow",
    categoryLabel: "账号关注",
    filterKey: "proxy",
    filterLabel: "抖加代投（涨有效粉）",
    platformCode: "AD",
    unit: "个",
    productType: "NORMAL",
    priceTemplate: "抖加代投",
    baseQuantity: 500,
    minQuantity: 500,
    maxQuantity: 10000,
    allowRepeat: false,
    deliveryTime: "12-48小时",
    completionRate: 92,
    priceCent: 10,
    sortOrder: 30,
  },
  {
    slug: "jq-follow-live-effective",
    name: "【JQ】开播涨关注（包有效）",
    description: "适合直播期间账号关注增长。",
    category: "account_follow",
    categoryLabel: "账号关注",
    filterKey: "live",
    filterLabel: "开播涨关注（包有效）",
    platformCode: "JQ",
    unit: "个",
    productType: "NORMAL",
    priceTemplate: "开播关注",
    baseQuantity: 1000,
    minQuantity: 1000,
    maxQuantity: 500000,
    allowRepeat: true,
    deliveryTime: "6-24小时",
    completionRate: 93,
    priceCent: 11,
    sortOrder: 40,
  },
  {
    slug: "zy-follow-natural-1k",
    name: "【ZY】自热涨关注 包1千有效",
    description: "自热投放关注，适合自然增长需求。",
    category: "account_follow",
    categoryLabel: "账号关注",
    filterKey: "natural",
    filterLabel: "自热涨关注（包有效）",
    platformCode: "ZY",
    unit: "个",
    productType: "NORMAL",
    priceTemplate: "自热涨粉",
    baseQuantity: 1000,
    minQuantity: 1000,
    maxQuantity: 200000,
    allowRepeat: true,
    deliveryTime: "24-72小时",
    completionRate: 95,
    priceCent: 16,
    sortOrder: 50,
  },
  {
    slug: "like-basic",
    name: "【基础】账号内容点赞套餐",
    description: "适合笔记、视频和图文内容基础互动。",
    category: "likes",
    categoryLabel: "投放点赞",
    filterKey: "normal",
    filterLabel: "基础点赞",
    platformCode: "DZ",
    unit: "个",
    productType: "NORMAL",
    priceTemplate: "互动模板",
    baseQuantity: 1000,
    minQuantity: 1000,
    maxQuantity: 500000,
    allowRepeat: true,
    deliveryTime: "12-48小时",
    completionRate: 96,
    priceCent: 6,
    sortOrder: 60,
  },
  {
    slug: "play-basic",
    name: "【播放】短视频播放量套餐",
    description: "适合视频冷启动播放数据补充。",
    category: "plays",
    categoryLabel: "投放播放",
    filterKey: "normal",
    filterLabel: "基础播放",
    platformCode: "BF",
    unit: "次",
    productType: "NORMAL",
    priceTemplate: "播放模板",
    baseQuantity: 10000,
    minQuantity: 10000,
    maxQuantity: 999999,
    allowRepeat: true,
    deliveryTime: "6-36小时",
    completionRate: 97,
    priceCent: 5,
    sortOrder: 70,
  },
];

async function main() {
  for (const item of packages) {
    await prisma.servicePackage.upsert({
      where: { slug: item.slug },
      update: item,
      create: {
        ...item,
        imageUrl: "/assets/package-thumb.png",
        currency: "cny",
        isActive: true,
      },
    });
  }

  const username = process.env.ADMIN_SEED_USERNAME || "admin";
  const password = process.env.ADMIN_SEED_PASSWORD || "Admin@123456";
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.adminUser.upsert({
    where: { username },
    update: {
      passwordHash,
      role: "ADMIN",
      name: "wangxue",
      phone: username,
      isActive: true,
    },
    create: {
      username,
      passwordHash,
      role: "ADMIN",
      name: "wangxue",
      phone: username,
      isActive: true,
    },
  });

  await prisma.siteSetting.upsert({
    where: { id: 1 },
    update: {
      siteName: "wangxue",
      operator: "账号关注投放商城",
      keywords: "账号关注,点赞,播放,新媒体投放",
      description: "账号关注、点赞、播放和推广套餐购买平台",
    },
    create: {
      id: 1,
      siteName: "wangxue",
      operator: "账号关注投放商城",
      keywords: "账号关注,点赞,播放,新媒体投放",
      description: "账号关注、点赞、播放和推广套餐购买平台",
    },
  });

  const contacts = [
    { type: "qq", label: "QQ", value: "", isEnabled: false, sortOrder: 10 },
    { type: "wechat", label: "微信号", value: "", isEnabled: false, sortOrder: 20 },
    { type: "support", label: "联系方式", value: "", isEnabled: false, sortOrder: 30 },
  ];

  for (const contact of contacts) {
    const existing = await prisma.contactSetting.findFirst({
      where: { type: contact.type },
    });

    if (existing) {
      await prisma.contactSetting.update({
        where: { id: existing.id },
        data: contact,
      });
    } else {
      await prisma.contactSetting.create({ data: contact });
    }
  }

  console.log(`Seeded ${packages.length} packages and admin user "${username}".`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
