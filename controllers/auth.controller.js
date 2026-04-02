const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const prisma = require('../config/prisma')

// ─── Email validation helper ──────────────────────────────
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// ─── Phone validation helper ──────────────────────────────
const isValidPhone = (phone) => {
  const phoneRegex = /^[0-9+\-\s]{7,15}$/
  return phoneRegex.test(phone)
}

// ─── Generate JWT Token ───────────────────────────────────
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  )
}

// ─── REGISTER ─────────────────────────────────────────────
const register = async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body

    // Check required fields
    if (!name || !email || !password || !phone) {
      return res.status(400).json({ message: 'Name, email, phone and password are required.' })
    }

    // Email validation
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address.' })
    }

    // Phone validation
    if (!isValidPhone(phone)) {
      return res.status(400).json({ message: 'Please enter a valid phone number.' })
    }

    // Password length check
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' })
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered.' })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Only allow user or restaurant role on register
    const allowedRoles = ['user', 'restaurant']
    const userRole = allowedRoles.includes(role) ? role : 'user'

    // Create user
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        phone: phone.trim(),
        role: userRole
      }
    })

    // Generate token
    const token = generateToken(user)

    res.status(201).json({
      message: 'Registration successful.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone
      }
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

    // Check required fields
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' })
    }

    // Email validation
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address.' })
    }

    // Find user
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password.' })
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password.' })
    }

    // Generate token
    const token = generateToken(user)

    res.status(200).json({
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone
      }
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
        role: true,
        phone: true,
        createdAt: true,
        reservations: {
          include: {
            restaurant: {
              select: { id: true, name: true, location: true }
            },
            table: true
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
    const { name, email, phone, currentPassword, newPassword } = req.body

    const user = await prisma.user.findUnique({ where: { id: req.user.id } })
    if (!user) {
      return res.status(404).json({ message: 'User not found.' })
    }

    // Validate email if provided
    if (email && !isValidEmail(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address.' })
    }

    // Validate phone if provided
    if (phone && !isValidPhone(phone)) {
      return res.status(400).json({ message: 'Please enter a valid phone number.' })
    }

    // Check email uniqueness if changed
    if (email && email.toLowerCase() !== user.email) {
      const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
      if (existingUser) {
        return res.status(400).json({ message: 'Email already in use.' })
      }
    }

    // Handle password change
    let hashedPassword = user.password
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ message: 'Current password is required to set a new password.' })
      }
      const isMatch = await bcrypt.compare(currentPassword, user.password)
      if (!isMatch) {
        return res.status(400).json({ message: 'Current password is incorrect.' })
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ message: 'New password must be at least 6 characters.' })
      }
      hashedPassword = await bcrypt.hash(newPassword, 10)
    }

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        name: name ? name.trim() : user.name,
        email: email ? email.toLowerCase().trim() : user.email,
        phone: phone ? phone.trim() : user.phone,
        password: hashedPassword
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true
      }
    })

    res.status(200).json({ message: 'Profile updated successfully.', user: updated })
  } catch (error) {
    console.error('Update profile error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

module.exports = { register, login, getProfile, updateProfile }