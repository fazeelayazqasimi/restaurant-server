const express = require('express')
const router = express.Router()
const {
  getDashboardStats,
  getAllUsers,
  getAllRestaurantOwners,
  deleteUser,
  getAllRestaurants,
  deleteRestaurant,
  createRestaurant,
  approveRestaurant,
  rejectRestaurant,
  getPendingRestaurants,
  getAllReservations
} = require('../controllers/admin.controller')
const { protect, restrictTo } = require('../middleware/auth')

// All admin routes protected
router.use(protect, restrictTo('admin'))

// Dashboard
router.get('/stats', getDashboardStats)

// Users
router.get('/users', getAllUsers)
router.delete('/users/:id', deleteUser)

// Restaurant Owners (separate from users)
router.get('/owners', getAllRestaurantOwners)

// Restaurants
router.get('/restaurants', getAllRestaurants)
router.post('/restaurants', createRestaurant)
router.delete('/restaurants/:id', deleteRestaurant)
router.get('/restaurants/pending', getPendingRestaurants)
router.put('/restaurants/:id/approve', approveRestaurant)
router.delete('/restaurants/:id/reject', rejectRestaurant)

// Reservations
router.get('/reservations', getAllReservations)

module.exports = router