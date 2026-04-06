const express = require('express')
const router = express.Router()
const {
  addTable,
  getTablesByRestaurant,
  updateTableStatus,
  updateTable,
  deleteTable,
  getAvailableTables,
  addTimeSlot,
  getTimeSlotsByRestaurant,
  deleteTimeSlot
} = require('../controllers/table.controller')
const { protect, restrictTo } = require('../middleware/auth')

// Table routes
router.get('/restaurant/:restaurantId', getTablesByRestaurant)
router.get('/available/:restaurantId', getAvailableTables)
router.post('/', protect, restrictTo('restaurant', 'admin'), addTable)
router.put('/:id/status', protect, restrictTo('restaurant', 'admin'), updateTableStatus)
router.put('/:id', protect, restrictTo('restaurant', 'admin'), updateTable)
router.delete('/:id', protect, restrictTo('restaurant', 'admin'), deleteTable)

// Time slot routes
router.get('/timeslots/restaurant/:restaurantId', getTimeSlotsByRestaurant)
router.post('/timeslots', protect, restrictTo('restaurant', 'admin'), addTimeSlot)
router.delete('/timeslots/:id', protect, restrictTo('restaurant', 'admin'), deleteTimeSlot)

module.exports = router