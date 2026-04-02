const express = require('express')
const router = express.Router()
const {
  createReservation,
  createWalkInReservation,
  getUserReservations,
  getRestaurantReservations,
  getTodayReservations,
  updateReservationStatus,
  cancelReservation,
  getAllReservations
} = require('../controllers/reservation.controller')
const { protect, restrictTo } = require('../middleware/auth')

// POST /api/reservations (User only)
router.post('/', protect, restrictTo('user'), createReservation)

// POST /api/reservations/walk-in (Restaurant owner only)
router.post('/walk-in', protect, restrictTo('restaurant', 'admin'), createWalkInReservation)

// GET /api/reservations/user (User - my bookings)
router.get('/user', protect, restrictTo('user'), getUserReservations)

// GET /api/reservations/all (Admin only)
router.get('/all', protect, restrictTo('admin'), getAllReservations)

// GET /api/reservations/restaurant/:restaurantId (Owner only)
router.get('/restaurant/:restaurantId', protect, restrictTo('restaurant', 'admin'), getRestaurantReservations)

// GET /api/reservations/today/:restaurantId (RMD Dashboard - Owner only)
router.get('/today/:restaurantId', protect, restrictTo('restaurant', 'admin'), getTodayReservations)

// PUT /api/reservations/:id/status (Owner/Admin - update status)
router.put('/:id/status', protect, restrictTo('restaurant', 'admin'), updateReservationStatus)

// PUT /api/reservations/:id/cancel (User - cancel own booking)
router.put('/:id/cancel', protect, restrictTo('user'), cancelReservation)

module.exports = router