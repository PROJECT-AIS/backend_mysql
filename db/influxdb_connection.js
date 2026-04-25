// Lokasi: express-backend/db/influxdb_connection.js

const { InfluxDB } = require('@influxdata/influxdb-client');
const { getInfluxConfig } = require('./influxConfig');

console.log("--> Memuat koneksi InfluxDB...");

// Ambil konfigurasi dari environment variables
const { url, token, org, bucket } = getInfluxConfig();

// Buat instance InfluxDB client
const influxDB = new InfluxDB({ url, token });

// Buat instance Write API
const writeApi = influxDB.getWriteApi(org, bucket, 'ns'); // 'ns' adalah presisi nanosecond

console.log("--> InfluxDB Write API berhasil dibuat.");

module.exports = writeApi;
