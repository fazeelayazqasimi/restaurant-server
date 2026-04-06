const prisma = require('../config/prisma')
const bcrypt = require('bcryptjs')

// ─── DASHBOARD STATS ──────────────────────────────────────
const getDashboardStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalOwners,
      totalRestaurants,
      pendingRestaurants,
      totalReservations,
      pendingReservations,
      confirmedReservations
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'user' } }),
      prisma.user.count({ where: { role: 'restaurant' } }),
      prisma.restaurant.count({ where: { isApproved: true } }),
      prisma.restaurant.count({ where: { isApproved: false } }),
      prisma.reservation.count(),
      prisma.reservation.count({ where: { status: 'pending' } }),
      prisma.reservation.count({ where: { status: 'confirmed' } })
    ])

    res.status(200).json({
      stats: {
        totalUsers,
        totalOwners,
        totalRestaurants,
        pendingRestaurants,
        totalReservations,
        pendingReservations,
        confirmedReservations
      }
    })
  } catch (error) {
    console.error('Dashboard stats error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── GET ALL USERS (role: user only) ─────────────────────
const getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: 'user' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        isVerified: true,
        isApproved: true,
        createdAt: true,
        _count: { select: { reservations: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
    res.status(200).json({ users })
  } catch (error) {
    console.error('Get all users error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── GET ALL RESTAURANT OWNERS (role: restaurant) ────────
const getAllRestaurantOwners = async (req, res) => {
  try {
    const owners = await prisma.user.findMany({
      where: { role: 'restaurant' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        isVerified: true,
        isApproved: true,
        createdAt: true,
        _count: { select: { restaurants: true } },
        restaurants: {
          select: { id: true, name: true, isApproved: true, location: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    res.status(200).json({ owners })
  } catch (error) {
    console.error('Get restaurant owners error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── DELETE USER ──────────────────────────────────────────
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params

    const user = await prisma.user.findUnique({ where: { id: parseInt(id) } })

    if (!user) {
      return res.status(404).json({ message: 'User not found.' })
    }

    if (user.role === 'admin') {
      return res.status(403).json({ message: 'Cannot delete admin user.' })
    }

    // Delete user's reservations
    await prisma.reservation.deleteMany({ where: { userId: parseInt(id) } })

    // If restaurant owner, clean up their restaurants
    if (user.role === 'restaurant') {
      const restaurants = await prisma.restaurant.findMany({ where: { ownerId: parseInt(id) } })

      for (const r of restaurants) {
        await prisma.reservation.deleteMany({ where: { restaurantId: r.id } })
        await prisma.table.deleteMany({ where: { restaurantId: r.id } })
        await prisma.timeSlot.deleteMany({ where: { restaurantId: r.id } })
      }

      await prisma.restaurant.deleteMany({ where: { ownerId: parseInt(id) } })
    }

    await prisma.user.delete({ where: { id: parseInt(id) } })

    res.status(200).json({ message: 'User deleted successfully.' })
  } catch (error) {
    console.error('Delete user error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── GET ALL RESTAURANTS ──────────────────────────────────
const getAllRestaurants = async (req, res) => {
  try {
    const { approved } = req.query

    const where = {}
    if (approved === 'true') where.isApproved = true
    if (approved === 'false') where.isApproved = false

    const restaurants = await prisma.restaurant.findMany({
      where,
      include: {
        owner: { select: { id: true, name: true, email: true, phone: true } },
        _count: { select: { reservations: true, tables: true } }
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

    const restaurant = await prisma.restaurant.findUnique({ where: { id: parseInt(id) } })

    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found.' })
    }

    await prisma.reservation.deleteMany({ where: { restaurantId: parseInt(id) } })
    await prisma.table.deleteMany({ where: { restaurantId: parseInt(id) } })
    await prisma.timeSlot.deleteMany({ where: { restaurantId: parseInt(id) } })
    await prisma.restaurant.delete({ where: { id: parseInt(id) } })

    res.status(200).json({ message: 'Restaurant deleted successfully.' })
  } catch (error) {
    console.error('Delete restaurant error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── CREATE RESTAURANT BY ADMIN ───────────────────────────
const createRestaurant = async (req, res) => {
  try {
    const {
      name, description, location,
      openingTime, closingTime,
      ownerName, ownerEmail, ownerPassword, ownerPhone
    } = req.body

    if (!name || !location || !openingTime || !closingTime || !ownerEmail || !ownerPassword || !ownerPhone) {
      return res.status(400).json({ message: 'All required fields must be filled.' })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(ownerEmail)) {
      return res.status(400).json({ message: 'Please enter a valid owner email.' })
    }

    let owner = await prisma.user.findUnique({ where: { email: ownerEmail.toLowerCase() } })

    if (!owner) {
      const hashedPassword = await bcrypt.hash(ownerPassword, 10)
      owner = await prisma.user.create({
        data: {
          name: ownerName || 'Restaurant Owner',
          email: ownerEmail.toLowerCase().trim(),
          password: hashedPassword,
          phone: ownerPhone.trim(),
          role: 'restaurant',
          isVerified: true,
          isApproved: true
        }
      })
    }

    const restaurant = await prisma.restaurant.create({
      data: {
        name,
        description: description || null,
        location,
        // FIX: removed address field — not in schema
        openingTime,
        closingTime,
        ownerId: owner.id,
        isApproved: true
      }
    })

    res.status(201).json({
      message: 'Restaurant created successfully.',
      restaurant,
      owner: { id: owner.id, name: owner.name, email: owner.email, role: owner.role }
    })
  } catch (error) {
    console.error('Create restaurant error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── APPROVE RESTAURANT ───────────────────────────────────
const approveRestaurant = async (req, res) => {
  try {
    const { id } = req.params

    const restaurant = await prisma.restaurant.findUnique({ where: { id: parseInt(id) } })
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found.' })
    }

    await prisma.restaurant.update({ where: { id: parseInt(id) }, data: { isApproved: true } })
    await prisma.user.update({ where: { id: restaurant.ownerId }, data: { isApproved: true } })

    res.status(200).json({ message: 'Restaurant approved successfully.' })
  } catch (error) {
    console.error('Approve restaurant error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── REJECT RESTAURANT ────────────────────────────────────
const rejectRestaurant = async (req, res) => {
  try {
    const { id } = req.params

    const restaurant = await prisma.restaurant.findUnique({ where: { id: parseInt(id) } })
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found.' })
    }

    await prisma.restaurant.delete({ where: { id: parseInt(id) } })
    await prisma.user.delete({ where: { id: restaurant.ownerId } })

    res.status(200).json({ message: 'Restaurant rejected and removed.' })
  } catch (error) {
    console.error('Reject restaurant error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── GET PENDING RESTAURANTS ──────────────────────────────
const getPendingRestaurants = async (req, res) => {
  try {
    const restaurants = await prisma.restaurant.findMany({
      where: { isApproved: false },
      include: {
        owner: { select: { id: true, name: true, email: true, phone: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
    res.status(200).json({ pendingRestaurants: restaurants })
  } catch (error) {
    console.error('Get pending restaurants error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── GET ALL RESERVATIONS ─────────────────────────────────
const getAllReservations = async (req, res) => {
  try {
    const { status } = req.query

    const where = {}
    if (status) where.status = status

    const reservations = await prisma.reservation.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        restaurant: { select: { id: true, name: true, location: true } },
        table: { select: { id: true, tableNumber: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
    res.status(200).json({ reservations })
  } catch (error) {
    console.error('Get all reservations error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

module.exports = {
  getDashboardStats,
  getAllUsers,
  getAllRestaurantOwners,
  deleteUser,
  getAllRestaurants,
  deleteRestaurant,
  createRestaurant,
  approveRestaurant,
  rejectRestaurant,
  getPendingRestaurants,
  getAllReservations
}