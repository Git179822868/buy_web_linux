# v1.1.0 Official Payment Gateway

## Summary

This release replaces the old Jeepay deployment path with a lightweight
`official-pay-gateway` based on `yansongda/pay`. The app keeps order ownership in
Next.js and Prisma, while the PHP gateway handles WeChat Pay and Alipay channel
calls, upstream callback verification, and encrypted internal forwarding.

## Key Changes

- Added `official-pay-gateway` for WeChat Native, WeChat H5, Alipay web, and
  Alipay WAP payments.
- Added `PAYMENT_PROVIDER=official`, `OFFICIAL_PAY_GATEWAY_URL`,
  `OFFICIAL_PAY_GATEWAY_SECRET`, `OFFICIAL_PAY_GATEWAY_ENCRYPTION_KEY`, and
  `PAYMENT_RECONCILE_SECRET`.
- Added Prisma enum value `OFFICIAL` while keeping historical `JEEPAY` enum
  values so old rows and migrations remain readable.
- Removed Jeepay API routes, Docker helper script, and the old Jeepay deployment
  guide from the current deployment path.
- Added AES-256-GCM encryption and HMAC-SHA256 signing between Next.js and PHP
  gateway with a 5 minute timestamp window.
- Added `/api/payments/reconcile` so a trusted cron can actively query
  `CREATED/PAYING` official payment records after callback failures.
- Changed upstream outage handling to fail the current payment attempt quickly,
  keep a failed audit record, and let the user create a new payment attempt.
- Updated Baota deployment notes for low-memory servers: create Swap first, do
  not install Docker or Jeepay, keep only SSH/Baota/Nginx/MySQL/PM2 on startup.
- Documented Baota database list behavior, SSL certificate path troubleshooting,
  Nginx test/reload flow, and official payment certificate directory layout.

## Install Flow

1. Keep the site in official mode. Verify registration, login, ordering, admin
   order list, and SSL first; payment attempts will fail closed until merchant
   credentials are configured.
2. Install PHP 8.2+ and Composer in Baota.
3. Run:

   ```bash
   cd /www/wwwroot/buy_web_linux/official-pay-gateway
   composer install --no-dev --optimize-autoloader
   cp config.example.php config.php
   ```

4. Put merchant certificates and private keys outside the website root:

   ```text
   /etc/buy_web/pay-certs
   ```

5. Fill WeChat Pay and Alipay credentials in `config.php` or PHP-FPM
   environment variables.
6. Configure Next.js:

   ```env
   PAYMENT_PROVIDER="official"
   APP_PUBLIC_URL="https://your-domain"
   OFFICIAL_PAY_GATEWAY_URL="http://127.0.0.1:7301"
   OFFICIAL_PAY_GATEWAY_SECRET="long-random-secret"
   OFFICIAL_PAY_GATEWAY_ENCRYPTION_KEY="openssl-rand-base64-32-output"
   PAYMENT_RECONCILE_SECRET="another-long-random-secret"
   ```

7. Expose only `/official-pay/notify/*` and `/official-pay/health` publicly.
   Keep internal payment/refund routes limited to localhost.

## Verification

- `npx prisma validate`
- `npm run db:generate`
- `npm run typecheck`
- `npm run lint`
- `npm run security:scan`
- `npm run build`
- `composer validate`
- `composer install --no-dev --optimize-autoloader`
- `php -l official-pay-gateway/public/index.php`
- `curl https://your-domain/official-pay/health`

For real money validation, run one small order per channel: Alipay web, Alipay
WAP, WeChat Native, WeChat H5. Then verify callback status updates, active query
reconciliation, refund creation, refund query, and refund callback.

## Rollback

Restore the previous release and restart PM2. Do not switch production orders to
a local payment simulator.

```bash
pm2 restart buyweb --update-env
```

Existing official payment records stay in the database for audit. Do not delete
payment rows during rollback.

## References

- yansongda/pay GitHub: https://github.com/yansongda/pay
- yansongda Pay docs: https://pay.yansongda.cn/
- WeChat Pay merchant platform: https://pay.weixin.qq.com/
- Alipay Open Platform: https://open.alipay.com/
