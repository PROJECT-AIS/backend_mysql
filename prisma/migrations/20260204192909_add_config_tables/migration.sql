-- CreateTable
CREATE TABLE `alat` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `id_fms` VARCHAR(50) NOT NULL,
    `no_plat` VARCHAR(20) NOT NULL,
    `jenis_alat` VARCHAR(100) NOT NULL,
    `detail_alat` TEXT NULL,
    `gambar` VARCHAR(500) NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'Aktif',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `alat_id_fms_key`(`id_fms`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `operator` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nama` VARCHAR(255) NOT NULL,
    `no_telp` VARCHAR(20) NULL,
    `divisi` VARCHAR(100) NULL,
    `id_card_nfc` VARCHAR(100) NULL,
    `jabatan` VARCHAR(100) NULL,
    `alamat` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lokasi` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nama` VARCHAR(255) NOT NULL,
    `jenis_lokasi` VARCHAR(100) NULL,
    `latitude` VARCHAR(50) NOT NULL,
    `longitude` VARCHAR(50) NOT NULL,
    `radius` INTEGER NOT NULL DEFAULT 0,
    `deskripsi` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kalibrasi` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `alat_id` INTEGER NOT NULL,
    `empty` INTEGER NOT NULL DEFAULT 0,
    `full` INTEGER NOT NULL DEFAULT 1023,
    `kapasitas_tangki` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pengawas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nama` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `no_telp` VARCHAR(20) NULL,
    `foto_profil` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `pengawas_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `kalibrasi` ADD CONSTRAINT `kalibrasi_alat_id_fkey` FOREIGN KEY (`alat_id`) REFERENCES `alat`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
