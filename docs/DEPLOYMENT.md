# 部署说明

## 最小部署拓扑

```text
Nginx
  /              -> Next.js app :3000
  /api           -> Next.js app :3000

pay.example.com  -> Jeepay 支付网关

MySQL 8
  buyweb
  jeepaydb
```

第一版可以只让公网访问：

```text
www.example.com       账号关注投放商城
pay.example.com       Jeepay 收银台 / 支付网关
```

Jeepay 的运营平台、商户平台可以只放内网或限制 IP 访问。

## Windows 无 Docker 本地测试

1. 安装 MySQL 8。
2. 用 MySQL Workbench、DBeaver 或命令行创建 `buyweb` 数据库。
3. 配置 `.env`。
4. 执行：

```powershell
npm run db:migrate
npm run db:seed
npm run dev
```

默认后台地址：

```text
http://localhost:3000/admin/login
```

默认 seed 管理员由 `.env` 控制：

```env
ADMIN_SEED_USERNAME="admin"
ADMIN_SEED_PASSWORD="Admin@123456"
```

本地测试支付时保持：

```env
PAYMENT_PROVIDER="mock"
```

这样不需要先部署 Jeepay，也能完整测试注册、登录、下单、模拟支付、后台查单。

## 后台与数据库范围

当前后台只保留正式售卖需要的模块：

```text
控制台
账号信息
网站设置
商品管理
用户管理
订单列表
财务明细
```

数据库由 Prisma 管理，核心表包括：

```text
users
service_packages
orders
payment_records
admin_users
audit_logs
security_events
security_blocks
site_settings
contact_settings
balance_ledgers
```

不再设计分站、VIP/会员等级、邀请码、密价、流量领取等表和页面。

## Linux 云服务器部署

安装基础环境：

```bash
apt update
apt install -y nginx mysql-server
```

Node 建议使用当前 LTS 版本。部署代码后执行：

```bash
npm ci
npm run db:generate
npm run db:deploy
npm run db:seed
npm run build
npm run start
```

生产建议用 PM2 或 systemd 托管：

```bash
npm install -g pm2
pm2 start npm --name buyweb -- run start
pm2 save
pm2 startup
```

`npm run start` 已绑定 `127.0.0.1:3000`，生产只让 Nginx 暴露公网端口。不要把 Node.js 或 MySQL 端口直接暴露到公网。

Nginx 示例。`limit_req_zone` 和 `limit_conn_zone` 放在 `http {}` 内，`server {}` 放在站点配置内：

```nginx
limit_req_zone $binary_remote_addr zone=buyweb_api:10m rate=3r/s;
limit_req_zone $binary_remote_addr zone=buyweb_auth:10m rate=10r/m;
limit_req_zone $binary_remote_addr zone=buyweb_pay:10m rate=1r/s;
limit_conn_zone $binary_remote_addr zone=buyweb_conn:10m;

server {
    listen 80;
    server_name www.example.com;

    client_max_body_size 1m;
    client_body_timeout 10s;
    keepalive_timeout 20s;
    send_timeout 20s;
    limit_conn buyweb_conn 30;

    location ^~ /api/auth/ {
        limit_req zone=buyweb_auth burst=5 nodelay;
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location ~ ^/api/(orders|payments|refunds) {
        limit_req zone=buyweb_pay burst=10 nodelay;
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location ^~ /api/ {
        limit_req zone=buyweb_api burst=20 nodelay;
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

HTTPS 推荐使用云厂商证书或 certbot。

## MySQL 安全

生产建议拆分运行账号和迁移账号：

```sql
CREATE USER 'buyweb_app'@'127.0.0.1' IDENTIFIED BY 'replace_runtime_password';
GRANT SELECT, INSERT, UPDATE, DELETE ON buyweb.* TO 'buyweb_app'@'127.0.0.1';

CREATE USER 'buyweb_migrate'@'127.0.0.1' IDENTIFIED BY 'replace_migration_password';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, REFERENCES ON buyweb.* TO 'buyweb_migrate'@'127.0.0.1';

FLUSH PRIVILEGES;
```

运行时 `.env` 使用 `buyweb_app`。部署迁移时临时使用 `buyweb_migrate` 执行 `npm run db:deploy`，执行完成后切回运行账号。

MySQL 只监听本机：

```ini
[mysqld]
bind-address = 127.0.0.1
```

服务器安全组或防火墙只开放 `80/443`。不要开放 `3306`。

## 备份与恢复

开启 binlog，保留至少 14 天，用于从每日全量备份恢复到攻击前时间点：

```ini
[mysqld]
server-id = 1
log_bin = mysql-bin
binlog_format = ROW
binlog_expire_logs_seconds = 1209600
```

每天凌晨执行全量备份：

```bash
MYSQL_BACKUP_DIR=/var/backups/buyweb npm run backup:mysql
```

cron 示例：

```cron
15 3 * * * cd /srv/buy_web && /usr/bin/npm run backup:mysql >> /var/log/buyweb-backup.log 2>&1
30 4 * * 0 cd /srv/buy_web && /usr/bin/npm run backup:verify >> /var/log/buyweb-backup-verify.log 2>&1
```

`backup:mysql` 会生成：

```text
buyweb-时间.sql
buyweb-时间.sql.sha256
buyweb-时间.sql.restore.md
cleanup-candidates.txt
```

脚本不会批量删除旧备份。`cleanup-candidates.txt` 只列出候选文件，清理时必须人工确认并一次删除一个明确路径的文件。

恢复演练：

1. 创建临时库，例如 `buyweb_restore_test`。
2. 设置 `MYSQL_VERIFY_DATABASE_URL` 指向临时库。
3. 执行 `npm run backup:verify`。
4. 检查输出中的核心表行数。

时间点恢复流程：

1. 先恢复最近一次全量 `.sql` 到临时库。
2. 使用 `mysqlbinlog --stop-datetime="YYYY-MM-DD HH:MM:SS"` 回放 binlog 到攻击发生前。
3. 校验订单、支付记录、用户余额和后台设置。
4. 确认无误后再切换生产数据库或按表回补。

## 应急开关

出现注册攻击、下单刷接口或支付异常时，可以先用环境变量降损：

```env
REGISTRATION_DISABLED="true"
ORDER_WRITE_DISABLED="true"
PAYMENT_WRITE_DISABLED="true"
```

修改后重启 Node.js 服务。开关只暂停对应写入能力，后台查看、订单读取和数据库恢复仍可进行。

## 上线检查

- `AUTH_SECRET` 已换成长随机字符串。
- `ADMIN_SEED_PASSWORD` 已换成强密码。
- `TRUSTED_PROXY_COUNT=1`，且 Nginx 使用 `$remote_addr` 设置 `X-Real-IP` 和 `X-Forwarded-For`。
- `PAYMENT_PROVIDER=jeepay`。
- `APP_PUBLIC_URL` 是公网 HTTPS 域名。
- Jeepay 商户应用已配置通道参数。
- Jeepay 能访问 `{APP_PUBLIC_URL}/api/payments/jeepay/notify`。
- MySQL 已绑定 `127.0.0.1`，运行账号没有 DDL 权限。
- MySQL 已配置每日备份和 binlog。
- 已执行 `npm run security:scan`、`npm run typecheck`、`npm run lint`、`npm run build`。
- Nginx 只暴露 80/443。
