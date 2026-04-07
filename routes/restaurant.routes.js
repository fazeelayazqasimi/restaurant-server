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
const {
  addTable,
  getTablesByRestaurant,
  updateTableStatus,
  updateTable,
  deleteTable,
  getAvailableTables,
  addTimeSlot,
  getTimeSlotsByRestaurant,
  deleteTimeSlot
} = require('../controllers/table.controller')
const { protect, restrictTo } = require('../middleware/auth')
const upload = require('../middleware/upload')

// ─── PUBLIC ───────────────────────────────────────────────
router.get('/', getRestaurants)
router.get('/:id', getRestaurantById)

// ─── OWNER ────────────────────────────────────────────────
router.get('/my/restaurants', protect, restrictTo('restaurant', 'admin'), getMyRestaurant)
router.put('/:id', protect, restrictTo('restaurant', 'admin'), upload.single('logo'), updateRestaurant)
router.post('/:id/images', protect, restrictTo('restaurant', 'admin'), upload.array('images', 10), uploadImages)

// ─── ADMIN ────────────────────────────────────────────────
router.get('/admin/pending', protect, restrictTo('admin'), getPendingRestaurants)
router.post('/', protect, restrictTo('admin'), upload.single('logo'), createRestaurant)
router.put('/:id/approve', protect, restrictTo('admin'), approveRestaurant)

// ─── NESTED TABLE ROUTES (fixes: POST /api/restaurants/:id/tables) ───────────
router.get('/:restaurantId/tables', getTablesByRestaurant)
router.get('/:restaurantId/tables/available', getAvailableTables)
router.post('/:restaurantId/tables', protect, restrictTo('restaurant', 'admin'), (req, res, next) => {
  // Inject restaurantId from URL into body so addTable controller works
  req.body.restaurantId = req.params.restaurantId
  next()
}, addTable)
router.put('/:restaurantId/tables/:id/status', protect, restrictTo('restaurant', 'admin'), updateTableStatus)
router.put('/:restaurantId/tables/:id', protect, restrictTo('restaurant', 'admin'), updateTable)
router.delete('/:restaurantId/tables/:id', protect, restrictTo('restaurant', 'admin'), deleteTable)

// ─── NESTED TIME SLOT ROUTES ──────────────────────────────
router.get('/:restaurantId/timeslots', getTimeSlotsByRestaurant)
router.post('/:restaurantId/timeslots', protect, restrictTo('restaurant', 'admin'), (req, res, next) => {
  req.body.restaurantId = req.params.restaurantId
  next()
}, addTimeSlot)
router.delete('/:restaurantId/timeslots/:id', protect, restrictTo('restaurant', 'admin'), deleteTimeSlot)

module.exports = router