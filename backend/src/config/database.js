import mysql from 'mysql2/promise'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({
  path: path.resolve(__dirname, '../../.env')
})

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || ''
}

const dbName = process.env.DB_NAME || 'driveo'

// Bootstrap connection tanpa memilih database terlebih dahulu.
// Ini membuat backend tetap bisa berjalan walaupun database driveo belum dibuat.
const bootstrap = await mysql.createConnection(dbConfig)
await bootstrap.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``)
await bootstrap.end()

export const db = mysql.createPool({
  ...dbConfig,
  database: dbName,
  waitForConnections: true,
  connectionLimit: 10
})

export async function ensureDatabase() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS mobil (
      id INT AUTO_INCREMENT PRIMARY KEY,
      merek VARCHAR(100) NOT NULL,
      model VARCHAR(150) NOT NULL,
      varian VARCHAR(150) DEFAULT '',
      tahun INT DEFAULT 2023,
      harga DECIMAL(15,2) NOT NULL DEFAULT 0,
      kategori VARCHAR(100) DEFAULT '',
      kondisi VARCHAR(100) DEFAULT '',
      transmisi VARCHAR(100) DEFAULT '',
      bahan_bakar VARCHAR(100) DEFAULT '',
      warna VARCHAR(100) DEFAULT '',
      kilometer INT DEFAULT 0,
      status VARCHAR(30) NOT NULL DEFAULT 'Tersedia',
      is_featured TINYINT(1) NOT NULL DEFAULT 0,
      deskripsi TEXT,
      gambar LONGTEXT,
      gallery LONGTEXT,
      mesin VARCHAR(150) DEFAULT '',
      kapasitas VARCHAR(150) DEFAULT '',
      tenaga VARCHAR(150) DEFAULT '',
      torsi VARCHAR(150) DEFAULT '',
      penumpang VARCHAR(150) DEFAULT '',
      keselamatan TEXT,
      kenyamanan TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `)

  // Jika tabel mobil sudah pernah dibuat dengan versi schema lama,
  // tambahkan kolom yang belum ada tanpa menghapus data lama.
  const [columns] = await db.query('SHOW COLUMNS FROM mobil')
  const existing = new Set(columns.map((column) => column.Field))

  const missingColumns = {
    merek: "VARCHAR(100) NOT NULL DEFAULT ''",
    model: "VARCHAR(150) NOT NULL DEFAULT ''",
    varian: "VARCHAR(150) DEFAULT ''",
    tahun: 'INT DEFAULT 2023',
    harga: 'DECIMAL(15,2) NOT NULL DEFAULT 0',
    kategori: "VARCHAR(100) DEFAULT ''",
    kondisi: "VARCHAR(100) DEFAULT ''",
    transmisi: "VARCHAR(100) DEFAULT ''",
    bahan_bakar: "VARCHAR(100) DEFAULT ''",
    warna: "VARCHAR(100) DEFAULT ''",
    kilometer: 'INT DEFAULT 0',
    status: "VARCHAR(30) NOT NULL DEFAULT 'Tersedia'",
    is_featured: 'TINYINT(1) NOT NULL DEFAULT 0',
    deskripsi: 'TEXT',
    gambar: 'LONGTEXT',
    gallery: 'LONGTEXT',
    mesin: "VARCHAR(150) DEFAULT ''",
    kapasitas: "VARCHAR(150) DEFAULT ''",
    tenaga: "VARCHAR(150) DEFAULT ''",
    torsi: "VARCHAR(150) DEFAULT ''",
    penumpang: "VARCHAR(150) DEFAULT ''",
    keselamatan: 'TEXT',
    kenyamanan: 'TEXT',
    created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
    updated_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
  }

  for (const [name, definition] of Object.entries(missingColumns)) {
    if (!existing.has(name)) {
      await db.query(`ALTER TABLE mobil ADD COLUMN \`${name}\` ${definition}`)
    }
  }

  // Status versi lama kadang memakai ENUM available/sold. Ubah menjadi
  // VARCHAR supaya nilai dari Admin Dashboard (Tersedia/Terjual) aman.
  await db.query("ALTER TABLE mobil MODIFY COLUMN status VARCHAR(30) NOT NULL DEFAULT 'Tersedia'")
}
