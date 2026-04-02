const prisma = require('../config/prisma')
const nodemailer = require('nodemailer')

// ─── Email Transporter ────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
})

// ─── Format date to DD-MM-YYYY ────────────────────────────
const formatDate = (dateStr) => {
  if (!dateStr) return dateStr
  // If already DD-MM-YYYY return as is
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) return dateStr
  // If YYYY-MM-DD convert to DD-MM-YYYY
  const parts = dateStr.split('-')
  if (parts[0].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`
  }
  return dateStr
}

// ─── Send Booking Email ───────────────────────────────────
const sendBookingEmail = async ({ to, name, restaurantName, date, time, guests, status, reservationId }) => {
  try {
    const statusMessages = {
      pending: 'Your reservation is pending confirmation.',
      confirmed: 'Your reservation has been confirmed!',
      cancelled: 'Your reservation has been cancelled.',
      completed: 'Your visit has been marked as completed. Thank you!',
      no_show: 'You were marked as no-show for your reservation.',
      rejected: 'Unfortunately, your reservation has been rejected.'
    }

    const subject = status === 'pending'
      ? `Booking Received - ${restaurantName}`
      : `Booking ${status.charAt(0).toUpperCase() + status.slice(1)} - ${restaurantName}`

    await transporter.sendMail({
      from: `"Restaurant Reservations" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Hello ${name},</h2>
          <p>${statusMessages[status] || 'Your reservation status has been updated.'}</p>
          <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 12px; color: #555;">Reservation Details</h3>
            <p style="margin: 4px 0;"><strong>Reservation ID:</strong> #${reservationId}</p>
            <p style="margin: 4px 0;"><strong>Restaurant:</strong> ${restaurantName}</p>
            <p style="margin: 4px 0;"><strong>Date:</strong> ${formatDate(date)}</p>
            <p style="margin: 4px 0;"><strong>Time:</strong> ${time}</p>
            <p style="margin: 4px 0;"><strong>Guests:</strong> ${guests}</p>
            <p style="margin: 4px 0;"><strong>Status:</strong> <span style="text-transform: capitalize; font-weight: bold;">${status}</span></p>
          </div>
          <p style="color: #888; font-size: 13px;">If you have any questions, please contact the restaurant directly.</p>
        </div>
      `
    })
  } catch (error) {
    console.error('Email send error:', error)
    // Email failure should not block the API response
  }
}

// ─── CREATE RESERVATION ───────────────────────────────────
const createReservation = async (req, res) => {
  try {
    const { restaurantId, date, time, guests, tableId, notes } = req.body

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

    const formattedDate = formatDate(date)

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
          date: formattedDate,
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
        date: formattedDate,
        time,
        guests: parseInt(guests),
        status: 'pending',
        notes: notes || null,
        isWalkIn: false,
        tableId: tableId ? parseInt(tableId) : null
      },
      include: {
        restaurant: {
          select: { id: true, name: true, location: true }
        },
        table: true,
        user: {
          select: { name: true, email: true }
        }
      }
    })

    // Send confirmation email
    await sendBookingEmail({
      to: reservation.user.email,
      name: reservation.user.name,
      restaurantName: reservation.restaurant.name,
      date: reservation.date,
      time: reservation.time,
      guests: reservation.guests,
      status: 'pending',
      reservationId: reservation.id
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

// ─── WALK-IN RESERVATION (Restaurant Owner) ──────────────
const createWalkInReservation = async (req, res) => {
  try {
    const { restaurantId, tableId, guests, notes, guestName, guestPhone } = req.body

    if (!restaurantId || !guests) {
      return res.status(400).json({ message: 'Restaurant and guests are required.' })
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: parseInt(restaurantId) }
    })

    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found.' })
    }

    if (restaurant.ownerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized.' })
    }

    const now = new Date()
    const day = String(now.getDate()).padStart(2, '0')
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const year = now.getFullYear()
    const todayFormatted = `${day}-${month}-${year}`
    const currentTime = now.toTimeString().slice(0, 5)

    // Update table status if tableId provided
    if (tableId) {
      await prisma.table.update({
        where: { id: parseInt(tableId) },
        data: { status: 'occupied', isAvailable: false }
      })
    }

    const reservation = await prisma.reservation.create({
      data: {
        userId: req.user.id,
        restaurantId: parseInt(restaurantId),
        date: todayFormatted,
        time: currentTime,
        guests: parseInt(guests),
        status: 'confirmed',
        notes: notes ? `Walk-in | Guest: ${guestName || 'N/A'} | Phone: ${guestPhone || 'N/A'} | ${notes}` : `Walk-in | Guest: ${guestName || 'N/A'} | Phone: ${guestPhone || 'N/A'}`,
        isWalkIn: true,
        tableId: tableId ? parseInt(tableId) : null
      },
      include: {
        restaurant: { select: { id: true, name: true, location: true } },
        table: true
      }
    })

    res.status(201).json({
      message: 'Walk-in reservation created successfully.',
      reservation
    })
  } catch (error) {
    console.error('Walk-in reservation error:', error)
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

    // Format dates
    const formatted = reservations.map(r => ({
      ...r,
      date: formatDate(r.date)
    }))

    res.status(200).json({ reservations: formatted })
  } catch (error) {
    console.error('Get user reservations error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── GET RESTAURANT RESERVATIONS ──────────────────────────
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

    if (restaurant.ownerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized.' })
    }

    const where = { restaurantId: parseInt(restaurantId) }
    if (status) where.status = status
    if (date) where.date = formatDate(date)

    const reservations = await prisma.reservation.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true }
        },
        table: true
      },
      orderBy: { createdAt: 'desc' }
    })

    const formatted = reservations.map(r => ({
      ...r,
      date: formatDate(r.date)
    }))

    res.status(200).json({ reservations: formatted })
  } catch (error) {
    console.error('Get restaurant reservations error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── GET TODAY'S RESERVATIONS (RMD Dashboard) ─────────────
const getTodayReservations = async (req, res) => {
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

    const now = new Date()
    const day = String(now.getDate()).padStart(2, '0')
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const year = now.getFullYear()
    const todayFormatted = `${day}-${month}-${year}`

    const reservations = await prisma.reservation.findMany({
      where: {
        restaurantId: parseInt(restaurantId),
        date: todayFormatted
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true }
        },
        table: true
      },
      orderBy: { time: 'asc' }
    })

    const summary = {
      total: reservations.length,
      pending: reservations.filter(r => r.status === 'pending').length,
      confirmed: reservations.filter(r => r.status === 'confirmed').length,
      completed: reservations.filter(r => r.status === 'completed').length,
      cancelled: reservations.filter(r => r.status === 'cancelled').length,
      no_show: reservations.filter(r => r.status === 'no_show').length
    }

    res.status(200).json({ reservations, summary, date: todayFormatted })
  } catch (error) {
    console.error('Get today reservations error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── UPDATE RESERVATION STATUS ────────────────────────────
const updateReservationStatus = async (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body

    const allowedStatuses = ['pending', 'confirmed', 'cancelled', 'completed', 'no_show', 'rejected']
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Allowed: pending, confirmed, cancelled, completed, no_show, rejected' })
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: parseInt(id) },
      include: {
        restaurant: true,
        user: { select: { name: true, email: true } }
      }
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

    // If cancelled or completed, free up the table
    if ((status === 'cancelled' || status === 'completed' || status === 'no_show') && reservation.tableId) {
      await prisma.table.update({
        where: { id: reservation.tableId },
        data: { status: 'available', isAvailable: true }
      })
    }

    // If confirmed, mark table as reserved
    if (status === 'confirmed' && reservation.tableId) {
      await prisma.table.update({
        where: { id: reservation.tableId },
        data: { status: 'reserved', isAvailable: false }
      })
    }

    // Send status update email
    await sendBookingEmail({
      to: reservation.user.email,
      name: reservation.user.name,
      restaurantName: reservation.restaurant.name,
      date: reservation.date,
      time: reservation.time,
      guests: reservation.guests,
      status,
      reservationId: reservation.id
    })

    res.status(200).json({ message: `Reservation ${status}.`, reservation: updated })
  } catch (error) {
    console.error('Update reservation error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── CANCEL RESERVATION (User) ────────────────────────────
const cancelReservation = async (req, res) => {
  try {
    const { id } = req.params

    const reservation = await prisma.reservation.findUnique({
      where: { id: parseInt(id) },
      include: {
        restaurant: { select: { name: true } },
        user: { select: { name: true, email: true } }
      }
    })

    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found.' })
    }

    if (reservation.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized.' })
    }

    if (['completed', 'no_show'].includes(reservation.status)) {
      return res.status(400).json({ message: 'Cannot cancel a completed or no-show reservation.' })
    }

    const updated = await prisma.reservation.update({
      where: { id: parseInt(id) },
      data: { status: 'cancelled' }
    })

    // Free up table
    if (reservation.tableId) {
      await prisma.table.update({
        where: { id: reservation.tableId },
        data: { status: 'available', isAvailable: true }
      })
    }

    // Send cancellation email
    await sendBookingEmail({
      to: reservation.user.email,
      name: reservation.user.name,
      restaurantName: reservation.restaurant.name,
      date: reservation.date,
      time: reservation.time,
      guests: reservation.guests,
      status: 'cancelled',
      reservationId: reservation.id
    })

    res.status(200).json({ message: 'Reservation cancelled.', reservation: updated })
  } catch (error) {
    console.error('Cancel reservation error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── GET ALL RESERVATIONS (Admin) ─────────────────────────
const getAllReservations = async (req, res) => {
  try {
    const { status } = req.query

    const where = {}
    if (status) where.status = status

    const reservations = await prisma.reservation.findMany({
      where,
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

    const formatted = reservations.map(r => ({
      ...r,
      date: formatDate(r.date)
    }))

    res.status(200).json({ reservations: formatted })
  } catch (error) {
    console.error('Get all reservations error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

module.exports = {
  createReservation,
  createWalkInReservation,
  getUserReservations,
  getRestaurantReservations,
  getTodayReservations,
  updateReservationStatus,
  cancelReservation,
  getAllReservations
}