-- AlterTable
ALTER TABLE `reservations` ADD COLUMN `table_id` INTEGER NULL;

-- CreateTable
CREATE TABLE `tables` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `table_number` VARCHAR(191) NOT NULL,
    `capacity` INTEGER NOT NULL,
    `is_available` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `restaurant_id` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `tables` ADD CONSTRAINT `tables_restaurant_id_fkey` FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reservations` ADD CONSTRAINT `reservations_table_id_fkey` FOREIGN KEY (`table_id`) REFERENCES `tables`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
