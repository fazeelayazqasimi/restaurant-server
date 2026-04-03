const express = require('express')
const router = express.Router()
const { protect, restrictTo } = require('../middleware/auth')

// Get all users
router.get('/users', protect, restrictTo('admin'), async (req, res) => {
  try {
    const prisma = require('../config/prisma')
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        isApproved: true,
        isVerified: true
      }
    })
    res.json({ users })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

// Delete user
router.delete('/users/:id', protect, restrictTo('admin'), async (req, res) => {
  try {
    const prisma = require('../config/prisma')
    await prisma.user.delete({ where: { id: parseInt(req.params.id) } })
    res.json({ message: 'User deleted' })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

// Get all restaurants
router.get('/restaurants', protect, restrictTo('admin'), async (req, res) => {
  try {
    const prisma = require('../config/prisma')
    const restaurants = await prisma.restaurant.findMany({
      include: {
        owner: { select: { id: true, name: true, email: true } },
        tables: true
      }
    })
    res.json({ restaurants })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

// Delete restaurant
router.delete('/restaurants/:id', protect, restrictTo('admin'), async (req, res) => {
  try {
    const prisma = require('../config/prisma')
    await prisma.restaurant.delete({ where: { id: parseInt(req.params.id) } })
    res.json({ message: 'Restaurant deleted' })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

// Get pending restaurants (for approval)
router.get('/pending-restaurants', protect, restrictTo('admin'), async (req, res) => {
  try {
    const prisma = require('../config/prisma')
    const pendingRestaurants = await prisma.restaurant.findMany({
      where: { isApproved: false },
      include: {
        owner: { select: { id: true, name: true, email: true, phone: true } }
      }
    })
    res.json({ pendingRestaurants })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

// Approve restaurant
router.put('/approve-restaurant/:id', protect, restrictTo('admin'), async (req, res) => {
  try {
    const prisma = require('../config/prisma')
    const restaurant = await prisma.restaurant.update({
      where: { id: parseInt(req.params.id) },
      data: { isApproved: true }
    })
    await prisma.user.update({
      where: { id: restaurant.ownerId },
      data: { isApproved: true }
    })
    res.json({ message: 'Restaurant approved successfully' })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

// Reject restaurant
router.delete('/reject-restaurant/:id', protect, restrictTo('admin'), async (req, res) => {
  try {
    const prisma = require('../config/prisma')
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: parseInt(req.params.id) }
    })
    if (restaurant) {
      await prisma.user.delete({ where: { id: restaurant.ownerId } })
      await prisma.restaurant.delete({ where: { id: parseInt(req.params.id) } })
    }
    res.json({ message: 'Restaurant rejected and deleted' })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

// Get tables stats
router.get('/tables', protect, restrictTo('admin'), async (req, res) => {
  try {
    const prisma = require('../config/prisma')
    const tables = await prisma.table.findMany({
      include: { restaurant: true }
    })
    res.json({ tables })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

module.exports = router