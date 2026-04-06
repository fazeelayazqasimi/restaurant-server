const express = require('express')
const router = express.Router()
const {
  createReservation,
  getUserReservations,
  getRestaurantReservations,
  updateReservationStatus,
  cancelReservation,
  getTimeSlots,
  getRestaurantDashboard
} = require('../controllers/reservation.controller')
const { protect, restrictTo } = require('../middleware/auth')

// User routes
router.post('/', protect, createReservation)
router.get('/user', protect, getUserReservations)
router.put('/:id/cancel', protect, cancelReservation)

// Restaurant owner routes
router.get('/restaurant/:restaurantId', protect, restrictTo('restaurant', 'admin'), getRestaurantReservations)
router.get('/dashboard/:restaurantId', protect, restrictTo('restaurant', 'admin'), getRestaurantDashboard)
router.put('/:id/status', protect, restrictTo('restaurant', 'admin'), updateReservationStatus)

// Public
router.get('/timeslots/:restaurantId', getTimeSlots)

module.exports = router