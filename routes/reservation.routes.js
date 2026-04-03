const express = require('express')
const router = express.Router()
const { createReservation, getUserReservations, getRestaurantReservations, updateReservationStatus, getTimeSlots } = require('../controllers/reservation.controller')
const { protect, restrictTo } = require('../middleware/auth')

router.post('/', protect, createReservation)
router.get('/user', protect, getUserReservations)
router.get('/restaurant/:restaurantId', protect, restrictTo('restaurant', 'admin'), getRestaurantReservations)
router.put('/:id/status', protect, updateReservationStatus)
router.get('/timeslots/:restaurantId', getTimeSlots)

module.exports = router