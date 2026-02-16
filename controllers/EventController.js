// Lokasi: express-backend/controllers/EventController.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const influxWriteApi = require('../db/influxdb_connection');
const { Point } = require('@influxdata/influxdb-client');

const handleImageUpload = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Tidak ada file yang diunggah.' });
        }

        console.log('EventController: Menerima upload...');
        
        const { vehicleId, timestamp, eventType } = req.body;
        const imagePath = req.file.path; // Path file di server

        // 1. Cari device berdasarkan vehicleId menggunakan Prisma
        const device = await prisma.device.findUnique({
            where: { vehicleId: vehicleId },
        });

        if (!device) {
            return res.status(404).json({ success: false, message: `Device dengan ID '${vehicleId}' tidak ditemukan.` });
        }

        // 2. Buat catatan event baru di MySQL menggunakan Prisma
        const newEvent = await prisma.drowsinessEvent.create({
            data: {
                deviceId: device.id, // Gunakan ID numerik dari device
                eventType: eventType || "UNKNOWN", // Contoh: "MENGANTUK", "TIDUR"
                imagePath: imagePath,
                eventTime: timestamp ? new Date(parseInt(timestamp) * 1000) : new Date(),
            }
        });
        console.log(`[Prisma/MySQL] Event untuk ${vehicleId} berhasil disimpan dengan ID: ${newEvent.id}`);

        // 3. Kirim penanda event ke InfluxDB (tidak berubah)
        const eventPoint = new Point('events')
            .tag('vehicleId', vehicleId)
            .stringField('type', eventType || "UNKNOWN")
            .stringField('imagePath', imagePath)
            .timestamp(new Date());
        
        influxWriteApi.writePoint(eventPoint);
        await influxWriteApi.flush();
        console.log(`[InfluxDB] Penanda event untuk ${vehicleId} berhasil dikirim.`);

        // 4. Kirim balasan sukses
        res.status(201).json({
            success: true,
            message: 'Event berhasil dicatat!',
            data: newEvent
        });

    } catch (error) {
        console.error("Error di EventController:", error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan internal di server.' });
    }
};

module.exports = {
    handleImageUpload
};
