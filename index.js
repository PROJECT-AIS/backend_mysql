const express = require("express");
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const router = require('./routes');

console.log("--> [START] Memuat express-backend/index.js...");

const app = express();

// CORS configuration - allow all origins for development
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json()); // Menggunakan parser bawaan
app.use(express.urlencoded({ extended: true }));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log(`--> [UPLOADS] Created uploads directory: ${uploadsDir}`);
}

// Serve static files from uploads directory
app.use('/uploads', express.static(uploadsDir));
console.log(`--> [STATIC] Serving static files from /uploads`);

const port = 3000;

app.use((req, res, next) => {
    console.log(`[REQUEST RECEIVED] Method: ${req.method}, Path: ${req.originalUrl}`);
    next();
});

app.get('/', (req, res) => {
    res.send("Hello World!");
});

app.use('/api', router); // Menggunakan router eksternal

app.listen(port, () => {
    console.log(`Server start on port ${port}`);
});

console.log("--> [FINISH] express-backend/index.js berhasil dimuat.");
