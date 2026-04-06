const prisma = require('../config/prisma')
const bcrypt = require('bcryptjs')

// ─── GET ALL RESTAURANTS (PUBLIC) ─────────────────────────
const getRestaurants = async (req, res) => {
  try {
    const { search } = req.query

    const where = { isApproved: true }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { location: { contains: search } }
      ]
    }

    const restaurants = await prisma.restaurant.findMany({
      where,
      include: {
        owner: { select: { name: true, email: true, phone: true } },
        tables: { select: { id: true, status: true, capacity: true } },
        timeSlots: { where: { isActive: true }, orderBy: { time: 'asc' } },
        _count: { select: { reservations: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    const baseUrl = `${req.protocol}://${req.get('host')}`
    const restaurantsWithImages = restaurants.map(r => ({
      ...r,
      logo: r.logo ? `${baseUrl}/${r.logo}` : null,
      images: r.images ? JSON.parse(r.images).map(img => `${baseUrl}/${img}`) : [],
      availableTables: r.tables.filter(t => t.status === 'available').length,
      totalTables: r.tables.length
    }))

    res.status(200).json({ restaurants: restaurantsWithImages })
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
        owner: { select: { name: true, email: true, phone: true } },
        tables: { orderBy: { tableNumber: 'asc' } },
        timeSlots: { where: { isActive: true }, orderBy: { time: 'asc' } },
        _count: { select: { reservations: true } }
      }
    })

    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found.' })
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`
    const restaurantWithImages = {
      ...restaurant,
      logo: restaurant.logo ? `${baseUrl}/${restaurant.logo}` : null,
      images: restaurant.images ? JSON.parse(restaurant.images).map(img => `${baseUrl}/${img}`) : [],
      availableTables: restaurant.tables.filter(t => t.status === 'available').length,
      totalTables: restaurant.tables.length
    }

    res.status(200).json({ restaurant: restaurantWithImages })
  } catch (error) {
    console.error('Get restaurant error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── GET MY RESTAURANT (OWNER) ────────────────────────────
const getMyRestaurant = async (req, res) => {
  try {
    const restaurants = await prisma.restaurant.findMany({
      where: { ownerId: req.user.id },
      include: {
        tables: { orderBy: { tableNumber: 'asc' } },
        timeSlots: { where: { isActive: true }, orderBy: { time: 'asc' } },
        _count: { select: { reservations: true } }
      }
    })

    const baseUrl = `${req.protocol}://${req.get('host')}`
    const result = restaurants.map(r => ({
      ...r,
      logo: r.logo ? `${baseUrl}/${r.logo}` : null,
      images: r.images ? JSON.parse(r.images).map(img => `${baseUrl}/${img}`) : []
    }))

    res.status(200).json({ restaurants: result })
  } catch (error) {
    console.error('Get my restaurant error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── UPDATE RESTAURANT (OWNER) ────────────────────────────
const updateRestaurant = async (req, res) => {
  try {
    const { id } = req.params
    const { name, location, description, openingTime, closingTime } = req.body

    const restaurant = await prisma.restaurant.findUnique({ where: { id: parseInt(id) } })

    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found.' })
    }

    if (req.user.role !== 'admin' && restaurant.ownerId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized.' })
    }

    let logoPath = restaurant.logo
    if (req.file) {
      logoPath = req.file.path.replace(/\\/g, '/')
    }

    const updated = await prisma.restaurant.update({
      where: { id: parseInt(id) },
      data: {
        ...(name && { name }),
        ...(location && { location }),
        ...(description !== undefined && { description }),
        ...(openingTime && { openingTime }),
        ...(closingTime && { closingTime }),
        logo: logoPath
      }
    })

    res.status(200).json({ message: 'Restaurant updated.', restaurant: updated })
  } catch (error) {
    console.error('Update restaurant error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── CREATE RESTAURANT (ADMIN) ────────────────────────────
const createRestaurant = async (req, res) => {
  try {
    const { name, location, description, openingTime, closingTime, ownerEmail } = req.body

    if (!name || !location || !openingTime || !closingTime) {
      return res.status(400).json({ message: 'name, location, openingTime and closingTime are required.' })
    }

    let owner = await prisma.user.findUnique({ where: { email: ownerEmail } })

    if (!owner) {
      const tempPassword = Math.random().toString(36).slice(-8)
      const hashedPassword = await bcrypt.hash(tempPassword, 10)

      owner = await prisma.user.create({
        data: {
          name: name + ' Owner',
          email: ownerEmail,
          password: hashedPassword,
          phone: '',
          role: 'restaurant',
          isApproved: true,
          isVerified: true
        }
      })
    }

    let logoPath = null
    if (req.file) {
      logoPath = req.file.path.replace(/\\/g, '/')
    }

    const restaurant = await prisma.restaurant.create({
      data: {
        name,
        location,
        description: description || '',
        logo: logoPath,
        openingTime,
        closingTime,
        isApproved: true,
        ownerId: owner.id
        // FIX: removed "address" — not in schema
      }
    })

    res.status(201).json({ message: 'Restaurant created.', restaurant })
  } catch (error) {
    console.error('Create restaurant error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── UPLOAD RESTAURANT IMAGES ─────────────────────────────
const uploadImages = async (req, res) => {
  try {
    const { id } = req.params

    const restaurant = await prisma.restaurant.findUnique({ where: { id: parseInt(id) } })
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found.' })
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No images uploaded.' })
    }

    const imagePaths = req.files.map(file => file.path.replace(/\\/g, '/'))
    const existingImages = restaurant.images ? JSON.parse(restaurant.images) : []
    const allImages = [...existingImages, ...imagePaths]

    await prisma.restaurant.update({
      where: { id: parseInt(id) },
      data: { images: JSON.stringify(allImages) }
    })

    res.status(200).json({ message: 'Images uploaded.', images: imagePaths })
  } catch (error) {
    console.error('Upload images error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── APPROVE RESTAURANT (ADMIN) ───────────────────────────
const approveRestaurant = async (req, res) => {
  try {
    const { id } = req.params

    const restaurant = await prisma.restaurant.findUnique({ where: { id: parseInt(id) } })
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found.' })
    }

    await prisma.restaurant.update({
      where: { id: parseInt(id) },
      data: { isApproved: true }
    })

    await prisma.user.update({
      where: { id: restaurant.ownerId },
      data: { isApproved: true }
    })

    res.status(200).json({ message: 'Restaurant approved.' })
  } catch (error) {
    console.error('Approve restaurant error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── GET PENDING RESTAURANTS (ADMIN) ──────────────────────
const getPendingRestaurants = async (req, res) => {
  try {
    const restaurants = await prisma.restaurant.findMany({
      where: { isApproved: false },
      include: { owner: { select: { name: true, email: true, phone: true } } }
    })

    res.status(200).json({ pendingRestaurants: restaurants })
  } catch (error) {
    console.error('Get pending error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

module.exports = {
  getRestaurants,
  getRestaurantById,
  getMyRestaurant,
  updateRestaurant,
  createRestaurant,
  uploadImages,
  approveRestaurant,
  getPendingRestaurants
}