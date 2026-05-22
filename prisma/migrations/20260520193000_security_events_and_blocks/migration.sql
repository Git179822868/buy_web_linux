CREATE TABLE `security_events` (
    `id` VARCHAR(191) NOT NULL,
    `eventType` VARCHAR(64) NOT NULL,
    `scope` VARCHAR(32) NOT NULL,
    `identifier` VARCHAR(191) NOT NULL,
    `ip` VARCHAR(64) NULL,
    `subjectType` VARCHAR(32) NULL,
    `subjectId` VARCHAR(191) NULL,
    `path` VARCHAR(255) NULL,
    `method` VARCHAR(12) NULL,
    `detailJson` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `security_events_eventType_scope_identifier_createdAt_idx`(`eventType`, `scope`, `identifier`, `createdAt`),
    INDEX `security_events_ip_createdAt_idx`(`ip`, `createdAt`),
    INDEX `security_events_subjectType_subjectId_createdAt_idx`(`subjectType`, `subjectId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `security_blocks` (
    `id` VARCHAR(191) NOT NULL,
    `scope` VARCHAR(32) NOT NULL,
    `identifier` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(255) NOT NULL,
    `expiresAt` DATETIME(3) NULL,
    `createdBy` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `security_blocks_scope_identifier_key`(`scope`, `identifier`),
    INDEX `security_blocks_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
