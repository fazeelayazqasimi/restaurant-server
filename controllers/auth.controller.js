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
  // Allow formats: 03001234567, +923001234567, 10-15 digits
  const phoneRegex = /^(\+92|0)?[0-9]{10,14}$/
  return phoneRegex.test(phone.replace(/[\s\-]/g, ''))
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
      // New registration — OTP verified in memory (frontend tracks this)
      return res.status(200).json({ verified: true, message: 'OTP verified.' })
    }

    if (user.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP.' })
    }

    if (user.otpExpiry < new Date()) {
      return res.status(400).json({ message: 'OTP has expired. Please request a new one.' })
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
      return res.status(400).json({ message: 'All fields are required (name, email, password, phone).' })
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address.' })
    }

    if (!isValidPhone(phone)) {
      return res.status(400).json({ message: 'Please enter a valid phone number.' })
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' })
    }

    const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
    if (existingUser) {
      return res.status(400).json({ message: 'This email is already registered.' })
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
        isVerified: true,
        isApproved: userRole !== 'restaurant'
      }
    })

    // If restaurant owner, create restaurant pending approval
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
      ? 'Registration submitted. Awaiting admin approval.'
      : 'Registration successful.'

    res.status(201).json({
      message,
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone }
    })
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

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address.' })
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })

    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password.' })
    }

    if (!user.isVerified) {
      return res.status(403).json({ message: 'Please verify your email before logging in.' })
    }

    if (user.role === 'restaurant' && !user.isApproved) {
      return res.status(403).json({ message: 'Your account is pending admin approval.' })
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password.' })
    }

    const token = generateToken(user)

    res.status(200).json({
      message: 'Login successful.',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone }
    })
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
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isVerified: true,
        isApproved: true,
        createdAt: true,
        // FIX: plural "restaurants" not "restaurant"
        restaurants: {
          select: {
            id: true,
            name: true,
            location: true,
            logo: true,
            isApproved: true,
            openingTime: true,
            closingTime: true
          }
        },
        reservations: {
          include: {
            restaurant: {
              select: { id: true, name: true, location: true, logo: true }
            },
            table: {
              select: { id: true, tableNumber: true, capacity: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
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

// ─── UPDATE PROFILE ───────────────────────────────────────
const updateProfile = async (req, res) => {
  try {
    const { name, phone } = req.body

    if (phone && !isValidPhone(phone)) {
      return res.status(400).json({ message: 'Please enter a valid phone number.' })
    }

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(name && { name: name.trim() }),
        ...(phone && { phone: phone.trim() })
      },
      select: { id: true, name: true, email: true, phone: true, role: true }
    })

    res.status(200).json({ message: 'Profile updated.', user: updated })
  } catch (error) {
    console.error('Update profile error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── CHANGE PASSWORD ──────────────────────────────────────
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required.' })
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters.' })
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } })
    const isMatch = await bcrypt.compare(currentPassword, user.password)

    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect.' })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword }
    })

    res.status(200).json({ message: 'Password changed successfully.' })
  } catch (error) {
    console.error('Change password error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

module.exports = { sendOtp, verifyOtp, register, login, getProfile, updateProfile, changePassword }