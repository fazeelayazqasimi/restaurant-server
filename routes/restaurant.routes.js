const express = require('express')
const router = express.Router()
const {
  getRestaurants,
  getRestaurantById,
  getMyRestaurant,
  updateRestaurant,
  createRestaurant,
  uploadImages,
  approveRestaurant,
  getPendingRestaurants
} = require('../controllers/restaurant.controller')
const { protect, restrictTo } = require('../middleware/auth')
const upload = require('../middleware/upload')

// Public
router.get('/', getRestaurants)
router.get('/:id', getRestaurantById)

// Owner
router.get('/my/restaurants', protect, restrictTo('restaurant', 'admin'), getMyRestaurant)
router.put('/:id', protect, restrictTo('restaurant', 'admin'), upload.single('logo'), updateRestaurant)
router.post('/:id/images', protect, restrictTo('restaurant', 'admin'), upload.array('images', 10), uploadImages)

// Admin
router.get('/admin/pending', protect, restrictTo('admin'), getPendingRestaurants)
router.post('/', protect, restrictTo('admin'), upload.single('logo'), createRestaurant)
router.put('/:id/approve', protect, restrictTo('admin'), approveRestaurant)

module.exports = router