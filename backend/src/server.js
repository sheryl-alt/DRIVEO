import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

import carRoutes from './routes/carRoutes.js'
import authRoutes from './routes/authRoutes.js'
import aiRoutes from './routes/aiRoutes.js'
import { ensureDatabase } from './config/database.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const backendRoot = path.resolve(__dirname, '..')
dotenv.config({ path: path.join(backendRoot, '.env') })

const app = express()
const PORT = process.env.PORT || 5000

// =====================================================
// UPLOAD DIRECTORY
// =====================================================

const uploadDir = path.join(backendRoot, 'uploads')

fs.mkdirSync(uploadDir, {
  recursive: true
})

// =====================================================
// MULTER CONFIGURATION
// =====================================================

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir)
  },

  filename: (_req, file, cb) => {
    const ext = path
      .extname(file.originalname)
      .toLowerCase()

    const safeBase = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 60) || 'mobil'

    cb(
      null,
      `${Date.now()}-${safeBase}${ext}`
    )
  }
})

const upload = multer({
  storage,

  limits: {
    fileSize: 8 * 1024 * 1024
  },

  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/jpeg',
      'image/png',
      'image/webp'
    ]

    if (allowed.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(
        new Error(
          'Format gambar tidak didukung. Gunakan JPG, PNG, atau WebP.'
        )
      )
    }
  }
})

// =====================================================
// CORS
// =====================================================

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175'
]

app.use(
  cors({
    origin: (origin, callback) => {

      // Request dari Postman / server-to-server
      if (!origin) {
        return callback(null, true)
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true)
      }

      if (
        process.env.FRONTEND_URL &&
        origin === process.env.FRONTEND_URL
      ) {
        return callback(null, true)
      }

      return callback(
        new Error(
          `Origin ${origin} tidak diizinkan oleh CORS.`
        )
      )
    },

    credentials: true,

    methods: [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS'
    ],

    allowedHeaders: [
      'Content-Type',
      'Authorization'
    ]
  })
)

// =====================================================
// BODY PARSER
// =====================================================

app.use(
  express.json({
    limit: '15mb'
  })
)

app.use(
  express.urlencoded({
    extended: false,
    limit: '15mb'
  })
)

// =====================================================
// STATIC UPLOADS
// =====================================================

app.use(
  '/uploads',
  express.static(uploadDir)
)

// =====================================================
// UPLOAD IMAGE
// =====================================================

app.post(
  '/api/upload-image',
  upload.single('image'),
  (req, res) => {

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message:
          'File gambar wajib dipilih. Gunakan JPG, PNG, atau WebP.'
      })
    }

    return res.json({
      success: true,
      message: 'Foto berhasil diupload',

      data: {
        url:
          `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`,

        filename:
          req.file.filename
      }
    })
  }
)

// =====================================================
// HEALTH CHECK
// =====================================================

app.get(
  '/api/health',
  (_req, res) => {

    res.json({
      success: true,
      message: 'DRIVEO backend is running',
      port: PORT
    })
  }
)

// =====================================================
// API ROUTES
// =====================================================

app.use(
  '/api/cars',
  carRoutes
)

app.use(
  '/api/auth',
  authRoutes
)

// AI ASSISTANT
app.use(
  '/api/ai',
  aiRoutes
)

// =====================================================
// ERROR HANDLER
// =====================================================

app.use(
  (error, _req, res, _next) => {

    console.error(
      'Backend error:',
      error
    )

    if (
      error instanceof multer.MulterError
    ) {
      return res.status(400).json({
        success: false,
        message:
          `Upload error: ${error.message}`
      })
    }

    if (
      error.message &&
      error.message.includes('CORS')
    ) {
      return res.status(403).json({
        success: false,
        message: error.message
      })
    }

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        'Terjadi kesalahan pada server.'
    })
  }
)

// =====================================================
// START SERVER
// =====================================================

try {

  await ensureDatabase()

  console.log(
    `Database siap: ${
      process.env.DB_NAME || 'driveo'
    } / tabel mobil tersedia.`
  )

  app.listen(
    PORT,
    () => {

      console.log(
        `DRIVEO backend running on http://localhost:${PORT}`
      )

      console.log(
        `Frontend allowed: ${process.env.FRONTEND_URL || 'http://localhost:5173'} (local Vite ports 5173–5175)`
      )
    }
  )

} catch (error) {

  console.error(
    'Gagal menyiapkan database:',
    error
  )

  console.error(
    'Periksa MySQL/Laragon dan konfigurasi backend/.env'
  )

  process.exit(1)
}