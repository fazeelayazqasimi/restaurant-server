const express = require('express')
const router = express.Router()
const { sendOtp, verifyOtp, register, login, getProfile } = require('../controllers/auth.controller')
const { protect } = require('../middleware/auth')

router.post('/send-otp', sendOtp)
router.post('/verify-otp', verifyOtp)
router.post('/register', register)
router.post('/login', login)
router.get('/profile', protect, getProfile)

module.exports = router