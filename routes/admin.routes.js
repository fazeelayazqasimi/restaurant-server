const express = require('express')
const router = express.Router()
const {
  getAllUsers,
  deleteUser,
  getAllRestaurants,
  deleteRestaurant,
  createRestaurant
} = require('../controllers/admin.controller')
const { protect, restrictTo } = require('../middleware/auth')

// ─── Users ────────────────────────────────────────────────
router.get('/users', protect, restrictTo('admin'), getAllUsers)
router.delete('/users/:id', protect, restrictTo('admin'), deleteUser)

// ─── Restaurants ──────────────────────────────────────────
router.get('/restaurants', protect, restrictTo('admin'), getAllRestaurants)
router.delete('/restaurants/:id', protect, restrictTo('admin'), deleteRestaurant)
router.post('/restaurants', protect, restrictTo('admin'), createRestaurant)

module.exports = router