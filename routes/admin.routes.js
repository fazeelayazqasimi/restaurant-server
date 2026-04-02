const express = require('express')
const router = express.Router()
const {
  getAllUsers,
  getAllRestaurantOwners,
  deleteUser,
  getAllRestaurants,
  deleteRestaurant,
  createRestaurant,
  getDashboardStats
} = require('../controllers/admin.controller')
const { protect, restrictTo } = require('../middleware/auth')

// ─── Dashboard ────────────────────────────────────────────
// GET /api/admin/stats
router.get('/stats', protect, restrictTo('admin'), getDashboardStats)

// ─── Users (role: user) ───────────────────────────────────
// GET /api/admin/users
router.get('/users', protect, restrictTo('admin'), getAllUsers)

// DELETE /api/admin/users/:id
router.delete('/users/:id', protect, restrictTo('admin'), deleteUser)

// ─── Restaurant Owners (role: restaurant) ─────────────────
// GET /api/admin/owners
router.get('/owners', protect, restrictTo('admin'), getAllRestaurantOwners)

// ─── Restaurants ──────────────────────────────────────────
// GET /api/admin/restaurants
router.get('/restaurants', protect, restrictTo('admin'), getAllRestaurants)

// DELETE /api/admin/restaurants/:id
router.delete('/restaurants/:id', protect, restrictTo('admin'), deleteRestaurant)

// POST /api/admin/restaurants
router.post('/restaurants', protect, restrictTo('admin'), createRestaurant)

module.exports = router