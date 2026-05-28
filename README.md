# 账号关注投放商城

一个精简部署的账号关注/点赞/播放套餐购买系统：用户商城、登录注册、个人中心、订单生成、支付适配、客服后台、套餐管理都在同一个 Next.js 应用里完成。

## 精简技术路线

| 模块 | 技术 |
| --- | --- |
| 网站与后台 | Next.js 16 + React 19 + TypeScript |
| 数据库 | MySQL 8 |
| ORM | Prisma |
| 支付 | 本地 mock 或 Jeepay，生产接 Jeepay |
| 用户登录 | 手机号 + 密码 + 验证码，HTTP-only Cookie + JWT + bcrypt |
| 后台登录 | 独立管理员账号，HTTP-only Cookie + JWT + bcrypt |
| 部署 | 一个 Node.js 服务 + MySQL + Nginx |

Jeepay 自己仍然独立部署。为了减少组件数量，我们的网站使用 Jeepay 同一台 MySQL 实例，但必须使用独立数据库：

```text
mysql server
  jeepaydb    # Jeepay 自己使用
  buyweb      # 本系统使用
```

不要把本系统表建进 `jeepaydb`，避免后续 Jeepay 升级和迁移冲突。

更完整的技术流、支付设计和开源参考项目见：

```text
docs/TECHNICAL_FLOW.md
```

## 当前后台范围

已按参考站后台重新整理为更轻量的运营系统：

| 菜单 | 用途 |
| --- | --- |
| 控制台 | 销售额、订单、用户、商品概览 |
| 账号信息 | 管理员名称、手机号、头像、简介 |
| 网站设置 | 站点名称、运营商、备案、关键词、联系方式 |
| 商品管理 | 商品图片、分类、筛选标签、价格模板、数量范围、上下架 |
| 用户管理 | 查询用户、查看余额、禁用/启用账号 |
| 订单列表 | 查询订单、修改状态、查看数量进度和退款信息 |
| 财务明细 | 用户余额流水、充值、消费、退款、调整记录 |

已删除或不实现：分站、分站域名、分站等级、会员/VIP、邀请码、密价、流量领取。

## 数据库表

Prisma 会在 `buyweb` 数据库中创建这些核心表：

| 表 | 说明 |
| --- | --- |
| `users` | 用户手机号登录、余额、状态 |
| `service_packages` | 商品/套餐、分类、价格、数量范围 |
| `orders` | 用户订单、执行数量、退款数量、订单状态 |
| `payment_records` | mock/Jeepay 支付记录和通知原文 |
| `admin_users` | 后台管理员 |
| `audit_logs` | 后台操作审计 |
| `security_events` | 登录、注册、下单、支付等安全事件与限流计数 |
| `security_blocks` | IP、手机号、账号或订单维度的临时/人工封禁 |
| `site_settings` | 网站基础信息 |
| `contact_settings` | 客服联系方式 |
| `balance_ledgers` | 余额流水 |

## 本地启动

1. 安装 Node.js LTS 和 MySQL 8。
2. 创建数据库：

```sql
CREATE DATABASE IF NOT EXISTS buyweb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'buyweb'@'localhost' IDENTIFIED BY 'buyweb_dev';
CREATE USER IF NOT EXISTS 'buyweb'@'127.0.0.1' IDENTIFIED BY 'buyweb_dev';
GRANT ALL PRIVILEGES ON buyweb.* TO 'buyweb'@'localhost';
GRANT ALL PRIVILEGES ON buyweb.* TO 'buyweb'@'127.0.0.1';
FLUSH PRIVILEGES;
```

3. 复制环境变量：

```powershell
Copy-Item .env.example .env
```

4. 安装依赖并建表：

```powershell
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
```

5. 启动开发服务：

```powershell
npm run dev
```

默认访问：

```text
商城首页：http://localhost:3000
用户登录：http://localhost:3000/login
个人中心：http://localhost:3000/account
后台：http://localhost:3000/admin/login
默认账号：admin
默认密码：Admin@123456
```

## 支付模式

本项目有两种支付运行模式：

```env
PAYMENT_PROVIDER="mock"
```

这样可以不部署 Jeepay，用户注册/登录后下单，再在订单页点击“模拟支付成功”完成测试。

本机切换 Jeepay 前先看：

```text
docs/JEEPAY_LOCAL_DEPLOYMENT.md
```

Windows + Docker Desktop 本机启动 Jeepay：

```powershell
.\scripts\windows-jeepay-compose.ps1
```

Jeepay 后台入口：

```text
运营平台：http://localhost:9227  jeepay / jeepay123
商户系统：http://localhost:9228  先在运营平台创建商户，默认密码 jeepay666
支付网关：http://localhost:9216
```

本机 Jeepay `.env` 示例：

```env
PAYMENT_PROVIDER="jeepay"
APP_PUBLIC_URL="http://host.docker.internal:3000"
JEEPAY_GATEWAY_URL="http://127.0.0.1:9216"
JEEPAY_MCH_NO="Jeepay 商户号"
JEEPAY_APP_ID="Jeepay 应用 ID"
JEEPAY_APP_SECRET="Jeepay 应用密钥"
```

生产收款建议先接 Jeepay，由 Jeepay 再接微信支付官方、支付宝官方等上游通道。本项目已经内置以下 `wayCode`：

| 前台支付方式 | Jeepay wayCode | 使用场景 | 上游需要开通 |
| --- | --- | --- | --- |
| 微信扫码 | `WX_NATIVE` | PC 网页展示二维码，用户用微信扫码 | 微信支付 Native 支付 |
| 微信 H5 | `WX_H5` | 手机系统浏览器拉起微信支付，不支持微信内置浏览器 | 微信支付 H5 支付 |
| 支付宝网页 | `ALI_PC` | PC 网页跳转支付宝收银台 | 支付宝电脑网站支付 |
| 支付宝 H5 | `ALI_WAP` | 手机浏览器跳转支付宝 App 或网页收银台 | 支付宝手机网站支付 |

正式切换 Jeepay 前，需要先完成：

1. 独立部署 Jeepay，并确保支付网关公网可访问。
2. 在 Jeepay 运营平台添加商户和应用，配置微信支付官方、支付宝官方通道参数。
3. 在微信支付商户平台申请 Native/H5 支付权限；H5 支付通常需要可公网访问的已备案支付域名、经营内容页面和场景截图。
4. 在支付宝开放平台创建网页/移动应用，配置密钥，上线审核，并在商家平台签约电脑网站支付、手机网站支付。
5. 将 Jeepay 商户号、应用 ID、应用密钥写入本项目 `.env`。

生产 `.env` 示例：

```env
PAYMENT_PROVIDER="jeepay"
APP_PUBLIC_URL="https://www.example.com"
JEEPAY_GATEWAY_URL="https://pay.example.com"
JEEPAY_MCH_NO="Jeepay 商户号"
JEEPAY_APP_ID="Jeepay 应用 ID"
JEEPAY_APP_SECRET="Jeepay 应用私钥"
```

本项目调用 Jeepay 统一下单接口：

```text
POST {JEEPAY_GATEWAY_URL}/api/pay/unifiedOrder
```

Jeepay 支付通知回调到本项目：

```text
{APP_PUBLIC_URL}/api/payments/jeepay/notify
```

退款通知回调到：

```text
{APP_PUBLIC_URL}/api/refunds/notify/jeepay
```

回调接口会校验 `mchNo`、`appId`、MD5 签名、订单号和金额，成功后只返回小写 `success`。

个人申请要求要提前确认：本项目不支持个人免签、个人收款码或手工收款码替代支付接口。正式线上收款通常需要真实经营主体、已备案域名、可展示的商品/服务页面、商户号和支付产品签约权限；个人要长期稳定接入，建议先办理个体工商户或企业主体，再按微信/支付宝官方审核要求申请。

支付详细配置、官方原文链接和 Jeepay 后台填写项见：

```text
docs/PAYMENT_SETUP.md
```

## 验证

当前代码已经通过：

```powershell
npm run typecheck
npm run lint
npm run security:scan
npm run build
```

完整业务测试需要本机或服务器有 MySQL，并执行 Prisma 迁移和 seed。

## Linux / 腾讯云轻量灯塔 / 宝塔部署

新手部署请先看：

```text
docs/BAOTA_LINUX_INSTALL.md
```

这份文档按腾讯云轻量应用服务器（Lighthouse，很多人也叫轻量/灯塔）+ 宝塔面板 + Nginx + MySQL 8 + PM2 来写，包含：

- 轻量服务器安全组端口放行。
- 宝塔面板安装和运行环境选择。
- `buyweb` 数据库创建、运行账号和迁移账号拆分。
- Nginx 反向代理到 `http://127.0.0.1:3000`。
- 宝塔 Let's Encrypt SSL 证书自动申请和续签。
- MySQL 备份、校验和恢复演练。

Linux 服务器上不要复制 Windows 的 `node_modules` 或 `.next`。请在服务器项目目录重新执行：

```bash
npm ci
npm run db:generate
npm run build
```

宝塔部署建议使用 Nginx 反向代理到 `http://127.0.0.1:3000`，并用 PM2 托管：

```bash
bash scripts/linux-bootstrap.sh
npm run db:deploy
npm run db:seed
bash scripts/linux-pm2-start.sh
```

## 安全与备份

- 应用层：登录、注册、下单、支付查询使用 IP + 账号维度限流，禁用账号的旧 Cookie 会失效。
- SQL 注入：业务代码使用 Prisma 参数化查询，`npm run security:scan` 会阻止未审查的原生 SQL。
- 应急开关：`REGISTRATION_DISABLED`、`ORDER_WRITE_DISABLED`、`PAYMENT_WRITE_DISABLED` 可临时关闭对应写入。
- 备份：`npm run backup:mysql` 生成 MySQL 全量备份、SHA256 校验和恢复说明；`npm run backup:verify` 做校验和可选临时库恢复演练。
- 运维配置：Nginx 限流、MySQL 最小权限和 binlog 配置见 `docs/DEPLOYMENT.md`。

## 当前产品范围

- 首页保留：套餐列表、账号关注筛选、搜索、立即购买。
- 删除：分站搭建、流量领取、VIP/会员升级入口。
- 用户端：手机号注册登录、个人中心、我的订单。
- 后台端：控制台、账号信息、网站设置、订单查询、商品管理、用户管理、财务流水。
- 响应式：桌面端为横幅 + 商品网格 + 订单摘要，手机端自动缩成双列商品和单列下单表单。
