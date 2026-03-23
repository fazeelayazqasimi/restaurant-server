const express = require('express')
const router = express.Router()
const {
  getAllRestaurants,
  getRestaurantById,
  createRestaurant,
  updateRestaurant,
  approveRestaurant,
  getMyRestaurants
} = require('../controllers/restaurant.controller')
const { protect, restrictTo } = require('../middleware/auth')

// ─── Public Routes ────────────────────────────────────────
// GET /api/restaurants
router.get('/', getAllRestaurants)

// GET /api/restaurants/:id
router.get('/:id', getRestaurantById)

// ─── Protected Routes ─────────────────────────────────────
// POST /api/restaurants (Restaurant owner only)
router.post('/', protect, restrictTo('restaurant', 'admin'), createRestaurant)

// PUT /api/restaurants/:id (Owner or Admin)
router.put('/:id', protect, restrictTo('restaurant', 'admin'), updateRestaurant)

// GET /api/restaurants/my/list (Owner only)
router.get('/my/list', protect, restrictTo('restaurant', 'admin'), getMyRestaurants)

// ─── Admin Routes ─────────────────────────────────────────
// PUT /api/restaurants/:id/approve (Admin only)
router.put('/:id/approve', protect, restrictTo('admin'), approveRestaurant)

module.exports = router