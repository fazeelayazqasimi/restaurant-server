const prisma = require('../config/prisma')
const fs = require('fs')
const path = require('path')

// ─── GET ALL RESTAURANTS (PUBLIC) ─────────────────────────
const getRestaurants = async (req, res) => {
  try {
    const restaurants = await prisma.restaurant.findMany({
      where: { isApproved: true },
      include: {
        owner: { select: { name: true, email: true } },
        tables: true,
        timeSlots: true,
        _count: { select: { reservations: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
    
    // Add image URLs
    const baseUrl = `${req.protocol}://${req.get('host')}`
    const restaurantsWithImages = restaurants.map(r => ({
      ...r,
      logo: r.logo ? `${baseUrl}/${r.logo}` : null,
      images: r.images ? JSON.parse(r.images).map(img => `${baseUrl}/${img}`) : []
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
        tables: true,
        timeSlots: { where: { isActive: true }, orderBy: { time: 'asc' } },
        reservations: { take: 10, orderBy: { createdAt: 'desc' } }
      }
    })
    
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found.' })
    }
    
    const baseUrl = `${req.protocol}://${req.get('host')}`
    const restaurantWithImages = {
      ...restaurant,
      logo: restaurant.logo ? `${baseUrl}/${restaurant.logo}` : null,
      images: restaurant.images ? JSON.parse(restaurant.images).map(img => `${baseUrl}/${img}`) : []
    }
    
    res.status(200).json({ restaurant: restaurantWithImages })
  } catch (error) {
    console.error('Get restaurant error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── CREATE RESTAURANT (ADMIN) ────────────────────────────
const createRestaurant = async (req, res) => {
  try {
    const { name, location, description, openingTime, closingTime, ownerEmail } = req.body
    
    if (!name || !location || !openingTime || !closingTime) {
      return res.status(400).json({ message: 'Required fields missing.' })
    }
    
    // Find or create owner
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
    
    // Handle logo upload
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
    let existingImages = restaurant.images ? JSON.parse(restaurant.images) : []
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

module.exports = { getRestaurants, getRestaurantById, createRestaurant, uploadImages, approveRestaurant, getPendingRestaurants }