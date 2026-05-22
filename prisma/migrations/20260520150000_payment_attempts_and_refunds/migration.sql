ALTER TABLE `orders`
    MODIFY `status` ENUM(
        'PENDING',
        'PAYING',
        'PAID',
        'PAYMENT_FAILED',
        'CANCELLED',
        'FULFILLED',
        'REFUND_PENDING',
        'REFUNDED',
        'CLOSED'
    ) NOT NULL DEFAULT 'PENDING';

ALTER TABLE `payment_records`
    ADD COLUMN `attemptNo` INTEGER NOT NULL DEFAULT 1 AFTER `orderId`,
    MODIFY `status` ENUM(
        'CREATED',
        'PAYING',
        'PAID',
        'FAILED',
        'CLOSED',
        'REFUND_PENDING',
        'REFUNDED'
    ) NOT NULL DEFAULT 'CREATED';

ALTER TABLE `payment_records`
    DROP INDEX `payment_records_mchOrderNo_idx`;

CREATE UNIQUE INDEX `payment_records_mchOrderNo_key` ON `payment_records`(`mchOrderNo`);
CREATE UNIQUE INDEX `payment_records_orderId_attemptNo_key` ON `payment_records`(`orderId`, `attemptNo`);

CREATE TABLE `refund_records` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `paymentRecordId` VARCHAR(191) NOT NULL,
    `provider` ENUM('MOCK', 'JEEPAY') NOT NULL,
    `refundNo` VARCHAR(64) NOT NULL,
    `mchRefundNo` VARCHAR(64) NOT NULL,
    `providerRefundId` VARCHAR(64) NULL,
    `amountCent` INTEGER NOT NULL,
    `currency` VARCHAR(8) NOT NULL DEFAULT 'cny',
    `reason` VARCHAR(255) NOT NULL,
    `status` ENUM('CREATED', 'REFUNDING', 'SUCCESS', 'FAILED', 'CLOSED') NOT NULL DEFAULT 'CREATED',
    `rawRequestJson` JSON NULL,
    `rawResponseJson` JSON NULL,
    `rawNotifyJson` JSON NULL,
    `refundedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `refund_records_refundNo_key`(`refundNo`),
    UNIQUE INDEX `refund_records_mchRefundNo_key`(`mchRefundNo`),
    INDEX `refund_records_orderId_createdAt_idx`(`orderId`, `createdAt`),
    INDEX `refund_records_paymentRecordId_createdAt_idx`(`paymentRecordId`, `createdAt`),
    INDEX `refund_records_provider_providerRefundId_idx`(`provider`, `providerRefundId`),
    INDEX `refund_records_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `refund_records`
    ADD CONSTRAINT `refund_records_orderId_fkey`
        FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `refund_records_paymentRecordId_fkey`
        FOREIGN KEY (`paymentRecordId`) REFERENCES `payment_records`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
