const express = require('express')
const router = express.Router()
const {
  createReservation,
  getUserReservations,
  getRestaurantReservations,
  updateReservationStatus,
  getAllReservations
} = require('../controllers/reservation.controller')
const { protect, restrictTo } = require('../middleware/auth')

// POST /api/reservations (User only)
router.post('/', protect, restrictTo('user'), createReservation)

// GET /api/reservations/user (User - my bookings)
router.get('/user', protect, restrictTo('user'), getUserReservations)

// GET /api/reservations/restaurant/:restaurantId (Owner only)
router.get('/restaurant/:restaurantId', protect, restrictTo('restaurant', 'admin'), getRestaurantReservations)

// PUT /api/reservations/:id (Owner/Admin - confirm or reject)
router.put('/:id', protect, restrictTo('restaurant', 'admin'), updateReservationStatus)

// GET /api/reservations/all (Admin only)
router.get('/all', protect, restrictTo('admin'), getAllReservations)

module.exports = router