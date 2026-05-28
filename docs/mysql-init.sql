-- Run as a MySQL administrator, for example:
--   mysql -u root -p < docs/mysql-init.sql
--
-- Development/simple deployment user. Replace this password before use.
-- If a user already exists, CREATE USER IF NOT EXISTS will not change its password;
-- use ALTER USER manually when rotating credentials.
CREATE DATABASE IF NOT EXISTS buyweb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'buyweb'@'localhost' IDENTIFIED BY 'buyweb_dev';
CREATE USER IF NOT EXISTS 'buyweb'@'127.0.0.1' IDENTIFIED BY 'buyweb_dev';
GRANT ALL PRIVILEGES ON buyweb.* TO 'buyweb'@'localhost';
GRANT ALL PRIVILEGES ON buyweb.* TO 'buyweb'@'127.0.0.1';
FLUSH PRIVILEGES;

-- Production permission split example. Replace passwords before use.
-- The app user is used by DATABASE_URL at runtime.
CREATE USER IF NOT EXISTS 'buyweb_app'@'127.0.0.1' IDENTIFIED BY 'replace_runtime_password';
GRANT SELECT, INSERT, UPDATE, DELETE ON buyweb.* TO 'buyweb_app'@'127.0.0.1';

-- The migration user is used only for `npm run db:deploy`.
CREATE USER IF NOT EXISTS 'buyweb_migrate'@'127.0.0.1' IDENTIFIED BY 'replace_migration_password';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, REFERENCES ON buyweb.* TO 'buyweb_migrate'@'127.0.0.1';

FLUSH PRIVILEGES;
