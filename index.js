require("dotenv").config()

const express = require("express")
const cors = require('cors')
const bodyParser = require('body-parser')
const path = require('path')
const fs = require('fs')
const router = require('./routes')

const app = express()

// CORS configuration
app.use(cors({
    origin: function (origin, callback) {
        // Allow no origin (like mobile apps or curl) or specific origins
        if (!origin || [
            'https://fms.devraffi.my.id',
            'http://fms.devraffi.my.id',
            'http://localhost:5173',
            'http://127.0.0.1:5173'
        ].indexOf(origin) !== -1 || origin.includes('localhost')) {
            callback(null, true)
        } else {
            callback(new Error('Not allowed by CORS'))
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    maxAge: 86400 // Cache preflight for 24 hours
}))

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads')
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true })
}

// Serve static files from uploads directory
app.use('/uploads', express.static(uploadsDir))

const port = Number(process.env.PORT) || 6969;

app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.originalUrl}`);
    next();
});

app.get('/', (req, res) => {
    res.send("Hello World!")
})

app.use('/api', router)

app.listen(port, () => {
    console.log(`Server start on port ${port}`)
})
