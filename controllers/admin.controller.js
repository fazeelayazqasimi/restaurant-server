const prisma = require('../config/prisma')
const bcrypt = require('bcryptjs')

// ─── GET ALL USERS ────────────────────────────────────────
const getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        createdAt: true,
        _count: {
          select: {
            reservations: true,
            restaurants: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    res.status(200).json({ users })
  } catch (error) {
    console.error('Get all users error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── DELETE USER ──────────────────────────────────────────
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params

    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) }
    })

    if (!user) {
      return res.status(404).json({ message: 'User not found.' })
    }

    if (user.role === 'admin') {
      return res.status(403).json({ message: 'Cannot delete admin user.' })
    }

    // Delete user reservations
    await prisma.reservation.deleteMany({
      where: { userId: parseInt(id) }
    })

    // Delete restaurants owned by user
    const restaurants = await prisma.restaurant.findMany({
      where: { ownerId: parseInt(id) }
    })

    for (const restaurant of restaurants) {
      await prisma.reservation.deleteMany({
        where: { restaurantId: restaurant.id }
      })
    }

    await prisma.restaurant.deleteMany({
      where: { ownerId: parseInt(id) }
    })

    await prisma.user.delete({
      where: { id: parseInt(id) }
    })

    res.status(200).json({ message: 'User deleted successfully.' })
  } catch (error) {
    console.error('Delete user error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── GET ALL RESTAURANTS ──────────────────────────────────
const getAllRestaurants = async (req, res) => {
  try {
    const restaurants = await prisma.restaurant.findMany({
      include: {
        owner: {
          select: { id: true, name: true, email: true, phone: true }
        },
        _count: {
          select: { reservations: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    res.status(200).json({ restaurants })
  } catch (error) {
    console.error('Get all restaurants error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── DELETE RESTAURANT ────────────────────────────────────
const deleteRestaurant = async (req, res) => {
  try {
    const { id } = req.params

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: parseInt(id) }
    })

    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found.' })
    }

    await prisma.reservation.deleteMany({
      where: { restaurantId: parseInt(id) }
    })

    await prisma.restaurant.delete({
      where: { id: parseInt(id) }
    })

    res.status(200).json({ message: 'Restaurant deleted successfully.' })
  } catch (error) {
    console.error('Delete restaurant error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── CREATE RESTAURANT BY ADMIN ──────────────────────────
const createRestaurant = async (req, res) => {
  try {
    const {
      name, description, location,
      openingTime, closingTime,
      ownerName, ownerEmail, ownerPassword, ownerPhone
    } = req.body

    if (!name || !location || !openingTime || !closingTime || !ownerEmail || !ownerPassword) {
      return res.status(400).json({ message: 'All required fields must be filled.' })
    }

    // Check if owner email already exists
    const existing = await prisma.user.findUnique({
      where: { email: ownerEmail }
    })

    let owner

    if (existing) {
      owner = existing
    } else {
      const hashedPassword = await bcrypt.hash(ownerPassword, 10)
      owner = await prisma.user.create({
        data: {
          name: ownerName || 'Restaurant Owner',
          email: ownerEmail,
          password: hashedPassword,
          phone: ownerPhone || null,
          role: 'restaurant'
        }
      })
    }

    const restaurant = await prisma.restaurant.create({
      data: {
        name,
        description: description || null,
        location,
        openingTime,
        closingTime,
        ownerId: owner.id,
        isApproved: true
      }
    })

    res.status(201).json({
      message: 'Restaurant created successfully.',
      restaurant,
      owner: {
        id: owner.id,
        name: owner.name,
        email: owner.email,
        role: owner.role
      }
    })
  } catch (error) {
    console.error('Create restaurant error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

module.exports = {
  getAllUsers,
  deleteUser,
  getAllRestaurants,
  deleteRestaurant,
  createRestaurant
}