# 腾讯云轻量灯塔 / 宝塔 Linux 新手部署指南

本文面向第一次部署的新手，目标是在腾讯云轻量应用服务器（Lighthouse，常被叫作轻量/灯塔）或同类 Linux VPS 上，用宝塔面板运行本项目。

本文里的“自动申领”按 Nginx + SSL 证书自动申请和续签处理。SSH 只用于登录服务器，不需要证书申领；如果你要的是 GitHub SSH 拉代码，建议后续单独配置部署密钥。

官方资料：

- 宝塔快速安装文档：<https://docs.bt.cn/getting-started/quick-installation-of-bt-panel>
- 宝塔基础环境安装文档：<https://docs.bt.cn/getting-started/install-basic-environment>
- 宝塔下载页：<https://www.bt.cn/new/download>

## 1. 准备腾讯云轻量服务器

推荐系统：

- 新手优先：Debian 12
- 也可以：Ubuntu 22.04 / Ubuntu 24.04

服务器最低建议：

- CPU：2 核
- 内存：2 GB 起步，生产建议 4 GB+
- 磁盘：40 GB 起步，备份多时建议更大
- 架构：x86_64

低配服务器先按保守策略部署：先创建 2G Swap，再安装宝塔、Nginx、MySQL、Node.js 和 PM2。不要安装 Docker、Jeepay、RocketMQ 或 Java 支付中台；允许开机自启的服务只保留 `ssh`、宝塔面板、Nginx、MySQL 和 `pm2-root`。

创建 Swap 示例：

```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
free -h
```

在腾讯云轻量控制台创建实例后，先做三件事：

1. 记录公网 IP。
2. 在域名 DNS 里添加 A 记录，例如 `www.example.com -> 服务器公网 IP`。
3. 在轻量控制台的防火墙/安全组放行必要端口。

安全组或防火墙先开放：

- `22`：SSH
- `80`：HTTP
- `443`：HTTPS
- `8888`：宝塔面板首次访问端口，安装完成后建议在宝塔里修改面板端口，并尽量限制为自己的 IP

不要开放：

- `3000`：Next.js 只给 Nginx 本机反代访问
- `3306`：MySQL 不要暴露公网

域名 DNS 生效后再申请 SSL。Let's Encrypt 的 HTTP 验证需要公网能访问 `80` 端口，证书续签时也要保持 `80` 可用。

宝塔官方建议用干净系统安装，不要在已经装过 Apache、Nginx、MySQL、PHP、Java、GitLab 等复杂环境的服务器上直接装面板。

## 2. 安装宝塔面板

用 SSH 登录服务器：

```bash
ssh root@你的服务器IP
```

在宝塔官网下载页复制最新 Linux 安装命令。当前官方下载页给出的通用命令形式如下，实际部署时以官网最新命令为准：

```bash
if [ -f /usr/bin/curl ]; then curl -sSO https://download.bt.cn/install/install_panel.sh; else wget -O install_panel.sh https://download.bt.cn/install/install_panel.sh; fi; bash install_panel.sh ed8484bec
```

安装完成后终端会显示：

- 面板地址
- 用户名
- 初始密码

登录面板后，先完成安全入口、账号、密码和面板端口设置。

## 3. 在宝塔安装基础环境

进入宝塔面板后，打开左侧：

```text
软件商店 -> 运行环境
```

安装这些组件：

- Nginx
- MySQL 8.0
- Node.js 20.19+、22.13+ 或 24+，新手建议选择当前 LTS，不建议使用 Node 23
- PM2 管理器，或在服务器终端用 `npm install -g pm2`

如果宝塔软件商店里没有合适的 Git 或 MySQL client，在 SSH 里安装：

```bash
apt update
apt install -y git mysql-client
```

检查版本：

```bash
node -v
npm -v
git --version
mysql --version
mysqldump --version
```

本项目建议使用 Node.js `20.19+`、`22.13+` 或 `24+`。不要用 Node 23 做生产部署，因为部分开发依赖不把 23 作为稳定支持线。

## 4. 创建数据库

本项目必须使用独立数据库 `buyweb`：

```text
buyweb      # 本项目使用
```

不要把支付证书、私钥或 PHP 网关配置放进数据库或提交到 GitHub。

### 方法 A：宝塔面板创建

在宝塔面板打开：

```text
数据库 -> MySQL -> 添加数据库
```

建议：

- 数据库名：`buyweb`
- 用户名：`buyweb`
- 密码：使用强密码
- 访问权限：本地服务器
- 字符集：`utf8mb4`

这种方法适合第一次上线。创建完成后，`.env` 可以先使用宝塔生成的数据库账号：

```env
DATABASE_URL="mysql://buyweb:你的数据库密码@127.0.0.1:3306/buyweb"
```

### 方法 B：SSH 命令创建

登录服务器后进入 MySQL：

```bash
mysql -u root -p
```

执行：

```sql
CREATE DATABASE IF NOT EXISTS buyweb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'buyweb'@'127.0.0.1' IDENTIFIED BY '替换为强密码';
GRANT ALL PRIVILEGES ON buyweb.* TO 'buyweb'@'127.0.0.1';
FLUSH PRIVILEGES;
```

### 生产推荐：运行账号和迁移账号拆分

长期生产更推荐拆分两个账号：

- `buyweb_app`：应用运行账号，只给 `SELECT, INSERT, UPDATE, DELETE`
- `buyweb_migrate`：迁移账号，只在部署时临时用于 `npm run db:deploy`

完整示例见 `docs/mysql-init.sql`。

拆分后，日常运行 `.env` 使用运行账号：

```env
DATABASE_URL="mysql://buyweb_app:运行账号强密码@127.0.0.1:3306/buyweb"
```

需要升级数据库结构时，临时用迁移账号执行：

```bash
DATABASE_URL="mysql://buyweb_migrate:迁移账号强密码@127.0.0.1:3306/buyweb" npm run db:deploy
```

迁移完成后重启应用，让 PM2 继续读取 `.env` 里的运行账号。

## 5. 下载项目代码

推荐放到 `/www/wwwroot/buy_web_linux`：

```bash
cd /www/wwwroot
git clone https://github.com/Git179822868/buy_web_linux.git
cd buy_web_linux
```

如果你用宝塔文件管理器上传压缩包，也要确保最终目录是：

```text
/www/wwwroot/buy_web_linux
```

并且目录里能看到：

```text
package.json
prisma
src
scripts
docs
public
```

## 6. 配置环境变量

复制模板：

```bash
cp .env.example .env
nano .env
```

必须修改：

```env
DATABASE_URL="mysql://buyweb:你的数据库密码@127.0.0.1:3306/buyweb"
AUTH_SECRET="替换为至少32位的随机长字符串"
APP_PUBLIC_URL="https://你的域名"
TRUSTED_PROXY_COUNT="1"
```

支付模式固定为官方收款：

```env
PAYMENT_PROVIDER="official"
OFFICIAL_PAY_GATEWAY_URL="http://127.0.0.1:7301"
OFFICIAL_PAY_GATEWAY_SECRET="至少32位随机密钥"
OFFICIAL_PAY_GATEWAY_ENCRYPTION_KEY="openssl rand -base64 32 生成"
OFFICIAL_PAY_GATEWAY_TIMEOUT_MS="10000"
PAYMENT_RECONCILE_SECRET="另一个随机密钥"
```

只改这些变量还不够。正式收款前还必须在微信支付商户平台、支付宝开放平台完成商户、应用、支付产品、证书和回调配置，并部署 `official-pay-gateway`。完整步骤见：

```text
docs/PAYMENT_SETUP.md
```

备份目录建议：

```env
MYSQL_BACKUP_DIR="/var/backups/buyweb"
MYSQL_BACKUP_RETENTION_DAYS="14"
```

生成 `AUTH_SECRET` 的简单方法：

```bash
openssl rand -base64 48
```

`.env` 不能提交到 GitHub，也不要截图发给别人。

## 7. 自动安装依赖并构建

脚本不会创建或覆盖 `.env`，所以先完成上一步。

执行：

```bash
bash scripts/linux-bootstrap.sh
```

脚本会自动做这些事：

- 检查 `node`、`npm`、`git`、`mysql`、`mysqldump`
- 检查 Node.js 版本
- 创建 `public/uploads/contact-qr`
- 执行 `npm ci`
- 执行 `npm run db:generate`
- 执行 `npx prisma validate`
- 执行 `npm run typecheck`
- 执行 `npm run lint`
- 执行 `npm run security:scan`
- 执行 `npm run build`

如果脚本提示缺少命令，先回到宝塔软件商店或 SSH 安装对应依赖。

## 8. 初始化数据库表

首次部署或升级数据库结构时执行：

```bash
npm run db:deploy
```

第一次上线还需要创建默认后台管理员：

```bash
npm run db:seed
```

默认后台账号密码来自 `.env`：

```env
ADMIN_SEED_USERNAME="admin"
ADMIN_SEED_PASSWORD="Admin@123456"
```

上线前请改成强密码，再执行 seed。

## 9. 启动项目

推荐用 PM2：

```bash
npm install -g pm2
bash scripts/linux-pm2-start.sh
pm2 startup
```

`pm2 startup` 会输出一行命令，把它复制执行一次，用于设置开机自启。

常用命令：

```bash
pm2 status
pm2 logs buyweb
pm2 restart buyweb --update-env
pm2 stop buyweb
```

本项目的 `npm run start` 已绑定：

```text
127.0.0.1:3000
```

这表示公网用户不能直接访问 3000 端口，只能通过 Nginx 访问。

## 10. 在宝塔配置网站和反向代理

先确认 PM2 已经启动，并且服务器本机能访问 Next.js：

```bash
curl -I http://127.0.0.1:3000
```

宝塔面板路径：

```text
网站 -> 添加站点
```

填写：

- 域名：你的域名，例如 `www.example.com`
- 根目录：可以选择 `/www/wwwroot/buy_web_linux`
- PHP：纯 Node 项目，不需要 PHP
- 数据库：前面已经创建过，可以不在这里再创建

添加站点后，进入该站点设置：

```text
反向代理 -> 添加反向代理
```

填写：

- 代理名称：`buyweb`
- 目标 URL：`http://127.0.0.1:3000`
- 发送域名：`$host`

保存后访问域名，应该能看到商城首页。

如果腾讯云轻量安全组已经放行 `80`，但域名仍打不开，按顺序检查：

1. 域名 A 记录是否指向当前服务器公网 IP。
2. 宝塔站点域名是否填写完整，例如 `www.example.com`。
3. PM2 进程是否 online。
4. 本机 `curl -I http://127.0.0.1:3000` 是否成功。

如果想手动配置 Nginx，可参考：

```text
docs/examples/nginx-buyweb.conf
```

不要直接复制覆盖宝塔生成的完整配置。建议先在宝塔站点配置里追加反代、限流和安全头片段，保存前先备份原配置。`limit_req_zone` 和 `limit_conn_zone` 必须放在 Nginx 全局 `http {}` 内；站点内只放 `server {}` 里的内容。

## 11. Nginx SSL 自动申请和续签

宝塔面板路径：

```text
网站 -> 你的站点 -> SSL
```

申请前先确认：

- 域名已经解析到这台腾讯云轻量服务器公网 IP。
- 轻量安全组和系统防火墙都放行 `80` 和 `443`。
- 宝塔站点已经绑定这个域名。
- Nginx 能正常代理到 `http://127.0.0.1:3000`。

新手优先选择：

```text
Let's Encrypt -> 文件验证 / HTTP 验证 -> 选择域名 -> 申请
```

宝塔申请成功后会自动写入 Nginx 的 `ssl_certificate` 配置，并通常会创建自动续签任务。不要手动修改证书路径，除非你知道宝塔实际保存证书的位置。

申请成功后开启：

- 强制 HTTPS
- HTTP/2，如果宝塔当前 Nginx 支持
- 自动续签，如果面板提供这个选项

如果自动申请失败，优先检查：

- DNS 是否已经生效，可以在本机执行 `nslookup 你的域名`。
- `80` 端口是否被腾讯云轻量安全组放行。
- 宝塔站点是否绑定了同一个域名。
- 是否提前把 HTTP 全部重定向到错误地址，导致 `/.well-known/acme-challenge/` 验证失败。

使用云厂商证书也可以，但流程变成：在云厂商申请证书，下载 Nginx 格式证书，然后在宝塔 SSL 页面粘贴证书和私钥。

然后把 `.env` 里的 `APP_PUBLIC_URL` 改成 HTTPS 域名：

```env
APP_PUBLIC_URL="https://你的域名"
```

重启应用：

```bash
pm2 restart buyweb --update-env
```

## 12. 配置备份

创建备份目录：

```bash
mkdir -p /var/backups/buyweb
```

如果应用不是 root 运行，给运行用户写权限。不要把备份目录放在网站公开目录下。

先手动测试：

```bash
MYSQL_BACKUP_DIR=/var/backups/buyweb npm run backup:mysql
```

宝塔面板路径：

```text
计划任务 -> 添加任务
```

每日备份任务：

```bash
cd /www/wwwroot/buy_web_linux && MYSQL_BACKUP_DIR=/var/backups/buyweb npm run backup:mysql >> /var/log/buyweb-backup.log 2>&1
```

每周校验任务：

```bash
cd /www/wwwroot/buy_web_linux && MYSQL_BACKUP_DIR=/var/backups/buyweb npm run backup:verify >> /var/log/buyweb-backup-verify.log 2>&1
```

备份脚本会生成：

```text
buyweb-时间.sql
buyweb-时间.sql.sha256
buyweb-时间.sql.restore.md
cleanup-candidates.txt
```

脚本不会自动删除旧备份。`cleanup-candidates.txt` 只列候选文件；清理时一次只删除一个明确文件。

## 13. 上线检查清单

上线前确认：

- `npm run build` 成功
- `npm run db:deploy` 成功
- `npm run db:seed` 已执行，后台能登录
- `pm2 status` 里 `buyweb` 是 online
- 宝塔反向代理目标是 `http://127.0.0.1:3000`
- 服务器安全组没有开放 `3000` 和 `3306`
- `.env` 里的 `APP_PUBLIC_URL` 是真实 HTTPS 域名
- 宝塔 SSL 已申请成功，强制 HTTPS 和自动续签已开启
- `AUTH_SECRET` 已换成强随机字符串
- 备份任务已创建并手动测试过
- 注册、登录、下单、后台订单已验证；未配置真实商户证书前不会把订单标记为已付款
- 如果切换真实收款，`official-pay-gateway` 的 `/official-pay/health` 正常
- 如果切换真实收款，微信/支付宝回调指向 `{APP_PUBLIC_URL}/official-pay/notify/*`
- 如果切换真实收款，`PAYMENT_RECONCILE_SECRET` 和支付补偿定时任务已配置

## 14. 常见问题

### 访问网站是 502

检查应用是否启动：

```bash
pm2 status
pm2 logs buyweb
```

检查本机端口：

```bash
curl -I http://127.0.0.1:3000
```

如果本机访问失败，先解决 Node 应用启动问题；如果本机成功但域名失败，检查宝塔 Nginx 反向代理。

### 数据库连接失败

检查 `.env`：

```bash
cat .env
```

确认：

- `DATABASE_URL` 密码正确
- MySQL 正在运行
- 数据库名是 `buyweb`
- 用户允许从 `127.0.0.1` 连接

测试连接：

```bash
mysql -h 127.0.0.1 -u buyweb -p buyweb
```

### 宝塔数据库页面看不到 buyweb

宝塔页面只显示宝塔自己登记过的数据库。SSH 里手动 `CREATE DATABASE buyweb` 后，MySQL 里已经有库，但宝塔列表可能暂时不显示。

优先用宝塔的：

```text
数据库 -> MySQL -> 同步数据库
```

如果新版宝塔同步后仍不显示，可以在宝塔里点“添加数据库”，填同名 `buyweb` 和同名用户，让面板把它登记进列表。新版宝塔 11.7 的面板数据库列表记录在：

```text
/www/server/panel/data/db/database.db
```

不要手动改这个 SQLite 文件，除非你已经备份并确认字段结构。旧版本文章常提到的 `/www/server/panel/data/default.db` 在新版面板里不一定再负责数据库列表。

### Nginx 提示找不到 SSL 证书

如果报错类似：

```text
cannot load certificate "/etc/letsencrypt/live/你的域名/fullchain.pem"
```

说明 Nginx 配置还指向旧 certbot 路径，但宝塔实际证书通常在：

```text
/www/server/panel/vhost/cert/站点名/fullchain.pem
/www/server/panel/vhost/cert/站点名/privkey.pem
```

在宝塔站点 SSL 页面重新部署证书，或把站点 Nginx 配置里的 `ssl_certificate` 和 `ssl_certificate_key` 改成宝塔实际路径，然后执行：

```bash
nginx -t && systemctl reload nginx
```

### Prisma 报找不到 Linux query engine

不要复制 Windows 的 `node_modules` 或 `.next` 到 Linux。

在 Linux 服务器项目目录执行：

```bash
npm ci
npm run db:generate
npm run build
```

### 端口 3000 被占用

查看占用：

```bash
ss -ltnp | grep 3000
```

如果已有旧进程，用 PM2 管理：

```bash
pm2 status
pm2 restart buyweb --update-env
```

### 上传客服二维码失败

检查目录：

```bash
mkdir -p public/uploads/contact-qr
ls -ld public/uploads public/uploads/contact-qr
```

确认 Node 应用运行用户有写权限。这个目录是运行时数据，发版和备份时要单独保护。

### 备份失败

检查 `mysqldump`：

```bash
mysqldump --version
```

检查备份目录权限：

```bash
ls -ld /var/backups/buyweb
```

手动运行：

```bash
MYSQL_BACKUP_DIR=/var/backups/buyweb npm run backup:mysql
```

### SSL 自动申请失败

先不要改应用代码，按基础链路排查：

```bash
nslookup 你的域名
curl -I http://你的域名
```

确认域名指向当前服务器公网 IP，腾讯云轻量安全组放行 `80/443`，宝塔站点绑定了同一个域名。Let's Encrypt 文件验证期间不要拦截 `/.well-known/acme-challenge/` 路径。

### 修改 `.env` 后不生效

PM2 需要带 `--update-env` 重启：

```bash
pm2 restart buyweb --update-env
```

### 宝塔面板打不开

检查云服务器安全组和系统防火墙是否放行面板端口。也可以在 SSH 里使用宝塔 `bt` 命令查看面板信息或修复面板。
