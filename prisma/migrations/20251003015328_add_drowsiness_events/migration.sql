-- CreateTable
CREATE TABLE `devices` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `vehicle_id` VARCHAR(191) NOT NULL,
    `model` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `devices_vehicle_id_key`(`vehicle_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `device_calibrations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `device_id` INTEGER NOT NULL,
    `mag_offset_x` DOUBLE NULL,
    `mag_offset_y` DOUBLE NULL,
    `mag_offset_z` DOUBLE NULL,
    `mag_scale_x` DOUBLE NULL,
    `mag_scale_y` DOUBLE NULL,
    `mag_scale_z` DOUBLE NULL,
    `mpu_ax_offset` DOUBLE NULL,
    `mpu_ay_offset` DOUBLE NULL,
    `mpu_az_offset` DOUBLE NULL,
    `mpu_gx_offset` DOUBLE NULL,
    `mpu_gy_offset` DOUBLE NULL,
    `mpu_gz_offset` DOUBLE NULL,
    `calibrated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `device_calibrations_device_id_key`(`device_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `drowsiness_events` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `event_time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `event_type` VARCHAR(191) NOT NULL,
    `image_path` VARCHAR(191) NOT NULL,
    `device_id` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `device_calibrations` ADD CONSTRAINT `device_calibrations_device_id_fkey` FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `drowsiness_events` ADD CONSTRAINT `drowsiness_events_device_id_fkey` FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `users` RENAME INDEX `email` TO `users_email_key`;
