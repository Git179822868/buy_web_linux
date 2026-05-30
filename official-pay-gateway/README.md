# Official Pay Gateway

`official-pay-gateway` is the lightweight PHP payment gateway used by `buy_web`.
It replaces the old heavy Java payment-center approach and calls WeChat Pay and
Alipay through `yansongda/pay`.

The Next.js app still owns orders, payment records, refund records, admin state,
and reconciliation. This gateway only creates upstream payment/refund requests,
verifies official channel callbacks, and forwards verified results back to
Next.js with an internal AES-256-GCM encrypted body and HMAC signature.

## Runtime

- PHP 8.2+
- Composer
- `yansongda/pay` v3
- Nginx or Baota PHP-FPM

Install:

```bash
cd /www/wwwroot/buy_web_linux/official-pay-gateway
composer install --no-dev --optimize-autoloader
cp config.example.php config.php
```

## Secrets

Do not put merchant secrets in GitHub or the website public root. Recommended
certificate directory:

```text
/etc/buy_web/pay-certs/wechat/apiclient_key.pem
/etc/buy_web/pay-certs/wechat/platform_cert.pem
/etc/buy_web/pay-certs/alipay/app_private_key.pem
/etc/buy_web/pay-certs/alipay/alipay_public_cert.pem
/etc/buy_web/pay-certs/alipay/app_public_cert.pem
/etc/buy_web/pay-certs/alipay/alipay_root_cert.pem
```

The gateway and Next.js must share the same internal secret:

```env
BUY_WEB_GATEWAY_SECRET="same-value-as-OFFICIAL_PAY_GATEWAY_SECRET"
BUY_WEB_GATEWAY_ENCRYPTION_KEY="same-value-as-OFFICIAL_PAY_GATEWAY_ENCRYPTION_KEY"
```

Generate the encryption key with `openssl rand -base64 32`. The encrypted
envelope is still signed with HMAC-SHA256 over `timestamp.encryptedBody`.

Runtime PHP must be able to read the plaintext private keys. The security
boundary is file permissions, HTTPS, internal AES-GCM, HMAC, upstream signature
verification, minimal public routes, and encrypted backups.

## Public Routes

Expose only these routes publicly:

```text
GET  /official-pay/health
POST /official-pay/notify/wechat/pay
POST /official-pay/notify/wechat/refund
POST /official-pay/notify/alipay/pay
POST /official-pay/notify/alipay/refund
```

Internal routes such as `/payments`, `/payments/query`, `/refunds`, and
`/refunds/query` must only be callable from `127.0.0.1` or another trusted local
network boundary.

## Go-Live Rule

Use `PAYMENT_PROVIDER=official` only with complete WeChat Pay and Alipay merchant
credentials, product permissions, certificates, callback URLs, and small
real-money test orders. A production order should only be considered paid after a
verified callback or active query confirms order number, amount, and upstream
transaction id.
