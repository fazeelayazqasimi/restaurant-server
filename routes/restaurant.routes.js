const express = require('express')
const router = express.Router()
const { getRestaurants, getRestaurantById, createRestaurant, uploadImages, approveRestaurant, getPendingRestaurants } = require('../controllers/restaurant.controller')
const { protect, restrictTo } = require('../middleware/auth')
const upload = require('../middleware/upload')

router.get('/', getRestaurants)
router.get('/pending', protect, restrictTo('admin'), getPendingRestaurants)
router.get('/:id', getRestaurantById)
router.post('/', protect, restrictTo('admin'), upload.single('logo'), createRestaurant)
router.post('/:id/images', protect, upload.array('images', 10), uploadImages)
router.put('/:id/approve', protect, restrictTo('admin'), approveRestaurant)

module.exports = router