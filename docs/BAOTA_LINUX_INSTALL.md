# Linux / 宝塔新手部署指南

本文面向第一次部署的新手，目标是在一台新的 Linux 服务器上用宝塔面板运行本项目。

官方资料：

- 宝塔快速安装文档：<https://docs.bt.cn/getting-started/quick-installation-of-bt-panel>
- 宝塔基础环境安装文档：<https://docs.bt.cn/getting-started/install-basic-environment>
- 宝塔下载页：<https://www.bt.cn/new/download>

## 1. 准备服务器

推荐系统：

- 新手优先：Debian 12
- 也可以：Ubuntu 22.04 / Ubuntu 24.04

服务器最低建议：

- CPU：2 核
- 内存：2 GB 起步，生产建议 4 GB+
- 磁盘：40 GB 起步，备份多时建议更大
- 架构：x86_64

安全组或防火墙先开放：

- `22`：SSH
- `80`：HTTP
- `443`：HTTPS
- `8888`：宝塔面板首次访问端口，安装完成后建议在宝塔里修改面板端口

不要开放：

- `3000`：Next.js 只给 Nginx 本机反代访问
- `3306`：MySQL 不要暴露公网

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

如果用 SSH 创建，可参考：

```sql
CREATE DATABASE buyweb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'buyweb'@'127.0.0.1' IDENTIFIED BY '替换为强密码';
GRANT ALL PRIVILEGES ON buyweb.* TO 'buyweb'@'127.0.0.1';
FLUSH PRIVILEGES;
```

生产更推荐拆分两个账号：

- `buyweb_app`：应用运行账号，只给 `SELECT, INSERT, UPDATE, DELETE`
- `buyweb_migrate`：迁移账号，只在部署时临时用于 `npm run db:deploy`

完整示例见 `docs/mysql-init.sql`。

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

本地或初次测试可以保持：

```env
PAYMENT_PROVIDER="mock"
```

接入 Jeepay 后再改：

```env
PAYMENT_PROVIDER="jeepay"
JEEPAY_GATEWAY_URL="https://你的Jeepay网关"
JEEPAY_MCH_NO="你的商户号"
JEEPAY_APP_ID="你的应用ID"
JEEPAY_APP_SECRET="你的应用密钥"
```

只改这些变量还不够。正式收款前还必须在 Jeepay、微信支付商户平台、支付宝开放平台完成商户、应用、支付产品、证书和回调配置。完整步骤见：

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

如果想手动配置 Nginx，可参考：

```text
docs/examples/nginx-buyweb.conf
```

不要直接复制覆盖宝塔生成的完整配置。建议先在宝塔站点配置里追加反代和限流片段，保存前先备份原配置。

## 11. 配置 HTTPS

宝塔面板路径：

```text
网站 -> 你的站点 -> SSL
```

选择：

- Let's Encrypt
- 或者你的云厂商证书

申请成功后开启：

- 强制 HTTPS
- HTTP/2，如果宝塔当前 Nginx 支持

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
- `AUTH_SECRET` 已换成强随机字符串
- 备份任务已创建并手动测试过
- Jeepay 回调地址配置为 `{APP_PUBLIC_URL}/api/payments/jeepay/notify`

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

### 修改 `.env` 后不生效

PM2 需要带 `--update-env` 重启：

```bash
pm2 restart buyweb --update-env
```

### 宝塔面板打不开

检查云服务器安全组和系统防火墙是否放行面板端口。也可以在 SSH 里使用宝塔 `bt` 命令查看面板信息或修复面板。
