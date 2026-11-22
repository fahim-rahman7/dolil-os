-- AlterTable
ALTER TABLE `customer` ADD COLUMN `birthDate` DATE NULL,
    ADD COLUMN `husbandName` VARCHAR(191) NULL,
    ADD COLUMN `nationality` VARCHAR(191) NULL,
    ADD COLUMN `permanentAddress` TEXT NULL,
    ADD COLUMN `profession` VARCHAR(191) NULL,
    ADD COLUMN `religion` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `deed` ADD COLUMN `details` JSON NULL;

-- AlterTable
ALTER TABLE `land` ADD COLUMN `holdingNo` VARCHAR(191) NULL,
    ADD COLUMN `landOffice` VARCHAR(191) NULL,
    ADD COLUMN `union` VARCHAR(191) NULL;
