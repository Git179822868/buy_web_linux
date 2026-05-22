CREATE USER 'buyweb'@'localhost' IDENTIFIED BY 'buyweb_dev';
CREATE DATABASE buyweb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON buyweb.* TO 'buyweb'@'localhost';
FLUSH PRIVILEGES;

-- Production permission split example. Replace passwords before use.
-- The app user is used by DATABASE_URL at runtime.
CREATE USER 'buyweb_app'@'127.0.0.1' IDENTIFIED BY 'replace_runtime_password';
GRANT SELECT, INSERT, UPDATE, DELETE ON buyweb.* TO 'buyweb_app'@'127.0.0.1';

-- The migration user is used only for `npm run db:deploy`.
CREATE USER 'buyweb_migrate'@'127.0.0.1' IDENTIFIED BY 'replace_migration_password';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, REFERENCES ON buyweb.* TO 'buyweb_migrate'@'127.0.0.1';

FLUSH PRIVILEGES;
