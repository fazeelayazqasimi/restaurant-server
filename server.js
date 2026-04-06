const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const path = require('path')

dotenv.config()

const app = express()

// ─── MIDDLEWARE ───────────────────────────────────────────
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

// ─── HEALTH CHECK ─────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ message: 'Restaurant Reservation API is running.', version: '2.0' })
})

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() })
})

// ─── ROUTES ───────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth.routes'))
app.use('/api/restaurants', require('./routes/restaurant.routes'))
app.use('/api/reservations', require('./routes/reservation.routes'))
app.use('/api/tables', require('./routes/table.routes'))
app.use('/api/admin', require('./routes/admin.routes'))

// ─── 404 HANDLER ──────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.path} not found.` })
})

// ─── ERROR HANDLER ────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ message: err.message || 'Internal server error.' })
})

// ─── START SERVER ─────────────────────────────────────────
module.exports = app

if (require.main === module) {
  const PORT = process.env.PORT || 5000
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`)
    console.log(`📧 Email: ${process.env.EMAIL_USER}`)
    console.log(`🗄️  DB: ${process.env.DATABASE_URL ? 'Connected' : 'NOT SET'}`)
  })
}