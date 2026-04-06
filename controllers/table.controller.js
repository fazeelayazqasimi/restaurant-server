const prisma = require('../config/prisma')

// ─── ADD TABLE ────────────────────────────────────────────
const addTable = async (req, res) => {
  try {
    const { restaurantId, tableNumber, capacity } = req.body

    if (!restaurantId || !tableNumber || !capacity) {
      return res.status(400).json({ message: 'restaurantId, tableNumber and capacity are required.' })
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: parseInt(restaurantId) }
    })

    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found.' })
    }

    if (req.user.role !== 'admin' && restaurant.ownerId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized.' })
    }

    // Check duplicate table number in same restaurant
    const existing = await prisma.table.findFirst({
      where: { restaurantId: parseInt(restaurantId), tableNumber: tableNumber.toString() }
    })
    if (existing) {
      return res.status(400).json({ message: `Table number ${tableNumber} already exists in this restaurant.` })
    }

    const table = await prisma.table.create({
      data: {
        tableNumber: tableNumber.toString(),
        capacity: parseInt(capacity),
        status: 'available',   // FIX: was isAvailable:true — now uses status enum
        restaurantId: parseInt(restaurantId)
      }
    })

    res.status(201).json({ message: 'Table added successfully.', table })
  } catch (error) {
    console.error('Add table error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── GET TABLES BY RESTAURANT ─────────────────────────────
const getTablesByRestaurant = async (req, res) => {
  try {
    const { restaurantId } = req.params

    const tables = await prisma.table.findMany({
      where: { restaurantId: parseInt(restaurantId) },
      include: {
        _count: { select: { reservations: true } }
      },
      orderBy: { tableNumber: 'asc' }
    })

    const total = tables.length
    const available = tables.filter(t => t.status === 'available').length
    const reserved = tables.filter(t => t.status === 'reserved').length
    const occupied = tables.filter(t => t.status === 'occupied').length

    res.status(200).json({
      tables,
      summary: { total, available, reserved, occupied }
    })
  } catch (error) {
    console.error('Get tables error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── UPDATE TABLE STATUS ──────────────────────────────────
const updateTableStatus = async (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body

    const allowedStatuses = ['available', 'reserved', 'occupied']
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Allowed: ${allowedStatuses.join(', ')}` })
    }

    const table = await prisma.table.findUnique({
      where: { id: parseInt(id) },
      include: { restaurant: true }
    })

    if (!table) {
      return res.status(404).json({ message: 'Table not found.' })
    }

    if (req.user.role !== 'admin' && table.restaurant.ownerId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized.' })
    }

    const updated = await prisma.table.update({
      where: { id: parseInt(id) },
      data: { status }
    })

    res.status(200).json({ message: 'Table status updated.', table: updated })
  } catch (error) {
    console.error('Update table status error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── UPDATE TABLE (number, capacity) ─────────────────────
const updateTable = async (req, res) => {
  try {
    const { id } = req.params
    const { tableNumber, capacity, status } = req.body

    const table = await prisma.table.findUnique({
      where: { id: parseInt(id) },
      include: { restaurant: true }
    })

    if (!table) {
      return res.status(404).json({ message: 'Table not found.' })
    }

    if (req.user.role !== 'admin' && table.restaurant.ownerId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized.' })
    }

    const allowedStatuses = ['available', 'reserved', 'occupied']
    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Allowed: ${allowedStatuses.join(', ')}` })
    }

    const updated = await prisma.table.update({
      where: { id: parseInt(id) },
      data: {
        ...(tableNumber && { tableNumber: tableNumber.toString() }),
        ...(capacity && { capacity: parseInt(capacity) }),
        ...(status && { status })
      }
    })

    res.status(200).json({ message: 'Table updated.', table: updated })
  } catch (error) {
    console.error('Update table error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── DELETE TABLE ─────────────────────────────────────────
const deleteTable = async (req, res) => {
  try {
    const { id } = req.params

    const table = await prisma.table.findUnique({
      where: { id: parseInt(id) },
      include: { restaurant: true }
    })

    if (!table) {
      return res.status(404).json({ message: 'Table not found.' })
    }

    if (req.user.role !== 'admin' && table.restaurant.ownerId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized.' })
    }

    // Detach table from reservations first
    await prisma.reservation.updateMany({
      where: { tableId: parseInt(id) },
      data: { tableId: null }
    })

    await prisma.table.delete({ where: { id: parseInt(id) } })

    res.status(200).json({ message: 'Table deleted.' })
  } catch (error) {
    console.error('Delete table error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── GET AVAILABLE TABLES (for booking) ───────────────────
const getAvailableTables = async (req, res) => {
  try {
    const { restaurantId } = req.params
    const { date, time, guests } = req.query

    if (!date || !time) {
      return res.status(400).json({ message: 'date and time are required.' })
    }

    // Find table IDs already booked at this date/time
    const bookedReservations = await prisma.reservation.findMany({
      where: {
        restaurantId: parseInt(restaurantId),
        date,
        time,
        status: { in: ['pending', 'confirmed'] },
        tableId: { not: null }
      },
      select: { tableId: true }
    })

    const bookedTableIds = bookedReservations.map(r => r.tableId)

    const where = {
      restaurantId: parseInt(restaurantId),
      status: 'available',
      ...(bookedTableIds.length > 0 && { id: { notIn: bookedTableIds } }),
      ...(guests && { capacity: { gte: parseInt(guests) } })
    }

    const tables = await prisma.table.findMany({
      where,
      orderBy: { tableNumber: 'asc' }
    })

    res.status(200).json({ tables })
  } catch (error) {
    console.error('Get available tables error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── ADD TIME SLOT ────────────────────────────────────────
const addTimeSlot = async (req, res) => {
  try {
    const { restaurantId, time, capacity } = req.body

    if (!restaurantId || !time) {
      return res.status(400).json({ message: 'restaurantId and time are required.' })
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: parseInt(restaurantId) }
    })

    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found.' })
    }

    if (req.user.role !== 'admin' && restaurant.ownerId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized.' })
    }

    // Check for duplicate time slot
    const existing = await prisma.timeSlot.findFirst({
      where: { restaurantId: parseInt(restaurantId), time }
    })
    if (existing) {
      return res.status(400).json({ message: 'Time slot already exists.' })
    }

    const slot = await prisma.timeSlot.create({
      data: {
        restaurantId: parseInt(restaurantId),
        time,
        capacity: capacity ? parseInt(capacity) : 10,
        isActive: true
      }
    })

    res.status(201).json({ message: 'Time slot added.', slot })
  } catch (error) {
    console.error('Add time slot error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── GET TIME SLOTS BY RESTAURANT ────────────────────────
const getTimeSlotsByRestaurant = async (req, res) => {
  try {
    const { restaurantId } = req.params

    const slots = await prisma.timeSlot.findMany({
      where: { restaurantId: parseInt(restaurantId) },
      orderBy: { time: 'asc' }
    })

    res.status(200).json({ timeSlots: slots })
  } catch (error) {
    console.error('Get time slots error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── DELETE TIME SLOT ─────────────────────────────────────
const deleteTimeSlot = async (req, res) => {
  try {
    const { id } = req.params

    const slot = await prisma.timeSlot.findUnique({
      where: { id: parseInt(id) },
      include: { restaurant: true }
    })

    if (!slot) {
      return res.status(404).json({ message: 'Time slot not found.' })
    }

    if (req.user.role !== 'admin' && slot.restaurant.ownerId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized.' })
    }

    await prisma.timeSlot.delete({ where: { id: parseInt(id) } })

    res.status(200).json({ message: 'Time slot deleted.' })
  } catch (error) {
    console.error('Delete time slot error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

module.exports = {
  addTable,
  getTablesByRestaurant,
  updateTableStatus,
  updateTable,
  deleteTable,
  getAvailableTables,
  addTimeSlot,
  getTimeSlotsByRestaurant,
  deleteTimeSlot
}