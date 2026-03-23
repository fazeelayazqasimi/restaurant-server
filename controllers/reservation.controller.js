const prisma = require('../config/prisma')

// ─── CREATE RESERVATION ───────────────────────────────────
const createReservation = async (req, res) => {
  try {
    const { restaurantId, date, time, guests, tableId } = req.body

    if (!restaurantId || !date || !time || !guests) {
      return res.status(400).json({ message: 'Restaurant, date, time and guests are required.' })
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: parseInt(restaurantId) }
    })

    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found.' })
    }

    if (!restaurant.isApproved) {
      return res.status(400).json({ message: 'Restaurant is not approved yet.' })
    }

    // ─── Check table if provided ──────────────────────────
    if (tableId) {
      const table = await prisma.table.findUnique({
        where: { id: parseInt(tableId) }
      })

      if (!table) {
        return res.status(404).json({ message: 'Table not found.' })
      }

      if (!table.isAvailable) {
        return res.status(400).json({ message: 'This table is not available.' })
      }

      // Check if table already booked at same date/time
      const existingBooking = await prisma.reservation.findFirst({
        where: {
          tableId: parseInt(tableId),
          date,
          time,
          status: { in: ['pending', 'confirmed'] }
        }
      })

      if (existingBooking) {
        return res.status(400).json({ message: 'This table is already booked at selected time.' })
      }
    }

    const reservation = await prisma.reservation.create({
      data: {
        userId: req.user.id,
        restaurantId: parseInt(restaurantId),
        date,
        time,
        guests: parseInt(guests),
        status: 'pending',
        tableId: tableId ? parseInt(tableId) : null
      },
      include: {
        restaurant: {
          select: { id: true, name: true, location: true }
        },
        table: true
      }
    })

    res.status(201).json({
      message: 'Reservation created successfully.',
      reservation
    })
  } catch (error) {
    console.error('Create reservation error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── GET USER RESERVATIONS ────────────────────────────────
const getUserReservations = async (req, res) => {
  try {
    const reservations = await prisma.reservation.findMany({
      where: { userId: req.user.id },
      include: {
        restaurant: {
          select: { id: true, name: true, location: true, openingTime: true, closingTime: true }
        },
        table: true
      },
      orderBy: { createdAt: 'desc' }
    })
    res.status(200).json({ reservations })
  } catch (error) {
    console.error('Get user reservations error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── GET RESTAURANT RESERVATIONS ──────────────────────────
const getRestaurantReservations = async (req, res) => {
  try {
    const { restaurantId } = req.params

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: parseInt(restaurantId) }
    })

    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found.' })
    }

    if (restaurant.ownerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized.' })
    }

    const reservations = await prisma.reservation.findMany({
      where: { restaurantId: parseInt(restaurantId) },
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true }
        },
        table: true
      },
      orderBy: { createdAt: 'desc' }
    })

    res.status(200).json({ reservations })
  } catch (error) {
    console.error('Get restaurant reservations error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── UPDATE RESERVATION STATUS ────────────────────────────
const updateReservationStatus = async (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body

    const allowedStatuses = ['pending', 'confirmed', 'rejected']
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status.' })
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: parseInt(id) },
      include: { restaurant: true }
    })

    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found.' })
    }

    if (reservation.restaurant.ownerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized.' })
    }

    const updated = await prisma.reservation.update({
      where: { id: parseInt(id) },
      data: { status }
    })

    res.status(200).json({ message: `Reservation ${status}.`, reservation: updated })
  } catch (error) {
    console.error('Update reservation error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── GET ALL RESERVATIONS (Admin) ─────────────────────────
const getAllReservations = async (req, res) => {
  try {
    const reservations = await prisma.reservation.findMany({
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true }
        },
        restaurant: {
          select: { id: true, name: true, location: true }
        },
        table: true
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
  createReservation,
  getUserReservations,
  getRestaurantReservations,
  updateReservationStatus,
  getAllReservations
}