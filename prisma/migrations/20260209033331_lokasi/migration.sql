/*
  Warnings:

  - You are about to drop the column `deskripsi` on the `lokasi` table. All the data in the column will be lost.
  - You are about to drop the column `jenis_lokasi` on the `lokasi` table. All the data in the column will be lost.
  - You are about to drop the column `nama` on the `lokasi` table. All the data in the column will be lost.
  - Added the required column `name` to the `lokasi` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `lokasi` DROP COLUMN `deskripsi`,
    DROP COLUMN `jenis_lokasi`,
    DROP COLUMN `nama`,
    ADD COLUMN `name` VARCHAR(255) NOT NULL,
    ADD COLUMN `type` VARCHAR(50) NULL;
