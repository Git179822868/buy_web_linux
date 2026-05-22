# 支付配置手册

本文说明本项目如何从本地 mock 支付切换到 Jeepay，并通过 Jeepay 接入微信支付官方、支付宝官方的 PC 与 H5 支付方式。

## 官方原文链接

Jeepay：

- Jeepay 开源项目：<https://github.com/jeequan/jeepay>
- Jeepay 系统使用：<https://docs.jeequan.com/docs/jeepay/jeepay-1dbdn8bqgo270>
- Jeepay 支付接口：<https://docs.jeequan.com/docs/jeepay_api/jeepay_api-1dabshnfu814r>
- Jeepay 支付网关接口新版文档：<https://docs.jeequan.com/docs/jeepay/payment_api>
- Jeepay 通道对接：<https://docs.jeequan.com/docs/jeepay/dev_channel>

微信支付：

- 微信支付商户平台：<https://pay.weixin.qq.com/>
- 微信支付 Native 支付产品介绍：<https://pay.wechatpay.cn/doc/v3/merchant/4012791874>
- 微信支付 H5 支付产品介绍：<https://pay.wechatpay.cn/doc/v3/merchant/4012791832>
- 微信支付 H5 支付申请权限指引：<https://pay.wechatpay.cn/doc/v3/merchant/4012791841>
- 微信支付 H5 快速开始：<https://pay.wechatpay.cn/doc/v3/merchant/4015614193>

支付宝：

- 支付宝开放平台：<https://open.alipay.com/>
- 支付宝网页/移动应用：<https://open.alipay.com/module/webApp>
- 支付宝手机网站支付 API：<https://opendocs.alipay.com/apis/api_1/alipay.trade.wap.pay>
- 支付宝电脑网站支付 API：<https://opendocs.alipay.com/apis/api_1/alipay.trade.page.pay>
- 支付宝商家平台：<https://b.alipay.com/>

以上链接以官方最新页面为准。支付产品准入、主体类型、费率和审核材料经常调整，正式上线前必须在官方后台再核对一次。

## 当前项目的支付结构

本项目不是直接连微信或支付宝，而是：

```text
buy_web
  -> Jeepay 支付网关
    -> 微信支付官方通道
    -> 支付宝官方通道
```

这样做的好处是本项目只维护一套支付网关逻辑，微信和支付宝的证书、密钥、支付产品开通和通道参数主要放在 Jeepay 管理。

当前代码已支持：

| 前台支付方式 | 传给 Jeepay 的 wayCode | 推荐终端 |
| --- | --- | --- |
| 微信扫码 | `WX_NATIVE` | PC |
| 微信 H5 | `WX_H5` | 手机系统浏览器 |
| 支付宝网页 | `ALI_PC` | PC |
| 支付宝 H5 | `ALI_WAP` | 手机浏览器 |

注意：微信 H5 是微信客户端外的手机浏览器场景。用户在微信内置浏览器里打开本网站时，不应直接使用 `WX_H5` 拉起支付；本项目页面会提示用户改用系统浏览器或 PC 扫码。

## 本项目 `.env` 配置

本地测试保持：

```env
PAYMENT_PROVIDER="mock"
```

生产切换：

```env
PAYMENT_PROVIDER="jeepay"
APP_PUBLIC_URL="https://www.example.com"
JEEPAY_GATEWAY_URL="https://pay.example.com"
JEEPAY_MCH_NO="Jeepay 商户号"
JEEPAY_APP_ID="Jeepay 应用 ID"
JEEPAY_APP_SECRET="Jeepay 应用密钥"
```

含义：

| 环境变量 | 来源 | 说明 |
| --- | --- | --- |
| `PAYMENT_PROVIDER` | 本项目 | `mock` 为模拟支付，`jeepay` 为正式支付 |
| `APP_PUBLIC_URL` | 你的域名 | 必须是公网可访问 HTTPS 域名 |
| `JEEPAY_GATEWAY_URL` | Jeepay 部署地址 | Jeepay 支付网关公网地址，例如 `https://pay.example.com` |
| `JEEPAY_MCH_NO` | Jeepay 商户系统 | Jeepay 商户号 |
| `JEEPAY_APP_ID` | Jeepay 商户应用 | Jeepay 应用 ID |
| `JEEPAY_APP_SECRET` | Jeepay 商户应用 | 用于 Jeepay API 签名和回调验签 |

本项目发起支付时会调用：

```text
POST {JEEPAY_GATEWAY_URL}/api/pay/unifiedOrder
```

本项目支付通知地址：

```text
{APP_PUBLIC_URL}/api/payments/jeepay/notify
```

本项目退款通知地址：

```text
{APP_PUBLIC_URL}/api/refunds/notify/jeepay
```

## Jeepay 后台配置步骤

1. 部署 Jeepay。

   Jeepay 需要运营平台、商户系统、支付网关等服务正常可用。支付网关地址必须公网可访问，否则微信、支付宝等上游支付渠道无法正常回调 Jeepay。

2. 设置 Jeepay 系统地址。

   在 Jeepay 运营平台配置真实环境地址，至少确认：

   - 支付网关地址，例如 `https://pay.example.com`
   - 商户系统地址
   - 运营平台地址

3. 添加支付接口。

   在 Jeepay 运营平台的支付配置中启用：

   - 微信支付官方
   - 支付宝官方

4. 添加商户和商户应用。

   Jeepay 支持普通商户和特约商户。第一版建议用普通商户模式，除非你明确在做服务商/进件业务。

   创建商户后，进入商户应用，为应用配置支付接口参数和支付方式。

5. 配置微信支付官方通道。

   Jeepay 后台通常会要求填写微信支付商户资料，例如：

   - 微信支付商户号
   - AppID
   - API v3 key
   - 商户 API 证书序列号
   - 商户私钥或证书文件
   - 微信支付平台证书或平台公钥配置

   具体字段以当前 Jeepay 版本的通道配置表单为准。

6. 配置支付宝官方通道。

   Jeepay 后台通常会要求填写支付宝资料，例如：

   - 支付宝应用 AppID
   - 支付宝商户 PID，如当前通道表单需要
   - 应用私钥
   - 支付宝公钥或证书模式参数
   - 签名方式，建议 RSA2
   - 支付宝网关，生产环境使用正式网关

   具体字段以当前 Jeepay 版本的通道配置表单为准。

7. 启用支付方式。

   至少启用本项目使用的四个方式：

   ```text
   WX_NATIVE
   WX_H5
   ALI_PC
   ALI_WAP
   ```

8. 获取本项目需要的 Jeepay 参数。

   在 Jeepay 商户应用里找到：

   - 商户号，对应 `JEEPAY_MCH_NO`
   - 应用 ID，对应 `JEEPAY_APP_ID`
   - 应用密钥，对应 `JEEPAY_APP_SECRET`

9. 回到本项目修改 `.env`，重启应用：

   ```bash
   pm2 restart buyweb --update-env
   ```

10. 先小额测试。

   建议按顺序测试：

   - mock 模式完整下单
   - Jeepay `WX_NATIVE`
   - Jeepay `ALI_PC`
   - 手机系统浏览器 `WX_H5`
   - 手机浏览器 `ALI_WAP`
   - 支付成功回调
   - 后台退款和退款回调

## 微信支付申请与配置

本项目用到：

- `WX_NATIVE`：PC 微信扫码支付
- `WX_H5`：手机系统浏览器拉起微信支付

你需要先有微信支付商户号。如果没有商户号，先在微信支付商户平台入驻。

### Native 支付

Native 支付适合 PC 网页二维码收款。Jeepay 返回二维码地址后，本项目订单页会展示二维码或支付链接。

申请和配置重点：

- 微信支付商户号已完成入驻和认证。
- 开通 Native 支付产品。
- 准备微信支付 API v3 相关密钥、证书和 AppID。
- 将这些参数填入 Jeepay 的微信支付官方通道配置。

### H5 支付

H5 支付适合手机系统浏览器，不适合微信内置浏览器，也不适合 App 内 WebView。

申请和配置重点：

- 已有微信支付商户号。
- 在微信支付商户平台申请 H5 支付权限。
- 支付域名必须公网可访问，且能看到真实经营内容。
- 通常需要 ICP 备案信息、支付域名备案截图、经营场所或商品服务场景截图。
- 申请通过后，在微信支付商户平台配置 H5 支付域名。
- 将商户号、AppID、API v3 key、证书等填入 Jeepay。

个人要求：

- 不建议用个人微信收款码或个人免签方案做线上自动收款，本项目也没有实现这类能力。
- 长期稳定接入通常需要真实经营主体。个人如果没有主体，建议先办理个体工商户或企业，再按微信支付官方入驻要求申请商户号和支付产品。
- 微信 H5 支付支持的主体类型、类目和资料要求以微信支付商户平台申请页为准。

## 支付宝申请与配置

本项目用到：

- `ALI_PC`：PC 电脑网站支付
- `ALI_WAP`：手机网站支付，也就是支付宝 H5/WAP 支付

### 开放平台应用

在支付宝开放平台创建网页/移动应用，完成：

- 创建应用
- 配置 RSA2 密钥或证书
- 配置接口加签方式
- 提交审核并上线

支付宝开放平台的网页/移动应用接入流程包括创建应用、开发配置、提交审核和上线。本项目不直接调用支付宝 SDK，但 Jeepay 的支付宝官方通道仍需要这些应用和密钥参数。

### 手机网站支付 H5

`ALI_WAP` 对应支付宝手机网站支付接口，常见接口名是：

```text
alipay.trade.wap.pay
```

配置重点：

- 支付宝应用已上线或具备可调用权限。
- 已签约手机网站支付。
- 网站建议使用 HTTPS。
- 站点需要真实可访问，展示明确的商品/服务、价格、售后或联系方式。
- 将 AppID、应用私钥、支付宝公钥或证书参数填入 Jeepay。

### 电脑网站支付

`ALI_PC` 对应支付宝电脑网站支付，常见接口名是：

```text
alipay.trade.page.pay
```

配置重点：

- 已签约电脑网站支付。
- 网站通常需要 ICP 备案、可公网访问、页面完整、有明确经营内容和商品信息。
- 将支付宝通道参数填入 Jeepay。

个人要求：

- 个人支付宝账号可以用于实名和登录开放平台，但正式线上经营收款通常要通过支付宝商家平台和支付产品签约审核。
- 如果你是个人经营，建议优先办理个体工商户，再申请支付宝商家/开放平台支付产品。
- 不要依赖个人收款码、免签收款或轮询截图类方案；这类方案不在本项目支持范围内，稳定性和合规风险都高。

## 本项目上线前支付检查

本项目侧：

- `.env` 中 `PAYMENT_PROVIDER="jeepay"`。
- `APP_PUBLIC_URL` 是真实 HTTPS 域名。
- `JEEPAY_GATEWAY_URL` 是真实 Jeepay 支付网关地址。
- `JEEPAY_MCH_NO`、`JEEPAY_APP_ID`、`JEEPAY_APP_SECRET` 与 Jeepay 商户应用一致。
- Nginx 能把 `{APP_PUBLIC_URL}/api/payments/jeepay/notify` 转发到本项目。
- Nginx 能把 `{APP_PUBLIC_URL}/api/refunds/notify/jeepay` 转发到本项目。

Jeepay 侧：

- 支付网关公网可访问。
- 商户、应用、应用密钥配置完成。
- 微信支付官方通道参数完整。
- 支付宝官方通道参数完整。
- `WX_NATIVE`、`WX_H5`、`ALI_PC`、`ALI_WAP` 已启用。
- 费率按真实申请费率填写。

微信支付侧：

- 商户号已认证。
- Native 支付已开通。
- H5 支付已开通。
- H5 支付域名已配置。
- API v3 key、证书、AppID 可用。

支付宝侧：

- 开放平台应用已创建。
- 应用密钥已配置。
- 应用已上线或具备接口调用权限。
- 电脑网站支付已签约。
- 手机网站支付已签约。

## 常见问题

### Jeepay 能下单，但本项目订单一直不变成已支付

检查：

- Jeepay 是否能访问 `{APP_PUBLIC_URL}/api/payments/jeepay/notify`
- 本项目 Nginx 是否把 `/api/payments/jeepay/notify` 转发到 Next.js
- `.env` 中 `APP_PUBLIC_URL` 是否是公网 HTTPS 域名
- `JEEPAY_APP_SECRET` 是否和 Jeepay 应用密钥一致

### 微信 H5 在微信内置浏览器打不开

这是场景问题。微信 H5 支付面向微信客户端外的手机浏览器。微信内置浏览器应改用 JSAPI/公众号支付，本项目第一版没有实现该模式。

### H5 支付申请被拒

常见原因：

- 域名未备案或备案主体不匹配
- 网站打不开或没有真实经营内容
- 商品/服务、价格、联系方式、售后规则不完整
- 经营类目和申请产品不匹配
- 场景截图不符合官方要求

### 支付宝提示未签约或无权限

检查：

- 是否签约了电脑网站支付或手机网站支付
- 当前 AppID 是否绑定了对应支付产品
- 应用是否已上线或具备调用权限
- Jeepay 中 AppID、私钥、公钥或证书参数是否填写到了正确通道

### 个人能不能直接接

不建议按个人收款码做线上自动收款，也不要找免签通道替代正式支付接口。长期经营建议办理个体工商户或企业主体，按微信支付和支付宝的官方商户入驻、产品签约和域名审核流程申请。
