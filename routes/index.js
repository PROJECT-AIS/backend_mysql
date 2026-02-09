const express = require('express')
const multer = require('multer')
const path = require('path')
const router = express.Router();
const registerController = require('../controllers/RegisterController')
const loginController = require('../controllers/LoginController')
const userController = require('../controllers/UserController')
const configController = require('../controllers/ConfigController')
const { validateRegister, validateLogin } = require('../utils/validators/auth')
const verifyToken = require('../middlewares/auth')

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, 'upload-' + uniqueSuffix + path.extname(file.originalname))
    }
})

const fileFilter = (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
        cb(null, true)
    } else {
        cb(new Error('Only image files are allowed!'), false)
    }
}

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB max file size
    }
})

// Public routes (no authentication required)
router.post('/register', validateRegister, registerController.register)
router.post('/login', validateLogin, loginController.login)

// Protected routes (authentication required)
router.get('/me', verifyToken, userController.getProfile)
router.put('/profile', verifyToken, userController.updateProfile)
router.post('/profile/image', verifyToken, upload.single('profileImage'), userController.uploadProfileImage)
router.delete('/profile/image', verifyToken, userController.deleteProfileImage)

// ===================== CONFIG ROUTES =====================

// Alat
router.get('/alat', verifyToken, configController.getAllAlat)
router.get('/alat/:id', verifyToken, configController.getAlatById)
router.post('/alat', verifyToken, upload.single('gambar'), configController.createAlat)
router.put('/alat/:id', verifyToken, upload.single('gambar'), configController.updateAlat)
router.delete('/alat/:id', verifyToken, configController.deleteAlat)

// Operator
router.get('/operator', verifyToken, configController.getAllOperator)
router.get('/operator/:id', verifyToken, configController.getOperatorById)
router.post('/operator', verifyToken, configController.createOperator)
router.put('/operator/:id', verifyToken, configController.updateOperator)
router.delete('/operator/:id', verifyToken, configController.deleteOperator)

// Lokasi
router.get('/lokasi', verifyToken, configController.getAllLokasi)
router.get('/lokasi/:id', verifyToken, configController.getLokasiById)
router.post('/lokasi', verifyToken, configController.createLokasi)
router.put('/lokasi/:id', verifyToken, configController.updateLokasi)
router.delete('/lokasi/:id', verifyToken, configController.deleteLokasi)

// Kalibrasi
router.get('/kalibrasi', verifyToken, configController.getAllKalibrasi)
router.get('/kalibrasi/:id', verifyToken, configController.getKalibrasiById)
router.post('/kalibrasi', verifyToken, configController.createKalibrasi)
router.put('/kalibrasi/:id', verifyToken, configController.updateKalibrasi)
router.delete('/kalibrasi/:id', verifyToken, configController.deleteKalibrasi)

// Pengawas (User Management)
router.get('/pengawas', verifyToken, configController.getAllPengawas)
router.get('/pengawas/:id', verifyToken, configController.getPengawasById)
router.post('/pengawas', verifyToken, upload.single('fotoProfil'), configController.createPengawas)
router.put('/pengawas/:id', verifyToken, upload.single('fotoProfil'), configController.updatePengawas)
router.delete('/pengawas/:id', verifyToken, configController.deletePengawas)

//ENDPOINT UNTUK ESP
router.get('/esp/lokasi', configController.getAllLokasi)
router.get('/esp/lokasi/:id', configController.getLokasiById)
router.post('/esp/lokasi', configController.createLokasi)
router.put('/esp/lokasi/:id', configController.updateLokasi)
router.delete('/esp/lokasi/:id', configController.deleteLokasi)

module.exports = router