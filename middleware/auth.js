const jwt = require('jsonwebtoken')

const protect = (req, res, next) => {
  try {
    // ─── Token header se lo ───────────────────────────────
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token, authorization denied.' })
    }

    const token = authHeader.split(' ')[1]

    // ─── Token verify karo ────────────────────────────────
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded

    next()
  } catch (error) {
    return res.status(401).json({ message: 'Token is not valid.' })
  }
}

const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied. Insufficient permissions.' })
    }
    next()
  }
}

module.exports = { protect, restrictTo }