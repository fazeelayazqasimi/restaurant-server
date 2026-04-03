const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')

dotenv.config()

const app = express()

app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
  res.json({ message: 'Restaurant Reservation API is running.' })
})

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' })
})

app.use('/api/auth', require('./routes/auth.routes'))
app.use('/api/restaurants', require('./routes/restaurant.routes'))
app.use('/api/reservations', require('./routes/reservation.routes'))
app.use('/api/admin', require('./routes/admin.routes'))
app.use('/api/tables', require('./routes/table.routes'))

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found.' })
})

app.use((err, req, res, next) => {
  console.error('Error:', err.message)
  res.status(500).json({ message: err.message || 'Internal server error.' })
})

module.exports = app

if (require.main === module) {
  const PORT = process.env.PORT || 5000
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`)
  })
}