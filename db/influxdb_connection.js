// Lokasi: express-backend/db/influxdb_connection.js

const { InfluxDB } = require('@influxdata/influxdb-client');
const { getInfluxConfig } = require('./influxConfig');

console.log("--> Memuat koneksi InfluxDB...");

// Ambil konfigurasi dari environment variables
const { url, token, org, bucket } = getInfluxConfig();

// Buat instance InfluxDB client (dengan timeout lebih panjang: 30 detik)
const influxDB = new InfluxDB({ url, token, timeout: 30000 });

// Buat instance Write API dengan opsi retry dan buffer yang lebih baik
const writeApi = influxDB.getWriteApi(org, bucket, 'ns', {
    flushInterval: 5000,
    maxRetries: 3,
    maxBufferLines: 10000
}); // 'ns' adalah presisi nanosecond

console.log("--> InfluxDB Write API berhasil dibuat.");

module.exports = writeApi;
