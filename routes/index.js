const express = require('express')
const multer = require('multer')
const path = require('path')
const router = express.Router();
const registerController = require('../controllers/RegisterController')
const loginController = require('../controllers/LoginController')
const userController = require('../controllers/UserController')
const { validateRegister, validateLogin } = require('../utils/validators/auth')
const verifyToken = require('../middlewares/auth')

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname))
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

module.exports = router