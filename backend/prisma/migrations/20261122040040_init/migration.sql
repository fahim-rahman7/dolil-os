-- CreateTable
CREATE TABLE `Office` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `address` TEXT NULL,
    `autoNumbering` BOOLEAN NOT NULL DEFAULT false,
    `numberPrefix` VARCHAR(191) NOT NULL DEFAULT 'DOL',
    `nextNumber` INTEGER NOT NULL DEFAULT 1,
    `allowGenericDraft` BOOLEAN NOT NULL DEFAULT true,
    `adminCanManageSettings` BOOLEAN NOT NULL DEFAULT false,
    `adminCanManageUsers` BOOLEAN NOT NULL DEFAULT false,
    `printPageSize` VARCHAR(191) NOT NULL DEFAULT 'A4',
    `printMarginMm` INTEGER NOT NULL DEFAULT 20,
    `printFont` VARCHAR(191) NOT NULL DEFAULT 'Noto Sans Bengali',
    `printHeader` TEXT NULL,
    `printFooter` TEXT NULL,
    `areaConversions` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `officeId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` ENUM('OWNER', 'ADMIN', 'WRITER', 'ASSISTANT', 'ACCOUNTANT') NOT NULL DEFAULT 'WRITER',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_officeId_idx`(`officeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Customer` (
    `id` VARCHAR(191) NOT NULL,
    `officeId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `nid` VARCHAR(191) NULL,
    `fatherName` VARCHAR(191) NULL,
    `motherName` VARCHAR(191) NULL,
    `address` TEXT NULL,
    `notes` TEXT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Customer_officeId_name_idx`(`officeId`, `name`),
    INDEX `Customer_officeId_phone_idx`(`officeId`, `phone`),
    UNIQUE INDEX `Customer_officeId_nid_key`(`officeId`, `nid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Land` (
    `id` VARCHAR(191) NOT NULL,
    `officeId` VARCHAR(191) NOT NULL,
    `district` VARCHAR(191) NOT NULL,
    `upazila` VARCHAR(191) NOT NULL,
    `mouza` VARCHAR(191) NOT NULL,
    `jlNumber` VARCHAR(191) NULL,
    `khatianNumber` VARCHAR(191) NULL,
    `khatianType` VARCHAR(191) NULL,
    `dagNumber` VARCHAR(191) NOT NULL,
    `area` DECIMAL(12, 4) NOT NULL,
    `areaUnit` VARCHAR(191) NOT NULL DEFAULT 'decimal',
    `classification` VARCHAR(191) NULL,
    `ownershipDetails` TEXT NULL,
    `boundaryNorth` VARCHAR(191) NULL,
    `boundarySouth` VARCHAR(191) NULL,
    `boundaryEast` VARCHAR(191) NULL,
    `boundaryWest` VARCHAR(191) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Land_officeId_mouza_dagNumber_idx`(`officeId`, `mouza`, `dagNumber`),
    INDEX `Land_officeId_district_idx`(`officeId`, `district`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DeedTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `officeId` VARCHAR(191) NOT NULL,
    `deedType` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `approvalStatus` ENUM('UNAPPROVED', 'APPROVED') NOT NULL DEFAULT 'UNAPPROVED',
    `approvedById` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DeedTemplate_officeId_deedType_approvalStatus_idx`(`officeId`, `deedType`, `approvalStatus`),
    UNIQUE INDEX `DeedTemplate_officeId_deedType_version_key`(`officeId`, `deedType`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FeeRate` (
    `id` VARCHAR(191) NOT NULL,
    `officeId` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `kind` ENUM('OFFICE', 'STATUTORY') NOT NULL,
    `basis` ENUM('FIXED', 'PERCENT_OF_VALUE', 'PER_AREA_UNIT') NOT NULL,
    `rate` DECIMAL(14, 4) NOT NULL,
    `effectiveFrom` DATETIME(3) NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `verified` BOOLEAN NOT NULL DEFAULT false,
    `approvedBy` VARCHAR(191) NULL,
    `lastVerifiedAt` DATETIME(3) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FeeRate_officeId_label_effectiveFrom_idx`(`officeId`, `label`, `effectiveFrom`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Deed` (
    `id` VARCHAR(191) NOT NULL,
    `officeId` VARCHAR(191) NOT NULL,
    `deedNumber` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `deedType` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'REVIEW', 'READY', 'PRINTED', 'DELIVERED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `executionDate` DATETIME(3) NULL,
    `valuationBasis` ENUM('TOTAL', 'PER_UNIT') NOT NULL DEFAULT 'TOTAL',
    `perUnitRate` DECIMAL(14, 2) NULL,
    `landValue` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `totalArea` DECIMAL(12, 4) NOT NULL DEFAULT 0,
    `areaUnit` VARCHAR(191) NOT NULL DEFAULT 'decimal',
    `agreedFee` DECIMAL(14, 2) NULL,
    `calculatedFees` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `feeLines` JSON NULL,
    `content` JSON NOT NULL,
    `snapshot` JSON NULL,
    `templateId` VARCHAR(191) NULL,
    `templateVersion` INTEGER NULL,
    `checklist` JSON NULL,
    `notes` TEXT NULL,
    `cancelReason` TEXT NULL,
    `printCount` INTEGER NOT NULL DEFAULT 0,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,

    INDEX `Deed_officeId_status_createdAt_idx`(`officeId`, `status`, `createdAt`),
    INDEX `Deed_officeId_deedType_idx`(`officeId`, `deedType`),
    UNIQUE INDEX `Deed_officeId_deedNumber_key`(`officeId`, `deedNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DeedRevision` (
    `id` VARCHAR(191) NOT NULL,
    `deedId` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` JSON NOT NULL,
    `reason` TEXT NULL,
    `editedById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DeedRevision_deedId_version_idx`(`deedId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DeedParty` (
    `id` VARCHAR(191) NOT NULL,
    `deedId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `role` ENUM('BUYER', 'SELLER', 'DONOR', 'RECIPIENT', 'WITNESS', 'REPRESENTATIVE') NOT NULL,

    UNIQUE INDEX `DeedParty_deedId_customerId_role_key`(`deedId`, `customerId`, `role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DeedLand` (
    `id` VARCHAR(191) NOT NULL,
    `deedId` VARCHAR(191) NOT NULL,
    `landId` VARCHAR(191) NOT NULL,
    `share` DECIMAL(12, 4) NULL,

    UNIQUE INDEX `DeedLand_deedId_landId_key`(`deedId`, `landId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` VARCHAR(191) NOT NULL,
    `officeId` VARCHAR(191) NOT NULL,
    `deedId` VARCHAR(191) NOT NULL,
    `type` ENUM('PAYMENT', 'REVERSAL') NOT NULL DEFAULT 'PAYMENT',
    `amount` DECIMAL(14, 2) NOT NULL,
    `method` ENUM('CASH', 'BANK', 'MOBILE') NOT NULL DEFAULT 'CASH',
    `reference` VARCHAR(191) NULL,
    `receiptNo` VARCHAR(191) NOT NULL,
    `paidAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `note` TEXT NULL,
    `reversesId` VARCHAR(191) NULL,
    `receivedById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Payment_reversesId_key`(`reversesId`),
    INDEX `Payment_officeId_paidAt_idx`(`officeId`, `paidAt`),
    INDEX `Payment_deedId_idx`(`deedId`),
    UNIQUE INDEX `Payment_officeId_receiptNo_key`(`officeId`, `receiptNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Document` (
    `id` VARCHAR(191) NOT NULL,
    `officeId` VARCHAR(191) NOT NULL,
    `ownerType` ENUM('CUSTOMER', 'LAND', 'DEED') NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `originalName` VARCHAR(191) NOT NULL,
    `storedName` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `size` INTEGER NOT NULL,
    `uploadedById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Document_officeId_ownerType_ownerId_idx`(`officeId`, `ownerType`, `ownerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `officeId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `entity` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NULL,
    `reason` TEXT NULL,
    `meta` JSON NULL,
    `correlationId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_officeId_entity_entityId_idx`(`officeId`, `entity`, `entityId`),
    INDEX `AuditLog_officeId_createdAt_idx`(`officeId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_officeId_fkey` FOREIGN KEY (`officeId`) REFERENCES `Office`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Customer` ADD CONSTRAINT `Customer_officeId_fkey` FOREIGN KEY (`officeId`) REFERENCES `Office`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Land` ADD CONSTRAINT `Land_officeId_fkey` FOREIGN KEY (`officeId`) REFERENCES `Office`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeedTemplate` ADD CONSTRAINT `DeedTemplate_officeId_fkey` FOREIGN KEY (`officeId`) REFERENCES `Office`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FeeRate` ADD CONSTRAINT `FeeRate_officeId_fkey` FOREIGN KEY (`officeId`) REFERENCES `Office`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Deed` ADD CONSTRAINT `Deed_officeId_fkey` FOREIGN KEY (`officeId`) REFERENCES `Office`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Deed` ADD CONSTRAINT `Deed_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeedRevision` ADD CONSTRAINT `DeedRevision_deedId_fkey` FOREIGN KEY (`deedId`) REFERENCES `Deed`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeedParty` ADD CONSTRAINT `DeedParty_deedId_fkey` FOREIGN KEY (`deedId`) REFERENCES `Deed`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeedParty` ADD CONSTRAINT `DeedParty_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeedLand` ADD CONSTRAINT `DeedLand_deedId_fkey` FOREIGN KEY (`deedId`) REFERENCES `Deed`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeedLand` ADD CONSTRAINT `DeedLand_landId_fkey` FOREIGN KEY (`landId`) REFERENCES `Land`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_officeId_fkey` FOREIGN KEY (`officeId`) REFERENCES `Office`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_deedId_fkey` FOREIGN KEY (`deedId`) REFERENCES `Deed`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_receivedById_fkey` FOREIGN KEY (`receivedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_reversesId_fkey` FOREIGN KEY (`reversesId`) REFERENCES `Payment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Document` ADD CONSTRAINT `Document_officeId_fkey` FOREIGN KEY (`officeId`) REFERENCES `Office`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Document` ADD CONSTRAINT `Document_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_officeId_fkey` FOREIGN KEY (`officeId`) REFERENCES `Office`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
