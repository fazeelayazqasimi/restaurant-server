const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const prisma = require('../config/prisma')

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
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required.' })
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } })
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
        name,
        email,
        password: hashedPassword,
        phone: phone || null,
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

    // Find user
    const user = await prisma.user.findUnique({ where: { email } })
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

module.exports = { register, login }