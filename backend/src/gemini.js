import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { GoogleGenAI } from '@google/genai'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, '../.env') })

let cachedClient = null
let cachedApiKey = null

export function validateGeminiConfig() {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    const error = new Error('API key Gemini belum diisi. Isi GEMINI_API_KEY pada backend/.env, lalu restart backend.')
    error.code = 'GEMINI_API_KEY_MISSING'
    throw error
  }
  return true
}

function getGeminiClient() {
  validateGeminiConfig()
  const apiKey = process.env.GEMINI_API_KEY.trim()
  if (!cachedClient || cachedApiKey !== apiKey) {
    cachedClient = new GoogleGenAI({ apiKey })
    cachedApiKey = apiKey
  }
  return cachedClient
}

/**
 * Satu pemanggilan Gemini untuk memilih kandidat yang sudah diambil dan
 * difilter backend. Gemini tidak pernah menerima seluruh database.
 */
export async function generateGeminiRecommendation({ message, criteria, candidates, mode }) {
  const ai = getGeminiClient()
  const model = process.env.GEMINI_MODEL?.trim() || 'gemini-3.8-flash'

  const compactCandidates = candidates.map((car) => ({
    id: car.id,
    name: car.name,
    year: car.year,
    price: car.price,
    category: car.category,
    condition: car.condition,
    transmission: car.transmission,
    fuel: car.fuel,
    passengers: car.passengers,
    comfort: car.comfort,
    safety: car.safety
  }))

  const prompt = `Kamu adalah DRIVEO AI, asisten rekomendasi kendaraan showroom DRIVEO. Jawab seluruh teks dalam Bahasa Indonesia profesional dan ringkas.

TUGAS:
Pilih kendaraan paling sesuai dari kandidat yang diberikan. Jangan membuat kendaraan atau data baru.

KEBUTUHAN USER:
${JSON.stringify(message)}

KRITERIA YANG TERDETEKSI:
${JSON.stringify(criteria)}

JENIS KANDIDAT:
${mode === 'match' ? 'Kandidat memenuhi seluruh kriteria yang dapat diverifikasi.' : 'Tidak ada kandidat yang memenuhi seluruh kriteria. Pilih alternatif terdekat dan jelaskan kekurangannya.'}

KANDIDAT DARI DATABASE:
${JSON.stringify(compactCandidates)}

ATURAN WAJIB:
- Gunakan hanya ID yang ada pada daftar kandidat.
- Utamakan satu rekomendasi terbaik.
- Tambahkan rekomendasi kedua hanya jika benar-benar sama-sama sesuai (mode match) atau sama-sama dekat dan berguna (mode alternative). Jangan memenuhi kuota.
- Maksimal dua rekomendasi.
- Jangan mengarang harga, tahun, transmisi, bahan bakar, kategori, kondisi, atau kapasitas penumpang.
- Jika user mencari mobil keluarga, prioritaskan kapasitas penumpang dan data kenyamanan/keselamatan yang tersedia.
- Gunakan data kenyamanan dan keselamatan hanya jika tersedia pada kandidat.
- Jika user meminta irit BBM, jangan menyatakan kendaraan irit karena database tidak memiliki angka konsumsi BBM. Jelaskan singkat bahwa data konsumsi BBM tidak tercantum bila relevan.
- Untuk mode alternative, jelaskan kriteria yang belum terpenuhi. Jangan menyebut alternatif sebagai cocok sempurna.
- Alasan setiap rekomendasi maksimal 2 kalimat, ringkas, spesifik, dan berdasarkan data kandidat.

KELUARAN:
Kembalikan JSON valid saja, tanpa Markdown atau teks tambahan, dengan bentuk:
{"recommendations":[{"id":123,"reason":"..."}]}
Jika tidak ada kandidat yang layak, gunakan recommendations: [].`

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      maxOutputTokens: 300,
      thinkingConfig: { thinkingLevel: 'LOW' }
    }
  })

  const rawText = typeof response?.text === 'string' ? response.text.trim() : ''
  if (!rawText) throw new Error('Gemini tidak mengirimkan hasil rekomendasi.')

  let parsed
  try {
    parsed = JSON.parse(rawText)
  } catch {
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    parsed = JSON.parse(cleaned)
  }

  return {
    recommendations: Array.isArray(parsed?.recommendations) ? parsed.recommendations : [],
    usage: response?.usageMetadata || null
  }
}
