const multer = require('multer')
const path = require('path')
const fs = require('fs')

// Use /tmp on Vercel (only writable directory), local ./uploads otherwise
const BASE_DIR = process.env.VERCEL ? '/tmp/uploads' : './uploads'

// Ensure upload directories exist
const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

ensureDir(BASE_DIR)
ensureDir(`${BASE_DIR}/restaurants`)
ensureDir(`${BASE_DIR}/logos`)

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const type = req.query.type || 'restaurants'
    if (type === 'logo') {
      cb(null, `${BASE_DIR}/logos`)
    } else {
      cb(null, `${BASE_DIR}/restaurants`)
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    const ext = path.extname(file.originalname)
    cb(null, `img-${uniqueSuffix}${ext}`)
  }
})

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
  const mimetype = allowedTypes.test(file.mimetype)

  if (mimetype && extname) {
    cb(null, true)
  } else {
    cb(new Error('Only images are allowed'), false)
  }
}

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: fileFilter
})

module.exports = upload