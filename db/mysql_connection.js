// Lokasi: express-backend/db/mysql_connection.js

const mysql = require('mysql2/promise');

console.log("--> Memuat koneksi MySQL...");

// Membuat connection pool. Ini jauh lebih efisien daripada membuat koneksi baru setiap kali.
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'mysql', // Ambil dari .env, jika tidak ada, gunakan 'mysql'
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'aispassword',
    database: process.env.DB_DATABASE || 'db_mysql_ais',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

console.log("--> Koneksi MySQL Pool berhasil dibuat.");

module.exports = pool;
