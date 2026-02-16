// Lokasi: express-backend/db/influxdb_connection.js

const { InfluxDB } = require('@influxdata/influxdb-client');

console.log("--> Memuat koneksi InfluxDB...");

// Ambil konfigurasi dari environment variables
const url = `http://${process.env.INFLUXDB_HOST || 'influxdb'}:8086`;
const token = process.env.INFLUXDB_TOKEN;
const org = process.env.INFLUXDB_ORG;
const bucket = process.env.INFLUXDB_BUCKET;

// Buat instance InfluxDB client
const influxDB = new InfluxDB({ url, token });

// Buat instance Write API
const writeApi = influxDB.getWriteApi(org, bucket, 'ns'); // 'ns' adalah presisi nanosecond

console.log("--> InfluxDB Write API berhasil dibuat.");

module.exports = writeApi;
