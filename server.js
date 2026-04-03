const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const path = require('path')
const fs = require('fs')

dotenv.config()

const app = express()

// ─── Create uploads directory if not exists ───────────────
const uploadDirs = ['./uploads', './uploads/restaurants', './uploads/logos']
uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
})

// ─── Middleware ───────────────────────────────────────────
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ─── Serve static files (uploaded images) ─────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

// ─── Ngrok warning bypass ─────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', 'true')
  next()
})

// ─── Routes ───────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ message: 'Restaurant Reservation API is running.' })
})

app.use('/api/auth', require('./routes/auth.routes'))
app.use('/api/restaurants', require('./routes/restaurant.routes'))
app.use('/api/reservations', require('./routes/reservation.routes'))
app.use('/api/admin', require('./routes/admin.routes'))
app.use('/api/tables', require('./routes/table.routes'))

// ─── 404 handler ──────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found.' })
})

// ─── Error handler ────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ message: err.message || 'Internal server error.' })
})

// ─── Vercel ke liye export ────────────────────────────────
module.exports = app

// ─── Local development ke liye ───────────────────────────
if (require.main === module) {
  const PORT = process.env.PORT || 5000
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`)
    console.log(`📁 Uploads directory: ${path.join(__dirname, 'uploads')}`)
  })
}