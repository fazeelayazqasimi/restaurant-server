const prisma = require('../config/prisma')
const { sendBookingConfirmation } = require('../utils/email')

// ─── CREATE RESERVATION ───────────────────────────────────
const createReservation = async (req, res) => {
  try {
    const { restaurantId, date, time, guests, tableId, isWalkIn, customerName, customerPhone } = req.body
    
    if (!restaurantId || !date || !time || !guests) {
      return res.status(400).json({ message: 'Missing required fields.' })
    }
    
    // Check if table is available
    if (tableId) {
      const existing = await prisma.reservation.findFirst({
        where: {
          tableId: parseInt(tableId),
          date,
          time,
          status: { notIn: ['cancelled', 'completed', 'no_show'] }
        }
      })
      
      if (existing) {
        return res.status(400).json({ message: 'Table already booked for this time.' })
      }
    }
    
    const reservation = await prisma.reservation.create({
      data: {
        date,
        time,
        guests: parseInt(guests),
        status: isWalkIn ? 'confirmed' : 'pending',
        isWalkIn: isWalkIn || false,
        customerName: customerName || null,
        customerPhone: customerPhone || null,
        userId: isWalkIn ? null : req.user.id,
        restaurantId: parseInt(restaurantId),
        tableId: tableId ? parseInt(tableId) : null
      },
      include: { restaurant: true, user: true, table: true }
    })
    
    // Send email confirmation if not walk-in
    if (!isWalkIn && reservation.user?.email) {
      await sendBookingConfirmation(
        reservation.user.email,
        reservation.user.name,
        reservation.restaurant.name,
        date,
        time,
        guests
      )
    }
    
    res.status(201).json({ message: 'Reservation created.', reservation })
  } catch (error) {
    console.error('Create reservation error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── GET USER RESERVATIONS ────────────────────────────────
const getUserReservations = async (req, res) => {
  try {
    const reservations = await prisma.reservation.findMany({
      where: { userId: req.user.id, isWalkIn: false },
      include: { restaurant: true, table: true },
      orderBy: { createdAt: 'desc' }
    })
    
    res.status(200).json({ reservations })
  } catch (error) {
    console.error('Get user reservations error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── GET RESTAURANT RESERVATIONS (OWNER) ──────────────────
const getRestaurantReservations = async (req, res) => {
  try {
    const { restaurantId } = req.params
    
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: parseInt(restaurantId) }
    })
    
    if (!restaurant || restaurant.ownerId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized.' })
    }
    
    const reservations = await prisma.reservation.findMany({
      where: { restaurantId: parseInt(restaurantId) },
      include: { user: true, table: true },
      orderBy: { date: 'desc', time: 'desc' }
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
    
    const allowedStatuses = ['pending', 'confirmed', 'cancelled', 'completed', 'no_show']
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status.' })
    }
    
    const reservation = await prisma.reservation.update({
      where: { id: parseInt(id) },
      data: { status },
      include: { restaurant: true, user: true }
    })
    
    res.status(200).json({ message: 'Status updated.', reservation })
  } catch (error) {
    console.error('Update status error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── GET TIME SLOTS ───────────────────────────────────────
const getTimeSlots = async (req, res) => {
  try {
    const { restaurantId } = req.params
    const { date } = req.query
    
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: parseInt(restaurantId) },
      include: { timeSlots: { where: { isActive: true }, orderBy: { time: 'asc' } } }
    })
    
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found.' })
    }
    
    let slots = restaurant.timeSlots
    
    if (slots.length === 0) {
      // Generate default slots from opening to closing
      const openHour = parseInt(restaurant.openingTime.split(':')[0])
      const closeHour = parseInt(restaurant.closingTime.split(':')[0])
      
      for (let i = openHour; i <= closeHour; i++) {
        slots.push({ time: `${i.toString().padStart(2, '0')}:00`, capacity: 10, isActive: true })
        if (i !== closeHour) {
          slots.push({ time: `${i.toString().padStart(2, '0')}:30`, capacity: 10, isActive: true })
        }
      }
    }
    
    // Check available capacity for each slot if date provided
    if (date) {
      const reservations = await prisma.reservation.findMany({
        where: {
          restaurantId: parseInt(restaurantId),
          date,
          status: { notIn: ['cancelled', 'no_show'] }
        }
      })
      
      const bookedCounts = {}
      reservations.forEach(r => {
        bookedCounts[r.time] = (bookedCounts[r.time] || 0) + 1
      })
      
      slots = slots.map(slot => ({
        ...slot,
        available: (slot.capacity || 10) - (bookedCounts[slot.time] || 0),
        isAvailable: (slot.capacity || 10) - (bookedCounts[slot.time] || 0) > 0
      }))
    }
    
    res.status(200).json({ timeSlots: slots })
  } catch (error) {
    console.error('Get time slots error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

module.exports = { createReservation, getUserReservations, getRestaurantReservations, updateReservationStatus, getTimeSlots }