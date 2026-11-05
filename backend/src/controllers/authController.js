
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { db } from '../config/database.js'

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret'

// Membuat token khusus Admin
function makeToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: 'admin'
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  )
}

// Data Admin yang dikirim ke frontend
function publicAdmin(user) {
  return {
    id: user.id,
    nama: 'Admin',
    name: 'Admin',
    email: user.email,
    role: 'admin'
  }
}

// LOGIN ADMIN
export async function loginAdmin(req, res) {
  try {
    const email = String(req.body?.email || '')
      .trim()
      .toLowerCase()

    const password = String(req.body?.password || '')

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email dan password wajib diisi.'
      })
    }

    // Menggunakan kolom yang benar-benar tersedia di tabel users
    const [rows] = await db.query(
      `SELECT id, email, password
       FROM users
       WHERE email = ?
       LIMIT 1`,
      [email]
    )

    const user = rows[0]

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email atau password salah.'
      })
    }

    // Verifikasi password
    const passwordMatch = await bcrypt.compare(
      password,
      user.password
    )

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Email atau password salah.'
      })
    }

    const safeUser = publicAdmin(user)
    const token = makeToken(user)

    return res.json({
      success: true,
      message: 'Login Admin berhasil.',
      token,
      user: safeUser
    })

  } catch (error) {
    console.error('Login Admin error:', error)

    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server saat login Admin.'
    })
  }
}

// LOGIN USER DINONAKTIFKAN
// Export tetap tersedia agar tidak menyebabkan error
// apabila masih diimpor oleh file routes.
export async function loginUser(req, res) {
  return res.status(403).json({
    success: false,
    message: 'Login User tidak tersedia.'
  })
}

// REGISTRASI USER DINONAKTIFKAN
export async function registerUser(req, res) {
  return res.status(403).json({
    success: false,
    message: 'Registrasi User tidak tersedia.'
  })
}

// CEK SESSION ADMIN
export async function checkSession(req, res) {
  try {
    const auth = String(
      req.headers.authorization || ''
    )

    const token = auth.startsWith('Bearer ')
      ? auth.slice(7)
      : ''

    if (!token) {
      return res.json({
        success: true,
        authenticated: false,
        user: null
      })
    }

    const payload = jwt.verify(
      token,
      JWT_SECRET
    )

    // Hanya token Admin yang diterima
    if (payload.role !== 'admin') {
      return res.json({
        success: true,
        authenticated: false,
        user: null
      })
    }

    // Memeriksa apakah akun masih tersedia di database
    const [rows] = await db.query(
      `SELECT id, email
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [payload.id]
    )

    if (!rows.length || rows[0].email !== payload.email) {
      return res.json({
        success: true,
        authenticated: false,
        user: null
      })
    }

    return res.json({
      success: true,
      authenticated: true,
      user: publicAdmin(rows[0])
    })

  } catch (error) {
    return res.json({
      success: true,
      authenticated: false,
      user: null
    })
  }
}

// LOGOUT
export async function logout(req, res) {
  return res.json({
    success: true,
    message: 'Logout berhasil.'
  })
}
