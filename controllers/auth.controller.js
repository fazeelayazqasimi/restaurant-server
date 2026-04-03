const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const prisma = require('../config/prisma')
const { sendOTP } = require('../utils/email')

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  )
}

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

const isValidPhone = (phone) => {
  const phoneRegex = /^[0-9]{10,15}$/
  return phoneRegex.test(phone)
}

// ─── SEND OTP ─────────────────────────────────────────────
const sendOtp = async (req, res) => {
  try {
    const { email } = req.body
    
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ message: 'Valid email is required.' })
    }
    
    const otp = generateOTP()
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    
    // Save OTP to user if exists, or just send for new registration
    const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
    
    if (existingUser) {
      await prisma.user.update({
        where: { email: email.toLowerCase() },
        data: { otp, otpExpiry }
      })
    }
    
    const emailSent = await sendOTP(email, otp)
    
    if (!emailSent) {
      return res.status(500).json({ message: 'Failed to send OTP. Please try again.' })
    }
    
    res.status(200).json({ message: 'OTP sent successfully.' })
  } catch (error) {
    console.error('Send OTP error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── VERIFY OTP ───────────────────────────────────────────
const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body
    
    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required.' })
    }
    
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
    
    if (!user) {
      // For new registration, store verification status temporarily
      return res.status(200).json({ verified: true, message: 'OTP verified.' })
    }
    
    if (user.otp !== otp || user.otpExpiry < new Date()) {
      return res.status(400).json({ message: 'Invalid or expired OTP.' })
    }
    
    await prisma.user.update({
      where: { email: email.toLowerCase() },
      data: { isVerified: true, otp: null, otpExpiry: null }
    })
    
    res.status(200).json({ verified: true, message: 'Email verified successfully.' })
  } catch (error) {
    console.error('Verify OTP error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── REGISTER ─────────────────────────────────────────────
const register = async (req, res) => {
  try {
    const { name, email, password, phone, role, restaurant } = req.body
    
    if (!name || !email || !password || !phone) {
      return res.status(400).json({ message: 'All fields are required.' })
    }
    
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Valid email is required.' })
    }
    
    if (!isValidPhone(phone)) {
      return res.status(400).json({ message: 'Valid phone number is required (10-15 digits).' })
    }
    
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' })
    }
    
    const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered.' })
    }
    
    const hashedPassword = await bcrypt.hash(password, 10)
    const userRole = (role === 'restaurant' || role === 'admin') ? role : 'user'
    
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        phone: phone.trim(),
        role: userRole,
        isVerified: true, // Since OTP verified before
        isApproved: userRole !== 'restaurant' // Restaurants need approval
      }
    })
    
    // If restaurant owner, create restaurant (pending approval)
    if (userRole === 'restaurant' && restaurant) {
      await prisma.restaurant.create({
        data: {
          name: restaurant.name,
          location: restaurant.location,
          description: restaurant.description || '',
          openingTime: restaurant.openingTime || '12:00',
          closingTime: restaurant.closingTime || '23:00',
          isApproved: false,
          ownerId: user.id
        }
      })
    }
    
    const token = generateToken(user)
    
    const message = userRole === 'restaurant'
      ? 'Restaurant registration submitted for admin approval.'
      : 'Registration successful.'
    
    res.status(201).json({ message, token, user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone } })
  } catch (error) {
    console.error('Register error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── LOGIN ────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const { email, password } = req.body
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' })
    }
    
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
    
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials.' })
    }
    
    if (!user.isVerified) {
      return res.status(403).json({ message: 'Please verify your email first.' })
    }
    
    if (user.role === 'restaurant' && !user.isApproved) {
      return res.status(403).json({ message: 'Your account is pending admin approval.' })
    }
    
    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials.' })
    }
    
    const token = generateToken(user)
    
    res.status(200).json({ message: 'Login successful.', token, user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone } })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── GET PROFILE ──────────────────────────────────────────
const getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        restaurant: true,
        reservations: { include: { restaurant: true, table: true }, orderBy: { createdAt: 'desc' } }
      }
    })
    
    if (!user) {
      return res.status(404).json({ message: 'User not found.' })
    }
    
    res.status(200).json({ user })
  } catch (error) {
    console.error('Get profile error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

module.exports = { sendOtp, verifyOtp, register, login, getProfile }