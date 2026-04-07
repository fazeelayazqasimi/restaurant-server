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

// ─── USER ROUTES ──────────────────────────────────────────
router.post('/', protect, createReservation)
router.get('/user', protect, getUserReservations)
router.put('/:id/cancel', protect, cancelReservation)

// ─── RESTAURANT OWNER ROUTES ──────────────────────────────
// Fix: /restaurant (no ID) — gets reservations for logged-in owner's restaurant
router.get('/restaurant', protect, restrictTo('restaurant', 'admin'), async (req, res, next) => {
  const prisma = require('../config/prisma')
  try {
    const restaurant = await prisma.restaurant.findFirst({
      where: { ownerId: req.user.id }
    })
    if (!restaurant) {
      return res.status(404).json({ message: 'No restaurant found for this owner.' })
    }
    req.params.restaurantId = restaurant.id.toString()
    next()
  } catch (err) {
    next(err)
  }
}, getRestaurantReservations)

router.get('/restaurant/:restaurantId', protect, restrictTo('restaurant', 'admin'), getRestaurantReservations)
router.get('/dashboard/:restaurantId', protect, restrictTo('restaurant', 'admin'), getRestaurantDashboard)

// Fix: PATCH support alongside PUT for status update
router.put('/:id/status', protect, restrictTo('restaurant', 'admin'), updateReservationStatus)
router.patch('/:id/status', protect, restrictTo('restaurant', 'admin'), updateReservationStatus)

// ─── PUBLIC ───────────────────────────────────────────────
router.get('/timeslots/:restaurantId', getTimeSlots)

module.exports = router