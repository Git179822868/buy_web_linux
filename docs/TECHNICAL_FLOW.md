# 网站整体技术流与付费参考

## 项目定位

本项目是线上服务套餐购买系统，不是传统实物电商。第一版只处理服务套餐展示、用户登录、生成订单、支付记录、后台客服处理和财务查看。

不做购物车、多商户、分账、库存、物流、分站、VIP、会员等级、邀请码、密价和流量领取。

## 技术流

```text
用户浏览前台
  -> 选择服务套餐和数量
  -> 手机号登录或注册
  -> 提交目标账号/主页链接
  -> Next.js API 创建订单
  -> Prisma 写入 MySQL
  -> 创建 payment_records 支付记录
  -> mock 本地支付或 official 官方支付网关
  -> 支付成功后更新订单和支付状态
  -> 后台客服查看订单并处理
```

## 技术选型

| 模块 | 技术 | 作用 |
| --- | --- | --- |
| 前台商城 | Next.js + React | 套餐列表、筛选、下单页面 |
| 后台管理 | Next.js + React | 商品、订单、用户、财务、站点配置 |
| 类型系统 | TypeScript | 降低接口和数据字段错误 |
| 数据库 | MySQL 8 | 保存用户、商品、订单、支付、后台数据 |
| ORM | Prisma | 管理数据表和数据库查询 |
| 参数校验 | zod | 校验登录、下单、后台表单参数 |
| 登录 | Cookie + JWT + bcrypt | 用户和管理员认证 |
| 验证码 | 签名 SVG 验证码 | 登录/注册前先校验，减少恶意写库 |
| 安全限流 | Prisma 安全事件表 | 记录注册、登录、下单、支付查询等高风险行为 |
| 本地支付 | mock | 不部署真实支付也能测试下单支付 |
| 正式支付 | official-pay-gateway + yansongda/pay | 对接微信支付和支付宝官方通道 |
| 部署 | Node.js + MySQL + Nginx | 保持部署组件最少 |

## 核心数据库表

| 表 | 作用 |
| --- | --- |
| `users` | 用户手机号、密码、余额、状态 |
| `service_packages` | 服务套餐、分类、价格、数量范围、上下架 |
| `orders` | 订单号、用户、套餐、目标账号、数量、金额、订单状态 |
| `payment_records` | 支付渠道、支付状态、official 请求/响应/通知原文 |
| `admin_users` | 后台管理员 |
| `site_settings` | 网站名称、备案、关键词、描述 |
| `contact_settings` | 客服联系方式 |
| `balance_ledgers` | 余额充值、消费、退款、调整流水 |
| `audit_logs` | 后台操作审计 |
| `security_events` | 登录、注册、下单、支付等安全事件 |
| `security_blocks` | IP、手机号、账号、订单维度封禁 |

## 支付设计

本地开发默认使用：

```env
PAYMENT_PROVIDER="mock"
```

mock 模式会创建订单和支付记录，订单页可以点击模拟支付成功，适合在没有支付网关时完成业务测试。

生产环境切换为：

```env
PAYMENT_PROVIDER="official"
APP_PUBLIC_URL="https://www.example.com"
OFFICIAL_PAY_GATEWAY_URL="http://127.0.0.1:7301"
OFFICIAL_PAY_GATEWAY_SECRET="内部 HMAC 密钥"
PAYMENT_RECONCILE_SECRET="支付补偿接口密钥"
```

Next.js 内部调用 PHP 网关：

```text
POST {OFFICIAL_PAY_GATEWAY_URL}/payments
```

微信/支付宝先回调 PHP 网关，官方验签后再转发给 Next.js：

```text
{APP_PUBLIC_URL}/official-pay/notify/*
{APP_PUBLIC_URL}/api/payments/official/notify
```

内部通知使用 HMAC-SHA256 校验 `timestamp.body`，并再次核对订单号和金额。支付平台故障或回调失败时，`/api/payments/reconcile` 会主动查询仍处于 `CREATED/PAYING` 的 official 支付记录。

## 付费部分参考项目

| 项目 | 用途 |
| --- | --- |
| [yansongda/pay](https://github.com/yansongda/pay) | PHP 微信支付和支付宝 SDK，当前 official 支付网关使用 |
| [vercel/nextjs-stripe-template](https://github.com/vercel/nextjs-stripe-template) | 参考最简单的商品展示、点击支付、支付完成流程 |
| [nextjs/saas-starter](https://github.com/nextjs/saas-starter) | 参考登录、定价页、用户后台、账单状态管理 |
| [joschan21/digitalhippo](https://github.com/joschan21/digitalhippo) | 参考虚拟商品/数字服务商城、商品后台、购买后订单管理 |
| [yongfook/zipsell](https://github.com/yongfook/zipsell) | 参考付款后交付数字内容的思路 |
| [Tzur1234/gumroad-clone](https://github.com/Tzur1234/gumroad-clone) | 参考 Gumroad 类数字产品购买流程 |
| [calcom/cal.diy](https://github.com/calcom/cal.diy) | 后期如果卖预约咨询，可参考预约和日程模式 |
| [alextselegidis/easyappointments](https://github.com/alextselegidis/easyappointments) | 参考简单预约服务系统 |

这些项目只作为业务流程和页面设计参考，当前项目不引入 Stripe、Postgres、Redis、Elasticsearch、ActiveMQ 或多服务架构。
