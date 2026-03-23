const prisma = require('../config/prisma')

// ─── ADD TABLE (Restaurant Owner) ────────────────────────
const addTable = async (req, res) => {
  try {
    const { restaurantId, tableNumber, capacity } = req.body

    if (!restaurantId || !tableNumber || !capacity) {
      return res.status(400).json({ message: 'Restaurant, table number and capacity are required.' })
    }

    // Check ownership
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: parseInt(restaurantId) }
    })

    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found.' })
    }

    if (restaurant.ownerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized.' })
    }

    const table = await prisma.table.create({
      data: {
        tableNumber,
        capacity: parseInt(capacity),
        isAvailable: true,
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
        _count: {
          select: { reservations: true }
        }
      },
      orderBy: { tableNumber: 'asc' }
    })

    const total = tables.length
    const available = tables.filter(t => t.isAvailable).length
    const booked = total - available

    res.status(200).json({
      tables,
      summary: { total, available, booked }
    })
  } catch (error) {
    console.error('Get tables error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── UPDATE TABLE (Owner) ─────────────────────────────────
const updateTable = async (req, res) => {
  try {
    const { id } = req.params
    const { tableNumber, capacity, isAvailable } = req.body

    const table = await prisma.table.findUnique({
      where: { id: parseInt(id) },
      include: { restaurant: true }
    })

    if (!table) {
      return res.status(404).json({ message: 'Table not found.' })
    }

    if (table.restaurant.ownerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized.' })
    }

    const updated = await prisma.table.update({
      where: { id: parseInt(id) },
      data: {
        tableNumber: tableNumber || table.tableNumber,
        capacity: capacity ? parseInt(capacity) : table.capacity,
        isAvailable: isAvailable !== undefined ? isAvailable : table.isAvailable
      }
    })

    res.status(200).json({ message: 'Table updated.', table: updated })
  } catch (error) {
    console.error('Update table error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── DELETE TABLE (Owner) ─────────────────────────────────
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

    if (table.restaurant.ownerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized.' })
    }

    // Remove tableId from reservations first
    await prisma.reservation.updateMany({
      where: { tableId: parseInt(id) },
      data: { tableId: null }
    })

    await prisma.table.delete({
      where: { id: parseInt(id) }
    })

    res.status(200).json({ message: 'Table deleted.' })
  } catch (error) {
    console.error('Delete table error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

// ─── GET AVAILABLE TABLES (User booking) ─────────────────
const getAvailableTables = async (req, res) => {
  try {
    const { restaurantId } = req.params
    const { date, time } = req.query

    if (!date || !time) {
      return res.status(400).json({ message: 'Date and time are required.' })
    }

    // Find tables already booked at this date/time
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

    // Get all available tables excluding booked ones
    const tables = await prisma.table.findMany({
      where: {
        restaurantId: parseInt(restaurantId),
        isAvailable: true,
        id: { notIn: bookedTableIds.length > 0 ? bookedTableIds : [-1] }
      },
      orderBy: { tableNumber: 'asc' }
    })

    res.status(200).json({ tables })
  } catch (error) {
    console.error('Get available tables error:', error)
    res.status(500).json({ message: 'Server error.' })
  }
}

module.exports = {
  addTable,
  getTablesByRestaurant,
  updateTable,
  deleteTable,
  getAvailableTables
}