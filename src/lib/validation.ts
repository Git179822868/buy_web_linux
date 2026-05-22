import { z } from "zod";

const textInput = (schema: z.ZodString) =>
  z.preprocess((value) => (typeof value === "string" ? value : ""), schema);

export const phoneSchema = z
  .preprocess(
    (value) => (typeof value === "string" ? value : ""),
    z.string().trim().regex(/^1[3-9]\d{9}$/, "请输入有效的中国大陆手机号"),
  );

export const createOrderSchema = z.object({
  packageId: textInput(z.string().min(1, "请选择套餐")),
  douyinAccount: textInput(z.string().trim().min(2, "请输入账号").max(120, "账号最多 120 个字符")),
  cooperationCode: z.string().trim().max(80, "合作码最多 80 个字符").optional().or(z.literal("")),
  orderQuantity: z.coerce.number().int().positive().default(1),
  payMethod: z
    .enum(["wechat_native", "alipay_pc", "wechat_h5", "alipay_wap"])
    .default("wechat_native"),
  remark: z.string().trim().max(360, "备注最多 360 个字符").optional().or(z.literal("")),
});

export const createPaymentAttemptSchema = z.object({
  payMethod: z
    .enum(["wechat_native", "alipay_pc", "wechat_h5", "alipay_wap"])
    .optional(),
});

export const adminLoginSchema = z.object({
  username: textInput(z.string().trim().min(1, "请输入账号")),
  password: textInput(z.string().min(1, "请输入密码")),
});

export const userLoginSchema = z.object({
  phone: phoneSchema,
  password: textInput(z.string().min(6, "密码至少 6 位")),
  captchaToken: textInput(z.string().min(10, "请刷新验证码")),
  captchaAnswer: textInput(z.string().trim().min(4, "请输入验证码").max(8, "验证码错误")),
});

export const userRegisterSchema = userLoginSchema.extend({
  confirmPassword: textInput(z.string().min(6, "请再次输入密码")),
}).refine((input) => input.password === input.confirmPassword, {
  message: "两次密码不一致",
  path: ["confirmPassword"],
});

export const accountProfileSchema = z.object({
  avatarUrl: z.string().trim().max(255).optional().or(z.literal("")),
  nickname: textInput(z.string().trim().min(2, "昵称至少 2 个字").max(40, "昵称最多 40 个字")),
});

export const accountPasswordSchema = z.object({
  currentPassword: textInput(z.string().min(6, "请输入当前密码")),
  newPassword: textInput(z.string().min(8, "新密码至少 8 位")),
  confirmPassword: textInput(z.string().min(8, "请再次输入新密码")),
}).refine((input) => input.newPassword === input.confirmPassword, {
  message: "两次新密码不一致",
  path: ["confirmPassword"],
});

export const packageSchema = z.object({
  name: z.string().trim().min(2, "请输入至少 2 个字的商品名称").max(80, "商品名称最多 80 个字"),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, "系统编号只能包含小写字母、数字和横线")
    .min(2, "系统编号至少 2 个字符")
    .max(80, "系统编号最多 80 个字符")
    .optional()
    .or(z.literal("")),
  description: z.string().trim().max(512, "商品说明最多 512 个字").optional().or(z.literal("")),
  category: z.string().trim().min(2, "请输入分类编号").max(64, "分类编号最多 64 个字符").default("account_follow"),
  categoryLabel: z.string().trim().min(2, "请输入分类名称").max(64, "分类名称最多 64 个字符").default("账号关注"),
  filterKey: z.string().trim().min(2, "请输入筛选编号").max(64, "筛选编号最多 64 个字符").default("normal"),
  filterLabel: z.string().trim().min(2, "请输入筛选名称").max(64, "筛选名称最多 64 个字符").default("普通粉丝"),
  platformCode: z.string().trim().min(1, "请输入平台简称").max(16, "平台简称最多 16 个字符").default("BD"),
  imageUrl: z.string().trim().min(1, "请填写商品图片地址").max(255, "商品图片地址最多 255 个字符").default("/assets/package-thumb.png"),
  unit: z.string().trim().min(1, "请输入计量单位").max(24, "计量单位最多 24 个字符").default("个"),
  productType: z.enum(["NORMAL", "API"]).default("NORMAL"),
  priceTemplate: z.string().trim().max(80, "价格模板最多 80 个字符").optional().or(z.literal("")),
  baseQuantity: z.coerce.number().int("下单步长必须是整数").positive("下单步长必须大于 0").default(1),
  minQuantity: z.coerce.number().int("最小数量必须是整数").positive("最小数量必须大于 0").default(1),
  maxQuantity: z.coerce.number().int("最大数量必须是整数").positive("最大数量必须大于 0").default(1000000),
  allowRepeat: z.coerce.boolean().default(true),
  deliveryTime: z.string().trim().min(2, "请输入完成时间").max(80, "完成时间最多 80 个字符"),
  completionRate: z.coerce.number().int("完成率必须是整数").min(0, "完成率不能小于 0").max(100, "完成率不能超过 100").default(95),
  priceCent: z.coerce.number().int("销售价格必须是有效金额").min(10, "销售价格最低 0.1 元"),
  sortOrder: z.coerce.number().int("展示排序必须是整数").min(0, "展示排序不能小于 0").default(0),
  isActive: z.coerce.boolean().default(true),
});

export const updateOrderManagementSchema = z.object({
  action: z.enum([
    "PROCESSING",
    "PROGRESS",
    "COMPLETE",
    "RETURN_PROCESSING",
  ]),
  completedQuantity: z.coerce.number().int("已完成数量必须是整数").min(0, "已完成数量不能小于 0").optional(),
}).refine((input) => input.action !== "PROGRESS" || typeof input.completedQuantity === "number", {
  message: "请输入已完成数量",
  path: ["completedQuantity"],
});

export const createRefundSchema = z.object({
  amountCent: z.coerce.number().int().positive("退款金额必须大于 0").optional(),
  reason: z.string().trim().min(2, "请输入退款原因").max(120, "退款原因最多 120 个字符").optional().or(z.literal("")),
});

export function validationErrorMessage(error: unknown, fallback: string) {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message || fallback;
  }

  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message) as Array<{ message?: string }>;
      const firstMessage = Array.isArray(parsed) ? parsed[0]?.message : undefined;

      if (firstMessage) {
        return firstMessage;
      }
    } catch {
      // Some non-validation errors are regular business errors and should be shown as-is.
    }

    return error.message && !error.message.trim().startsWith("[") ? error.message : fallback;
  }

  return fallback;
}
