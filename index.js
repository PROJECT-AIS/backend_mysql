const express = require("express")
const cors = require('cors')
const bodyParser = require('body-parser')
const path = require('path')
const fs = require('fs')
const router = require('./routes')

const app = express()

// CORS configuration - allow all origins for development
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}))
app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads')
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true })
}

// Serve static files from uploads directory
app.use('/uploads', express.static(uploadsDir))

const port = 6969;

app.get('/', (req, res) => {
    res.send("Hello World!")
})

app.use('/api', router)

app.listen(port, () => {
    console.log(`Server start on port ${port}`)
})