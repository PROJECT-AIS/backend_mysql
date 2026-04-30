/*
  Warnings:

  - You are about to drop the column `model` on the `devices` table. All the data in the column will be lost.
  - You are about to drop the `device_calibrations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `drowsiness_events` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[device_id]` on the table `devices` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE `device_calibrations` DROP FOREIGN KEY `device_calibrations_device_id_fkey`;

-- DropForeignKey
ALTER TABLE `drowsiness_events` DROP FOREIGN KEY `drowsiness_events_device_id_fkey`;

-- AlterTable
ALTER TABLE `devices` DROP COLUMN `model`,
    ADD COLUMN `device_id` VARCHAR(191) NULL;

-- DropTable
DROP TABLE `device_calibrations`;

-- DropTable
DROP TABLE `drowsiness_events`;

-- CreateTable
CREATE TABLE `operators` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(128) NOT NULL,
    `position` VARCHAR(64) NULL,
    `rfid_vid` VARCHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `operators_rfid_vid_key`(`rfid_vid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shift_code` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nama_shift` VARCHAR(100) NOT NULL,
    `kode_shift` VARCHAR(20) NOT NULL,
    `rentang_waktu` VARCHAR(50) NOT NULL,
    `keterangan` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `shift_code_kode_shift_key`(`kode_shift`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `material_type` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `jenis_muatan` VARCHAR(100) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `material_type_jenis_muatan_key`(`jenis_muatan`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `data_log` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `waktu` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `id_alat` VARCHAR(50) NULL,
    `no_pol` VARCHAR(20) NULL,
    `jenis_alat` VARCHAR(100) NULL,
    `merek_alat` VARCHAR(100) NULL,
    `trip` VARCHAR(100) NULL,
    `latitude` VARCHAR(50) NULL,
    `longitude` VARCHAR(50) NULL,
    `kecepatan_kendaraan` DOUBLE NULL,
    `jenis_muatan` VARCHAR(100) NULL,
    `volume_fuel` DOUBLE NULL,
    `konsumsi_fuel` DOUBLE NULL,
    `anomali_status_fuel` VARCHAR(100) NULL,
    `fuel_masuk` DOUBLE NULL,
    `status_alat` VARCHAR(50) NULL,
    `start` VARCHAR(50) NULL,
    `rentang_waktu_aktif` VARCHAR(50) NULL,
    `durasi_aktif` VARCHAR(50) NULL,
    `rentang_waktu_passif` VARCHAR(50) NULL,
    `durasi_passif` VARCHAR(50) NULL,
    `mati` VARCHAR(50) NULL,
    `nama_operator` VARCHAR(255) NULL,
    `id_operator` VARCHAR(50) NULL,
    `status_trip` VARCHAR(50) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `devices_device_id_key` ON `devices`(`device_id`);
