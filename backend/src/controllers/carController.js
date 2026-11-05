import { db } from '../config/database.js'

function parseGallery(value, fallback = []) {
  if (Array.isArray(value)) return value
  if (!value) return fallback
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

function normalizeGalleryForSave(gallery, primaryImage) {
  let items = gallery
  if (typeof items === 'string') {
    try { items = JSON.parse(items) } catch { items = [] }
  }
  if (!Array.isArray(items)) items = []
  return [...new Set([primaryImage, ...items].filter((item) => typeof item === 'string' && item.trim()))]
}

function normalizeCar(row) {
  const gallery = parseGallery(row.gallery, row.gambar ? [row.gambar] : [])

  return {
    ...row,
    id: Number(row.id),
    tahun: Number(row.tahun) || 2023,
    harga: Number(row.harga) || 0,
    kilometer: Number(row.kilometer) || 0,
    gambar: row.gambar || '',
    gallery
  }
}

export async function listCars(req, res) {
  try {
    const [rows] = await db.query(
      'SELECT * FROM mobil ORDER BY created_at DESC'
    )

    res.json({
      success: true,
      data: rows.map(normalizeCar)
    })
  } catch (error) {
    console.error('GET /api/cars:', error)

    res.status(500).json({
      success: false,
      message: 'Gagal mengambil data mobil',
      error: error.message
    })
  }
}

export async function getCar(req, res) {
  try {
    const [rows] = await db.query(
      'SELECT * FROM mobil WHERE id = ?',
      [req.params.id]
    )

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Mobil tidak ditemukan'
      })
    }

    res.json({
      success: true,
      data: normalizeCar(rows[0])
    })
  } catch (error) {
    console.error('GET /api/cars/:id:', error)

    res.status(500).json({
      success: false,
      message: 'Gagal mengambil data mobil',
      error: error.message
    })
  }
}

export async function createCar(req, res) {
  try {
    const {
      merek,
      model,
      varian = '',
      tahun = 2023,
      harga,
      kategori = '',
      kondisi = '',
      transmisi = '',
      bahan_bakar = '',
      warna = '',
      kilometer = 0,
      status = 'Tersedia',
      is_featured = 0,
      deskripsi = '',
      gambar = '',
      gallery = [],
      mesin = '',
      kapasitas = '',
      tenaga = '',
      torsi = '',
      penumpang = '',
      keselamatan = '',
      kenyamanan = ''
    } = req.body

    if (!merek || !model || harga === undefined || harga === null || harga === '') {
      return res.status(400).json({
        success: false,
        message: 'Merek, model, dan harga wajib diisi'
      })
    }

    const galleryItems = normalizeGalleryForSave(gallery, gambar)
    const primaryImage = gambar || galleryItems[0] || ''
    const galleryJson = JSON.stringify(galleryItems)
    const featured = is_featured ? 1 : 0
    if (featured) await db.query('UPDATE mobil SET is_featured = 0')

    const [result] = await db.query(
      `INSERT INTO mobil
      (merek, model, varian, tahun, harga, kategori, kondisi,
       transmisi, bahan_bakar, warna, kilometer, status, deskripsi,
       is_featured,
       gambar, gallery, mesin, kapasitas, tenaga, torsi, penumpang,
       keselamatan, kenyamanan)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        merek,
        model,
        varian,
        Number(tahun) || 2023,
        Number(harga) || 0,
        kategori,
        kondisi,
        transmisi,
        bahan_bakar,
        warna,
        Number(kilometer) || 0,
        status || 'Tersedia',
        deskripsi,
        featured,
        primaryImage,
        galleryJson,
        mesin,
        kapasitas,
        tenaga,
        torsi,
        penumpang,
        keselamatan,
        kenyamanan
      ]
    )

    const [rows] = await db.query(
      'SELECT * FROM mobil WHERE id = ?',
      [result.insertId]
    )

    res.status(201).json({
      success: true,
      message: 'Mobil berhasil ditambahkan',
      data: normalizeCar(rows[0])
    })
  } catch (error) {
    console.error('POST /api/cars:', error)

    res.status(500).json({
      success: false,
      message: 'Gagal menambahkan mobil',
      error: error.message
    })
  }
}

export async function updateCar(req, res) {
  try {
    const {
      merek,
      model,
      varian = '',
      tahun = 2023,
      harga,
      kategori = '',
      kondisi = '',
      transmisi = '',
      bahan_bakar = '',
      warna = '',
      kilometer = 0,
      status = 'Tersedia',
      is_featured = 0,
      deskripsi = '',
      gambar = '',
      gallery = [],
      mesin = '',
      kapasitas = '',
      tenaga = '',
      torsi = '',
      penumpang = '',
      keselamatan = '',
      kenyamanan = ''
    } = req.body

    if (!merek || !model || harga === undefined || harga === null || harga === '') {
      return res.status(400).json({
        success: false,
        message: 'Merek, model, dan harga wajib diisi'
      })
    }

    const galleryItems = normalizeGalleryForSave(gallery, gambar)
    const primaryImage = gambar || galleryItems[0] || ''
    const galleryJson = JSON.stringify(galleryItems)
    const featured = is_featured ? 1 : 0
    if (featured) await db.query('UPDATE mobil SET is_featured = 0')

    const [result] = await db.query(
      `UPDATE mobil SET
        merek = ?,
        model = ?,
        varian = ?,
        tahun = ?,
        harga = ?,
        kategori = ?,
        kondisi = ?,
        transmisi = ?,
        bahan_bakar = ?,
        warna = ?,
        kilometer = ?,
        status = ?,
        is_featured = ?,
        deskripsi = ?,
        gambar = ?,
        gallery = ?,
        mesin = ?,
        kapasitas = ?,
        tenaga = ?,
        torsi = ?,
        penumpang = ?,
        keselamatan = ?,
        kenyamanan = ?
      WHERE id = ?`,
      [
        merek,
        model,
        varian,
        Number(tahun) || 2023,
        Number(harga) || 0,
        kategori,
        kondisi,
        transmisi,
        bahan_bakar,
        warna,
        Number(kilometer) || 0,
        status || 'Tersedia',
        featured,
        deskripsi,
        primaryImage,
        galleryJson,
        mesin,
        kapasitas,
        tenaga,
        torsi,
        penumpang,
        keselamatan,
        kenyamanan,
        req.params.id
      ]
    )

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Mobil tidak ditemukan'
      })
    }

    const [rows] = await db.query(
      'SELECT * FROM mobil WHERE id = ?',
      [req.params.id]
    )

    res.json({
      success: true,
      message: 'Mobil berhasil diperbarui',
      data: normalizeCar(rows[0])
    })
  } catch (error) {
    console.error('PUT /api/cars/:id:', error)

    res.status(500).json({
      success: false,
      message: 'Gagal memperbarui mobil',
      error: error.message
    })
  }
}

export async function deleteCar(req, res) {
  try {
    const [result] = await db.query(
      'DELETE FROM mobil WHERE id = ?',
      [req.params.id]
    )

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Mobil tidak ditemukan'
      })
    }

    res.json({
      success: true,
      message: 'Mobil berhasil dihapus'
    })
  } catch (error) {
    console.error('DELETE /api/cars/:id:', error)

    res.status(500).json({
      success: false,
      message: 'Gagal menghapus mobil',
      error: error.message
    })
  }
}
