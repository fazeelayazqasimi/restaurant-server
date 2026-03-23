const prisma = require('../config/prisma')

// ─── GET ALL APPROVED RESTAURANTS ─────────────────────────
const getAllRestaurants = async (req, res) => {
  try {
    const restaurants = await prisma.restaurant.findMany({
      where: { isApproved: true },
      include: {
        owner: {
          select: { id: true, name: true, email: true, phone: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    res.status(200).json({ restaurants })
  } catch (error) {
    console.error('Get restaurants error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── GET SINGLE RESTAURANT ────────────────────────────────
const getRestaurantById = async (req, res) => {
  try {
    const { id } = req.params

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: parseInt(id) },
      include: {
        owner: {
          select: { id: true, name: true, email: true, phone: true }
        }
      }
    })

    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found.' })
    }

    res.status(200).json({ restaurant })
  } catch (error) {
    console.error('Get restaurant error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── CREATE RESTAURANT (Restaurant Owner only) ────────────
const createRestaurant = async (req, res) => {
  try {
    const { name, description, location, openingTime, closingTime } = req.body

    if (!name || !location || !openingTime || !closingTime) {
      return res.status(400).json({ message: 'Name, location, opening and closing time are required.' })
    }

    const restaurant = await prisma.restaurant.create({
      data: {
        name,
        description: description || null,
        location,
        openingTime,
        closingTime,
        ownerId: req.user.id,
        isApproved: false  // Admin approve karega
      }
    })

    res.status(201).json({
      message: 'Restaurant created. Waiting for admin approval.',
      restaurant
    })
  } catch (error) {
    console.error('Create restaurant error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── UPDATE RESTAURANT (Owner only) ──────────────────────
const updateRestaurant = async (req, res) => {
  try {
    const { id } = req.params
    const { name, description, location, openingTime, closingTime } = req.body

    // Check restaurant exists
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: parseInt(id) }
    })

    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found.' })
    }

    // Check ownership
    if (restaurant.ownerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this restaurant.' })
    }

    const updated = await prisma.restaurant.update({
      where: { id: parseInt(id) },
      data: {
        name: name || restaurant.name,
        description: description || restaurant.description,
        location: location || restaurant.location,
        openingTime: openingTime || restaurant.openingTime,
        closingTime: closingTime || restaurant.closingTime
      }
    })

    res.status(200).json({ message: 'Restaurant updated.', restaurant: updated })
  } catch (error) {
    console.error('Update restaurant error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── APPROVE RESTAURANT (Admin only) ─────────────────────
const approveRestaurant = async (req, res) => {
  try {
    const { id } = req.params

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: parseInt(id) }
    })

    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found.' })
    }

    const updated = await prisma.restaurant.update({
      where: { id: parseInt(id) },
      data: { isApproved: true }
    })

    res.status(200).json({ message: 'Restaurant approved.', restaurant: updated })
  } catch (error) {
    console.error('Approve restaurant error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── GET MY RESTAURANTS (Owner only) ─────────────────────
const getMyRestaurants = async (req, res) => {
  try {
    const restaurants = await prisma.restaurant.findMany({
      where: { ownerId: req.user.id },
      orderBy: { createdAt: 'desc' }
    })

    res.status(200).json({ restaurants })
  } catch (error) {
    console.error('Get my restaurants error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

module.exports = {
  getAllRestaurants,
  getRestaurantById,
  createRestaurant,
  updateRestaurant,
  approveRestaurant,
  getMyRestaurants
}