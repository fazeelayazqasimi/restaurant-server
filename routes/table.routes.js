const express = require('express')
const router = express.Router()
const {
  addTable,
  getTablesByRestaurant,
  updateTable,
  deleteTable,
  getAvailableTables
} = require('../controllers/table.controller')
const { protect, restrictTo } = require('../middleware/auth')

// GET /api/tables/restaurant/:restaurantId (Public)
router.get('/restaurant/:restaurantId', getTablesByRestaurant)

// GET /api/tables/available/:restaurantId?date=&time= (User)
router.get('/available/:restaurantId', protect, getAvailableTables)

// POST /api/tables (Owner/Admin)
router.post('/', protect, restrictTo('restaurant', 'admin'), addTable)

// PUT /api/tables/:id (Owner/Admin)
router.put('/:id', protect, restrictTo('restaurant', 'admin'), updateTable)

// DELETE /api/tables/:id (Owner/Admin)
router.delete('/:id', protect, restrictTo('restaurant', 'admin'), deleteTable)

module.exports = router