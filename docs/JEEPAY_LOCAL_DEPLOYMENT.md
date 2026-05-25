# Jeepay 本机部署与 buy_web 接入

本文用于把 `buy_web` 的本地虚拟支付切换为 Jeepay。Jeepay 是独立支付中台，必须先运行 Jeepay 后台，再把 `buy_web` 的支付网关地址、商户号、应用 ID、应用密钥填入 `.env`。

## 当前项目状态

`buy_web` 已经有 Jeepay 适配代码：

- 下单：`POST {JEEPAY_GATEWAY_URL}/api/pay/unifiedOrder`
- 查单：`POST {JEEPAY_GATEWAY_URL}/api/pay/query`
- 关单：`POST {JEEPAY_GATEWAY_URL}/api/pay/close`
- 退款：`POST {JEEPAY_GATEWAY_URL}/api/refund/refundOrder`
- 支付通知：`{APP_PUBLIC_URL}/api/payments/jeepay/notify`
- 退款通知：`{APP_PUBLIC_URL}/api/refunds/notify/jeepay`

当前支持的 Jeepay 支付方式码：

| buy_web 支付方式 | Jeepay wayCode | 入口 |
| --- | --- | --- |
| 微信扫码 | `WX_NATIVE` | PC |
| 微信 H5 | `WX_H5` | 手机浏览器 |
| 支付宝网页 | `ALI_PC` | PC |
| 支付宝 H5 | `ALI_WAP` | 手机浏览器 |

## Windows 本机部署

推荐用 Docker Desktop 跑 Jeepay 官方 Compose 集群。Jeepay 源码放在：

```text
I:\AITool\codex\buy_web\.local\jeepay\server
I:\AITool\codex\buy_web\.local\jeepay\jeepay-ui
```

`.local` 已加入 `.gitignore`，不要把 Jeepay 第三方源码、容器数据、数据库数据或密钥提交到 Git。

### 1. 安装本机依赖

Windows 本机需要：

- Git
- Docker Desktop
- Node.js/npm 用于运行 `buy_web`

如果不使用 Docker，则需要自己准备 JDK 17、Maven、MySQL、Redis、RocketMQ，并手动调整 Jeepay 的 `conf/*/application.yml`，新手不建议这样做。

### 2. 启动 Jeepay

在 `buy_web` 根目录执行：

```powershell
.\scripts\windows-jeepay-compose.ps1
```

脚本会检查并使用这些端口：

| 服务 | 地址 |
| --- | --- |
| 支付网关 | `http://localhost:9216` |
| 收银台 UI | `http://localhost:9226` |
| 运营平台 UI | `http://localhost:9227` |
| 商户系统 UI | `http://localhost:9228` |
| MySQL | `127.0.0.1:13306` |
| Redis | `127.0.0.1:6380` |

查看状态：

```powershell
.\scripts\windows-jeepay-compose.ps1 -StatusOnly
```

### 3. 登录后台

运营平台：

```text
http://localhost:9227
账号：jeepay
密码：jeepay123
```

商户系统：

```text
http://localhost:9228
账号：先在运营平台创建商户用户
默认密码：jeepay666
```

### 4. 创建商户和应用

在 Jeepay 运营平台中完成：

1. 创建商户。
2. 创建商户应用。
3. 复制商户号、应用 ID、应用密钥。
4. 在支付接口配置中启用需要的通道，例如微信官方、支付宝官方。

没有微信/支付宝正式商户参数时，只能验证 Jeepay 后台和接口连通，不能完成真实付款或真实退款。

### 5. 切换 buy_web 到 Jeepay

编辑 `buy_web\.env`：

```env
APP_PUBLIC_URL="http://host.docker.internal:3000"
PAYMENT_PROVIDER="jeepay"
JEEPAY_GATEWAY_URL="http://127.0.0.1:9216"
JEEPAY_MCH_NO="从 Jeepay 商户应用复制"
JEEPAY_APP_ID="从 Jeepay 商户应用复制"
JEEPAY_APP_SECRET="从 Jeepay 商户应用复制"
```

`host.docker.internal` 是给 Docker 容器回调 Windows 主机上的 `buy_web` 使用。如果 Jeepay 和 `buy_web` 都部署在 Linux 服务器上，改成公网 HTTPS 域名，例如：

```env
APP_PUBLIC_URL="https://www.example.com"
JEEPAY_GATEWAY_URL="https://pay.example.com"
```

### 6. 验证 buy_web

```powershell
npm run db:generate
npx prisma validate
npm run typecheck
npm run lint
npm run security:scan
npm run build
npm run dev
```

浏览器打开 `http://localhost:3000` 后测试：

1. 前台选择商品数量并下单。
2. 订单页选择支付方式。
3. 确认支付记录供应商为 `JEEPAY`。
4. PC 端能展示二维码或跳转链接，手机端能拿到 H5 支付链接。
5. 后台订单页能查询支付状态。
6. 对已支付测试订单发起部分退款，确认 Jeepay 退款单创建成功。

## 常见问题

### 本机没有 Docker

`windows-jeepay-compose.ps1` 会停止并提示安装 Docker Desktop。没有 Docker 时，本机无法按官方 Compose 方式启动 Jeepay 完整集群。

### 端口被占用

脚本会列出占用端口和进程。不要直接结束不认识的进程，先确认是否是已有 Jeepay、MySQL、Redis、RocketMQ 或其他本机服务。

### 下单时报缺少 Jeepay 环境变量

说明 `.env` 里 `JEEPAY_MCH_NO`、`JEEPAY_APP_ID` 或 `JEEPAY_APP_SECRET` 还没填。必须先在 Jeepay 后台创建商户和应用。

### Jeepay 能打开但支付失败

检查：

- 商户应用是否启用。
- 支付接口配置是否启用对应 wayCode。
- 微信/支付宝官方商户参数是否正确。
- `APP_PUBLIC_URL` 是否能被 Jeepay 支付网关访问。
- `buy_web` 的支付通知和退款通知接口是否返回 200。

### 本机可以测，正式收款不行

微信/支付宝正式收款需要公网 HTTPS 域名、真实商户号、API 证书/密钥、回调地址和产品权限。本机 `localhost` 只能做开发联调。
