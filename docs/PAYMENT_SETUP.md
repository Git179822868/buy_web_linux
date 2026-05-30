# 官方收款配置手册

本文说明如何配置 `buy_web` 的轻量真实收款。新方案不再部署 Jeepay、Docker、RocketMQ 或 Java 支付中台，而是在宝塔 PHP 8.2+ / PHP-FPM 下运行 `official-pay-gateway`，通过 `yansongda/pay` 直连微信支付和支付宝官方通道。

## 官方资料

- yansongda/pay：<https://github.com/yansongda/pay>
- yansongda Pay 文档：<https://pay.yansongda.cn/>
- 微信支付商户平台：<https://pay.weixin.qq.com/>
- 微信支付 Native 支付：<https://pay.wechatpay.cn/doc/v3/merchant/4012791874>
- 微信支付 H5 支付：<https://pay.wechatpay.cn/doc/v3/merchant/4012791832>
- 支付宝开放平台：<https://open.alipay.com/>
- 支付宝电脑网站支付：<https://opendocs.alipay.com/apis/api_1/alipay.trade.page.pay>
- 支付宝手机网站支付：<https://opendocs.alipay.com/apis/api_1/alipay.trade.wap.pay>

支付产品准入、主体类型、费率和审核材料可能变化，正式上线前必须以微信支付商户平台和支付宝开放平台当前页面为准。

## 架构

```text
用户浏览器
  -> Nginx HTTPS
  -> buy_web Next.js :3000
  -> 127.0.0.1 official-pay-gateway PHP-FPM
  -> yansongda/pay
  -> 微信支付 / 支付宝
```

`buy_web` 仍然拥有订单、支付记录、退款记录和后台状态。PHP 网关只负责调用官方支付 SDK、验签上游回调，并把验签后的结果用内部 HMAC 转发回 Next.js。

当前前台支付方式：

| 前台支付方式 | 内部 wayCode | 通道 |
| --- | --- | --- |
| 微信扫码 | `WX_NATIVE` | 微信 Native |
| 微信 H5 | `WX_H5` | 微信 H5 |
| 支付宝网页 | `ALI_PC` | 支付宝电脑网站支付 |
| 支付宝 H5 | `ALI_WAP` | 支付宝手机网站支付 |

## 环境变量

真实收款：

```env
PAYMENT_PROVIDER="official"
APP_PUBLIC_URL="https://ahyichen.cn"
OFFICIAL_PAY_GATEWAY_URL="http://127.0.0.1:7301"
OFFICIAL_PAY_GATEWAY_SECRET="替换为至少32位随机密钥"
PAYMENT_RECONCILE_SECRET="替换为另一个随机密钥"
```

`OFFICIAL_PAY_GATEWAY_SECRET` 用于 Next.js 和 PHP 网关之间的 HMAC-SHA256 签名。`PAYMENT_RECONCILE_SECRET` 用于受保护的支付补偿接口。

## PHP 网关安装

推荐目录：

```bash
cd /www/wwwroot/buy_web_linux/official-pay-gateway
composer install --no-dev --optimize-autoloader
cp config.example.php config.php
```

证书和私钥放到站点目录外，例如：

```text
/etc/buy_web/pay-certs/wechat/apiclient_key.pem
/etc/buy_web/pay-certs/wechat/platform_cert.pem
/etc/buy_web/pay-certs/alipay/app_private_key.pem
/etc/buy_web/pay-certs/alipay/alipay_public_cert.pem
/etc/buy_web/pay-certs/alipay/app_public_cert.pem
/etc/buy_web/pay-certs/alipay/alipay_root_cert.pem
```

权限建议：

```bash
chown -R root:www /etc/buy_web/pay-certs
chmod 750 /etc/buy_web/pay-certs
find /etc/buy_web/pay-certs -type f -exec chmod 640 {} \;
```

不要把证书、私钥、API v3 key、`.env`、`config.php` 提交到 GitHub。

## 网关配置

编辑 `official-pay-gateway/config.php` 或通过 PHP-FPM 环境变量注入：

```env
BUY_WEB_GATEWAY_SECRET="必须与 OFFICIAL_PAY_GATEWAY_SECRET 一致"
OFFICIAL_PAY_PUBLIC_BASE_URL="https://ahyichen.cn/official-pay"
BUY_WEB_BASE_URL="https://ahyichen.cn"

WECHAT_PAY_MCH_ID="微信支付商户号"
WECHAT_PAY_API_V3_KEY="微信支付 API v3 key"
WECHAT_PAY_MCH_PRIVATE_KEY_PATH="/etc/buy_web/pay-certs/wechat/apiclient_key.pem"
WECHAT_PAY_PLATFORM_CERT_PATH="/etc/buy_web/pay-certs/wechat/platform_cert.pem"
WECHAT_PAY_MP_APP_ID="公众号/应用 AppID"

ALIPAY_APP_ID="支付宝应用 AppID"
ALIPAY_APP_PRIVATE_KEY_PATH="/etc/buy_web/pay-certs/alipay/app_private_key.pem"
ALIPAY_PUBLIC_CERT_PATH="/etc/buy_web/pay-certs/alipay/alipay_public_cert.pem"
ALIPAY_APP_PUBLIC_CERT_PATH="/etc/buy_web/pay-certs/alipay/app_public_cert.pem"
ALIPAY_ROOT_CERT_PATH="/etc/buy_web/pay-certs/alipay/alipay_root_cert.pem"
ALIPAY_RETURN_URL="https://ahyichen.cn/account/orders"
```

实际字段以 `official-pay-gateway/config.example.php` 和当前 yansongda/pay 文档为准。

## Nginx 暴露范围

PHP 网关内部接口只允许本机访问，下单、查单、退款都由 Next.js 从 `127.0.0.1` 调用。公网只暴露支付平台回调：

```nginx
location ^~ /official-pay/notify/ {
    root /www/wwwroot/buy_web_linux/official-pay-gateway/public;
    try_files /index.php =404;
    include fastcgi_params;
    fastcgi_param SCRIPT_FILENAME /www/wwwroot/buy_web_linux/official-pay-gateway/public/index.php;
    fastcgi_pass unix:/tmp/php-cgi-82.sock;
}

location ^~ /official-pay/health {
    root /www/wwwroot/buy_web_linux/official-pay-gateway/public;
    try_files /index.php =404;
    include fastcgi_params;
    fastcgi_param SCRIPT_FILENAME /www/wwwroot/buy_web_linux/official-pay-gateway/public/index.php;
    fastcgi_pass unix:/tmp/php-cgi-82.sock;
}
```

如果使用独立内网端口运行 PHP 网关，必须用防火墙或 Nginx `allow 127.0.0.1; deny all;` 限制内部 API。

## 加密与验签

- Next.js 调 PHP 网关：`x-buy-web-timestamp` + `x-buy-web-signature`，签名内容是 `timestamp.body`，算法 HMAC-SHA256，服务端校验 5 分钟时间窗。
- PHP 网关收微信/支付宝回调：由 `yansongda/pay` 按微信支付 API v3、支付宝 RSA2 或证书模式验签。
- PHP 网关转发给 Next.js：继续使用同一套 HMAC-SHA256，Next.js 验签后才调用 `handlePayNotify` 或 `handleRefundNotify`。
- Next.js 最终还会核对本地订单号和金额，不匹配不会改订单状态。

运行时必须能读取明文私钥。不要把“加密保存密钥”当作主要安全措施；本项目的安全边界是文件权限、HTTPS、HMAC、官方验签、最小暴露面和备份加密。

## 故障补偿

支付平台、PHP 网关或网络短暂不可用时，系统不删除支付流水，也不会因为超时把订单标记为已支付。只有签名回调或主动查单确认后，订单才会变为 `PAID`。

补偿接口：

```bash
curl -X POST "https://ahyichen.cn/api/payments/reconcile?limit=20&minAgeMinutes=2" \
  -H "x-buy-web-reconcile-secret: $PAYMENT_RECONCILE_SECRET"
```

cron 示例：

```cron
*/5 * * * * curl -fsS -X POST "https://ahyichen.cn/api/payments/reconcile?limit=20&minAgeMinutes=2" -H "x-buy-web-reconcile-secret: 替换为补偿密钥" >> /var/log/buyweb-payment-reconcile.log 2>&1
```

## 上线验证

上线前先完成：

- 微信支付 Native/H5 产品已开通，域名和证书配置正确。
- 支付宝电脑网站支付/手机网站支付已开通，应用已上线，密钥或证书配置正确。
- `composer install --no-dev --optimize-autoloader` 成功。
- `php -l official-pay-gateway/public/index.php` 通过。
- `/official-pay/health` 返回 `{"ok":true}`。
- `PAYMENT_PROVIDER=official` 后 Next.js 能创建支付尝试。

小额实付顺序：

1. 支付宝网页支付。
2. 支付宝 H5 支付。
3. 微信扫码支付。
4. 微信 H5 支付。
5. 支付成功回调。
6. 主动查单补偿。
7. 原路退款、退款查询和退款回调。

未完成小额实付前，不要把生产订单视为已收款。
