-- CreateTable
CREATE TABLE `data_trip` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `id_alat` VARCHAR(50) NULL,
    `trip` VARCHAR(100) NULL,
    `tanggal` VARCHAR(50) NULL,
    `lokasi_start` VARCHAR(100) NULL,
    `lokasi_finish` VARCHAR(100) NULL,
    `nama_operator` VARCHAR(255) NULL,
    `id_operator` VARCHAR(50) NULL,
    `jenis_muatan` VARCHAR(100) NULL,
    `waktu_start` VARCHAR(50) NULL,
    `waktu_finish` VARCHAR(50) NULL,
    `durasi` VARCHAR(50) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
