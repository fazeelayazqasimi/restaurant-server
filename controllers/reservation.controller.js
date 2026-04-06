const prisma = require('../config/prisma')
const { sendBookingConfirmation, sendStatusUpdateEmail } = require('../utils/email')

// ─── CREATE RESERVATION ───────────────────────────────────
const createReservation = async (req, res) => {
  try {
    const { restaurantId, date, time, guests, tableId, isWalkIn, customerName, customerPhone, notes } = req.body

    if (!restaurantId || !date || !time || !guests) {
      return res.status(400).json({ message: 'restaurantId, date, time and guests are required.' })
    }

    // Walk-in must have customer name
    if (isWalkIn && !customerName) {
      return res.status(400).json({ message: 'Customer name is required for walk-in bookings.' })
    }

    // Check restaurant exists
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: parseInt(restaurantId) }
    })
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found.' })
    }

    // Check table availability if tableId provided
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
        return res.status(400).json({ message: 'This table is already booked for the selected time.' })
      }
    }

    // FIX: Walk-in userId is optional (userId? in schema)
    const reservation = await prisma.reservation.create({
      data: {
        date,
        time,
        guests: parseInt(guests),
        status: isWalkIn ? 'confirmed' : 'pending',
        isWalkIn: isWalkIn || false,
        customerName: customerName || null,
        customerPhone: customerPhone || null,
        notes: notes || null,
        userId: isWalkIn ? null : req.user.id,
        restaurantId: parseInt(restaurantId),
        tableId: tableId ? parseInt(tableId) : null
      },
      include: {
        restaurant: true,
        user: true,
        table: true
      }
    })

    // Send confirmation email for non walk-in bookings
    if (!isWalkIn && reservation.user?.email) {
      await sendBookingConfirmation(
        reservation.user.email,
        reservation.user.name,
        reservation.restaurant.name,
        date,
        time,
        guests,
        reservation.id
      )
    }

    res.status(201).json({ message: 'Reservation created successfully.', reservation })
  } catch (error) {
    console.error('Create reservation error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── GET USER RESERVATIONS ────────────────────────────────
const getUserReservations = async (req, res) => {
  try {
    const { status } = req.query

    const where = {
      userId: req.user.id,
      isWalkIn: false
    }

    if (status) {
      where.status = status
    }

    const reservations = await prisma.reservation.findMany({
      where,
      include: {
        restaurant: {
          select: { id: true, name: true, location: true, logo: true, openingTime: true, closingTime: true }
        },
        table: {
          select: { id: true, tableNumber: true, capacity: true }
        }
      },
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
    const { status, date } = req.query

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: parseInt(restaurantId) }
    })

    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found.' })
    }

    // Admin can see all, owner only their own
    if (req.user.role !== 'admin' && restaurant.ownerId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized.' })
    }

    const where = { restaurantId: parseInt(restaurantId) }
    if (status) where.status = status
    if (date) where.date = date

    const reservations = await prisma.reservation.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        table: { select: { id: true, tableNumber: true, capacity: true } }
      },
      orderBy: [{ date: 'desc' }, { time: 'asc' }]
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
      return res.status(400).json({ message: `Invalid status. Allowed: ${allowedStatuses.join(', ')}` })
    }

    const existing = await prisma.reservation.findUnique({
      where: { id: parseInt(id) },
      include: { restaurant: true, user: true }
    })

    if (!existing) {
      return res.status(404).json({ message: 'Reservation not found.' })
    }

    const reservation = await prisma.reservation.update({
      where: { id: parseInt(id) },
      data: { status },
      include: {
        restaurant: true,
        user: { select: { id: true, name: true, email: true } },
        table: true
      }
    })

    // Send email to user on status change (not for walk-in)
    if (!reservation.isWalkIn && reservation.user?.email && ['confirmed', 'cancelled', 'completed'].includes(status)) {
      await sendStatusUpdateEmail(
        reservation.user.email,
        reservation.user.name,
        reservation.restaurant.name,
        reservation.date,
        reservation.time,
        status
      )
    }

    // If confirmed, mark table as reserved
    if (status === 'confirmed' && reservation.tableId) {
      await prisma.table.update({
        where: { id: reservation.tableId },
        data: { status: 'reserved' }
      })
    }

    // If cancelled/completed/no_show, free up the table
    if (['cancelled', 'completed', 'no_show'].includes(status) && reservation.tableId) {
      await prisma.table.update({
        where: { id: reservation.tableId },
        data: { status: 'available' }
      })
    }

    res.status(200).json({ message: 'Status updated successfully.', reservation })
  } catch (error) {
    console.error('Update status error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── CANCEL RESERVATION (USER) ────────────────────────────
const cancelReservation = async (req, res) => {
  try {
    const { id } = req.params

    const reservation = await prisma.reservation.findUnique({
      where: { id: parseInt(id) },
      include: { restaurant: true, user: true }
    })

    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found.' })
    }

    if (reservation.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized.' })
    }

    if (['cancelled', 'completed', 'no_show'].includes(reservation.status)) {
      return res.status(400).json({ message: 'This reservation cannot be cancelled.' })
    }

    await prisma.reservation.update({
      where: { id: parseInt(id) },
      data: { status: 'cancelled' }
    })

    // Free up table
    if (reservation.tableId) {
      await prisma.table.update({
        where: { id: reservation.tableId },
        data: { status: 'available' }
      })
    }

    // Send cancellation email
    if (reservation.user?.email) {
      await sendStatusUpdateEmail(
        reservation.user.email,
        reservation.user.name,
        reservation.restaurant.name,
        reservation.date,
        reservation.time,
        'cancelled'
      )
    }

    res.status(200).json({ message: 'Reservation cancelled.' })
  } catch (error) {
    console.error('Cancel reservation error:', error)
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

    // Auto-generate slots from opening to closing if none defined
    if (slots.length === 0) {
      const openHour = parseInt(restaurant.openingTime.split(':')[0])
      const closeHour = parseInt(restaurant.closingTime.split(':')[0])

      for (let i = openHour; i < closeHour; i++) {
        slots.push({ time: `${i.toString().padStart(2, '0')}:00`, capacity: 10, isActive: true })
        slots.push({ time: `${i.toString().padStart(2, '0')}:30`, capacity: 10, isActive: true })
      }
    }

    // If date provided, check booked capacity per slot
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
        booked: bookedCounts[slot.time] || 0,
        available: (slot.capacity || 10) - (bookedCounts[slot.time] || 0),
        isAvailable: ((slot.capacity || 10) - (bookedCounts[slot.time] || 0)) > 0
      }))
    }

    res.status(200).json({ timeSlots: slots })
  } catch (error) {
    console.error('Get time slots error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── RESTAURANT DASHBOARD (TODAY + UPCOMING) ──────────────
const getRestaurantDashboard = async (req, res) => {
  try {
    const { restaurantId } = req.params

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: parseInt(restaurantId) }
    })

    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found.' })
    }

    if (req.user.role !== 'admin' && restaurant.ownerId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized.' })
    }

    // Today's date in DD-MM-YYYY format
    const today = new Date()
    const todayStr = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`

    const [todaysBookings, upcomingBookings, stats] = await Promise.all([
      // Today's bookings
      prisma.reservation.findMany({
        where: { restaurantId: parseInt(restaurantId), date: todayStr },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          table: { select: { id: true, tableNumber: true } }
        },
        orderBy: { time: 'asc' }
      }),

      // Upcoming bookings (pending/confirmed)
      prisma.reservation.findMany({
        where: {
          restaurantId: parseInt(restaurantId),
          status: { in: ['pending', 'confirmed'] }
        },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          table: { select: { id: true, tableNumber: true } }
        },
        orderBy: [{ date: 'asc' }, { time: 'asc' }],
        take: 20
      }),

      // Stats
      Promise.all([
        prisma.reservation.count({ where: { restaurantId: parseInt(restaurantId), date: todayStr } }),
        prisma.reservation.count({ where: { restaurantId: parseInt(restaurantId), status: 'pending' } }),
        prisma.reservation.count({ where: { restaurantId: parseInt(restaurantId), status: 'confirmed' } }),
        prisma.table.count({ where: { restaurantId: parseInt(restaurantId) } }),
        prisma.table.count({ where: { restaurantId: parseInt(restaurantId), status: 'available' } })
      ])
    ])

    const [todayTotal, pendingCount, confirmedCount, totalTables, availableTables] = stats

    res.status(200).json({
      today: {
        date: todayStr,
        bookings: todaysBookings,
        total: todayTotal
      },
      upcoming: upcomingBookings,
      stats: {
        todayTotal,
        pendingCount,
        confirmedCount,
        totalTables,
        availableTables,
        occupiedTables: totalTables - availableTables
      }
    })
  } catch (error) {
    console.error('Get dashboard error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

module.exports = {
  createReservation,
  getUserReservations,
  getRestaurantReservations,
  updateReservationStatus,
  cancelReservation,
  getTimeSlots,
  getRestaurantDashboard
}