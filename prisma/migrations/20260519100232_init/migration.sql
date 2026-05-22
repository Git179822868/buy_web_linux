-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `userNo` INTEGER NOT NULL AUTO_INCREMENT,
    `phone` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `nickname` VARCHAR(191) NULL,
    `avatarUrl` VARCHAR(255) NULL,
    `balanceCent` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_userNo_key`(`userNo`),
    UNIQUE INDEX `users_phone_key`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service_packages` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(512) NOT NULL,
    `category` VARCHAR(64) NOT NULL DEFAULT 'account_follow',
    `categoryLabel` VARCHAR(64) NOT NULL DEFAULT '账号关注',
    `filterKey` VARCHAR(64) NOT NULL DEFAULT 'normal',
    `filterLabel` VARCHAR(64) NOT NULL DEFAULT '普通粉丝',
    `platformCode` VARCHAR(16) NOT NULL DEFAULT 'BD',
    `imageUrl` VARCHAR(255) NOT NULL DEFAULT '/assets/package-thumb.png',
    `unit` VARCHAR(24) NOT NULL DEFAULT '个',
    `productType` ENUM('NORMAL', 'API') NOT NULL DEFAULT 'NORMAL',
    `priceTemplate` VARCHAR(80) NULL,
    `baseQuantity` INTEGER NOT NULL DEFAULT 1,
    `minQuantity` INTEGER NOT NULL DEFAULT 1,
    `maxQuantity` INTEGER NOT NULL DEFAULT 1000000,
    `allowRepeat` BOOLEAN NOT NULL DEFAULT true,
    `deliveryTime` VARCHAR(80) NOT NULL DEFAULT '24-72小时',
    `completionRate` INTEGER NOT NULL DEFAULT 95,
    `priceCent` INTEGER NOT NULL,
    `currency` VARCHAR(8) NOT NULL DEFAULT 'cny',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `service_packages_slug_key`(`slug`),
    INDEX `service_packages_category_filterKey_idx`(`category`, `filterKey`),
    INDEX `service_packages_isActive_sortOrder_idx`(`isActive`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `orders` (
    `id` VARCHAR(191) NOT NULL,
    `orderNo` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `packageId` VARCHAR(191) NOT NULL,
    `targetAccount` VARCHAR(255) NOT NULL,
    `orderQuantity` INTEGER NOT NULL DEFAULT 1,
    `initialQuantity` INTEGER NULL,
    `currentQuantity` INTEGER NULL,
    `completedQuantity` INTEGER NOT NULL DEFAULT 0,
    `refundQuantity` INTEGER NOT NULL DEFAULT 0,
    `refundAmountCent` INTEGER NOT NULL DEFAULT 0,
    `amountCent` INTEGER NOT NULL,
    `currency` VARCHAR(8) NOT NULL DEFAULT 'cny',
    `status` ENUM('PENDING', 'PAYING', 'PAID', 'PAYMENT_FAILED', 'CANCELLED', 'FULFILLED', 'REFUNDED', 'CLOSED') NOT NULL DEFAULT 'PENDING',
    `remark` VARCHAR(512) NULL,
    `adminRemark` VARCHAR(512) NULL,
    `executedAt` DATETIME(3) NULL,
    `paidAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `orders_orderNo_key`(`orderNo`),
    INDEX `orders_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `orders_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_records` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `provider` ENUM('MOCK', 'JEEPAY') NOT NULL,
    `providerOrderId` VARCHAR(64) NULL,
    `mchOrderNo` VARCHAR(64) NOT NULL,
    `amountCent` INTEGER NOT NULL,
    `currency` VARCHAR(8) NOT NULL DEFAULT 'cny',
    `wayCode` VARCHAR(32) NOT NULL,
    `payDataType` VARCHAR(32) NULL,
    `payData` TEXT NULL,
    `status` ENUM('CREATED', 'PAYING', 'PAID', 'FAILED', 'CLOSED', 'REFUNDED') NOT NULL DEFAULT 'CREATED',
    `rawRequestJson` JSON NULL,
    `rawResponseJson` JSON NULL,
    `rawNotifyJson` JSON NULL,
    `paidAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `payment_records_mchOrderNo_idx`(`mchOrderNo`),
    INDEX `payment_records_provider_providerOrderId_idx`(`provider`, `providerOrderId`),
    INDEX `payment_records_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_users` (
    `id` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'STAFF') NOT NULL DEFAULT 'STAFF',
    `name` VARCHAR(80) NULL,
    `phone` VARCHAR(20) NULL,
    `avatarUrl` VARCHAR(255) NULL,
    `bio` VARCHAR(512) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `admin_users_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `adminUserId` VARCHAR(191) NULL,
    `action` VARCHAR(100) NOT NULL,
    `targetType` VARCHAR(64) NOT NULL,
    `targetId` VARCHAR(64) NULL,
    `detailJson` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_adminUserId_createdAt_idx`(`adminUserId`, `createdAt`),
    INDEX `audit_logs_targetType_targetId_idx`(`targetType`, `targetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `site_settings` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `siteName` VARCHAR(120) NOT NULL DEFAULT '账号关注投放商城',
    `operator` VARCHAR(120) NULL,
    `icpNo` VARCHAR(80) NULL,
    `copyright` VARCHAR(160) NULL,
    `keywords` VARCHAR(255) NULL,
    `description` VARCHAR(512) NULL,
    `logoUrl` VARCHAR(255) NULL,
    `icoUrl` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contact_settings` (
    `id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(32) NOT NULL,
    `label` VARCHAR(80) NOT NULL,
    `value` VARCHAR(255) NULL,
    `qrUrl` VARCHAR(255) NULL,
    `isEnabled` BOOLEAN NOT NULL DEFAULT false,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `contact_settings_isEnabled_sortOrder_idx`(`isEnabled`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `balance_ledgers` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` ENUM('RECHARGE', 'PURCHASE', 'REFUND', 'ADJUSTMENT') NOT NULL,
    `amountCent` INTEGER NOT NULL,
    `balanceAfterCent` INTEGER NOT NULL,
    `relatedOrderId` VARCHAR(191) NULL,
    `remark` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `balance_ledgers_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `balance_ledgers_type_createdAt_idx`(`type`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_packageId_fkey` FOREIGN KEY (`packageId`) REFERENCES `service_packages`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_records` ADD CONSTRAINT `payment_records_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_adminUserId_fkey` FOREIGN KEY (`adminUserId`) REFERENCES `admin_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `balance_ledgers` ADD CONSTRAINT `balance_ledgers_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
