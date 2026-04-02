-- AlterTable
ALTER TABLE `reservations` ADD COLUMN `is_walk_in` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `notes` TEXT NULL,
    MODIFY `status` ENUM('pending', 'confirmed', 'cancelled', 'completed', 'no_show', 'rejected') NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE `restaurants` ADD COLUMN `address` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `tables` ADD COLUMN `status` ENUM('available', 'reserved', 'occupied') NOT NULL DEFAULT 'available';

-- CreateTable
CREATE TABLE `time_slots` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `restaurant_id` INTEGER NOT NULL,
    `slot_time` VARCHAR(191) NOT NULL,
    `capacity` INTEGER NOT NULL DEFAULT 10,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `time_slots` ADD CONSTRAINT `time_slots_restaurant_id_fkey` FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
