import { db } from '../config/database.js'
import { generateGeminiRecommendation } from '../gemini.js'

const MAX_CANDIDATES = 8
const MAX_RECOMMENDATIONS = 2

function parseAmount(value, unit = '') {
  let raw = String(value || '').trim()
  if (!raw) return null
  const hasDecimalUnit = /^(juta|jt|m|miliar|milyar)$/i.test(unit)
  let number
  if (hasDecimalUnit) {
    raw = raw.replace(/,/g, '.')
    number = Number.parseFloat(raw.replace(/\.(?=.*\.)/g, ''))
  } else {
    number = Number(raw.replace(/[^0-9]/g, ''))
  }
  if (!Number.isFinite(number) || number <= 0) return null
  if (/^(juta|jt|m)$/i.test(unit)) return number * 1_000_000
  if (/^(miliar|milyar)$/i.test(unit)) return number * 1_000_000_000
  if (/^(ribu|rb)$/i.test(unit)) return number * 1_000
  return number
}

function parseBudget(message) {
  const text = String(message || '').toLowerCase()
  const withUnit = text.match(/(?:rp\s*)?(\d+(?:[.,]\d+)?)\s*(juta|jt|miliar|milyar|m)\b/i)
  if (withUnit) return parseAmount(withUnit[1], withUnit[2])

  const rupiah = text.match(/rp\.?\s*([\d.,]+)/i)
  if (rupiah) return parseAmount(rupiah[1])

  const labelled = text.match(/(?:budget|anggaran|maksimal|max(?:imum)?|paling tinggi|di bawah|dibawah|sekitar|dana)\s*(?:rp\.?\s*)?([\d.,]+)/i)
  if (labelled) {
    const amount = parseAmount(labelled[1])
    if (amount && amount < 10_000) return amount * 1_000_000
    return amount
  }
  return null
}

function parseCriteria(message) {
  const text = String(message || '').toLowerCase()
  const categories = ['suv', 'mpv', 'sedan', 'hatchback'].filter((item) => new RegExp(`\\b${item}\\b`, 'i').test(text))
  const category = categories[0] || null
  let transmission = null
  if (/\bcvt\b/i.test(text)) transmission = 'cvt'
  else if (/\ba\s*\/\s*t\b|otomatis|matic|matik/i.test(text)) transmission = 'automatic'
  else if (/\bm\s*\/\s*t\b|manual/i.test(text)) transmission = 'manual'

  let fuel = null
  if (/diesel|solar/i.test(text)) fuel = 'diesel'
  else if (/hybrid/i.test(text)) fuel = 'hybrid'
  else if (/listrik|electric|ev\b/i.test(text)) fuel = 'electric'
  else if (/bensin|petrol/i.test(text)) fuel = 'bensin'

  let condition = null
  if (/seperti baru/i.test(text)) condition = 'seperti baru'
  else if (/bekas istimewa/i.test(text)) condition = 'bekas istimewa'
  else if (/\bbaru\b/i.test(text)) condition = 'baru'
  else if (/\bbekas\b|second|\bseken\b/i.test(text)) condition = 'bekas'

  const passengerMatch = text.match(/(?:kapasitas\s*)?(\d{1,2})\s*(?:orang|penumpang|kursi|seat|seater)/i)
  const passengers = passengerMatch ? Number(passengerMatch[1]) : null
  const family = /keluarga|family/i.test(text)
  const dailyUse = /harian|sehari-hari|aktivitas sehari/i.test(text)
  const longTrip = /perjalanan jauh|luar kota|mudik|touring/i.test(text)
  const fuelEfficiency = /irit\s*(?:bbm|bahan bakar)|hemat\s*(?:bbm|bahan bakar)|efisien\s*bahan bakar/i.test(text)
  const budget = parseBudget(text)

  return {
    budget,
    category,
    categories,
    transmission,
    fuel,
    condition,
    passengers,
    family,
    dailyUse,
    longTrip,
    fuelEfficiency
  }
}

function normalizeText(value) {
  return String(value || '').toLowerCase().trim()
}

function normalizeTransmission(value) {
  const text = normalizeText(value)
  if (/cvt/.test(text)) return 'cvt'
  if (/a\s*\/\s*t|otomatis|automatic|matic|matik/.test(text)) return 'automatic'
  if (/m\s*\/\s*t|manual/.test(text)) return 'manual'
  return text
}

function normalizeFuel(value) {
  const text = normalizeText(value)
  if (/diesel|solar/.test(text)) return 'diesel'
  if (/hybrid/.test(text)) return 'hybrid'
  if (/listrik|electric|ev/.test(text)) return 'electric'
  if (/bensin|petrol/.test(text)) return 'bensin'
  return text
}

function getPassengerCount(value) {
  const match = String(value || '').match(/\d+/)
  return match ? Number(match[0]) : null
}

function getCarName(car) {
  return [car.merek, car.model, car.varian].filter(Boolean).join(' ').trim()
}

function scoreCandidate(car, criteria) {
  let score = 0
  const price = Number(car.harga) || 0
  const carPassengers = getPassengerCount(car.penumpang)

  if (criteria.budget) score += price > 0 && price <= criteria.budget ? 8 : -Math.min(8, Math.ceil(((price - criteria.budget) / criteria.budget) * 8))
  if (criteria.categories?.length) score += criteria.categories.some((category) => normalizeText(car.kategori).includes(category)) ? 5 : -3
  if (criteria.transmission) {
    const carTransmission = normalizeTransmission(car.transmisi)
    const transmissionMatches = criteria.transmission === 'automatic'
      ? ['automatic', 'cvt'].includes(carTransmission)
      : carTransmission === criteria.transmission
    score += transmissionMatches ? 4 : -2
  }
  if (criteria.fuel) score += normalizeFuel(car.bahan_bakar) === criteria.fuel ? 3 : -2
  if (criteria.condition) score += normalizeText(car.kondisi).includes(criteria.condition) ? 3 : -1
  if (criteria.passengers) score += carPassengers !== null && carPassengers >= criteria.passengers ? 5 : -5
  if (criteria.family && carPassengers !== null) score += carPassengers >= 7 ? 2 : carPassengers >= 5 ? 1 : -1
  if (criteria.family && (car.kenyamanan || car.keselamatan)) score += 1
  if (criteria.longTrip && car.kenyamanan) score += 2
  return score
}

function meetsHardCriteria(car, criteria) {
  const price = Number(car.harga) || 0
  if (criteria.budget && (!price || price > criteria.budget)) return false
  if (criteria.categories?.length && !criteria.categories.some((category) => normalizeText(car.kategori).includes(category))) return false
  if (criteria.transmission && !(criteria.transmission === 'automatic'
    ? ['automatic', 'cvt'].includes(normalizeTransmission(car.transmisi))
    : normalizeTransmission(car.transmisi) === criteria.transmission)) return false
  if (criteria.fuel && normalizeFuel(car.bahan_bakar) !== criteria.fuel) return false
  if (criteria.condition && !normalizeText(car.kondisi).includes(criteria.condition)) return false
  if (criteria.passengers) {
    const count = getPassengerCount(car.penumpang)
    if (count === null || count < criteria.passengers) return false
  }
  // DRIVEO tidak menyimpan angka konsumsi BBM, sehingga preferensi irit tidak
  // boleh dianggap terpenuhi atau diklaim sebagai fakta kendaraan.
  if (criteria.fuelEfficiency) return false
  return true
}

function hasUsefulCriteria(criteria) {
  return Boolean(
    criteria.budget || criteria.category || criteria.transmission || criteria.fuel ||
    criteria.condition || criteria.passengers || criteria.family || criteria.dailyUse ||
    criteria.longTrip || criteria.fuelEfficiency
  )
}

function criteriaLabels(criteria) {
  const labels = []
  if (criteria.budget) labels.push(`anggaran maksimal Rp${criteria.budget.toLocaleString('id-ID')}`)
  if (criteria.categories?.length) labels.push(`kategori ${criteria.categories.map((item) => item.toUpperCase()).join(' atau ')}`)
  if (criteria.transmission) {
    const transmissionLabel = criteria.transmission === 'cvt' ? 'CVT' : criteria.transmission === 'automatic' ? 'otomatis' : 'manual'
    labels.push(`transmisi ${transmissionLabel}`)
  }
  if (criteria.fuel) labels.push(`bahan bakar ${criteria.fuel}`)
  if (criteria.condition) labels.push(`kondisi ${criteria.condition}`)
  if (criteria.passengers) labels.push(`minimal ${criteria.passengers} penumpang`)
  if (criteria.fuelEfficiency) labels.push('efisiensi konsumsi BBM (belum tersedia sebagai data katalog)')
  return labels
}

function toCandidate(car, criteria) {
  return {
    id: Number(car.id),
    name: getCarName(car),
    year: Number(car.tahun) || null,
    price: Number(car.harga) || null,
    category: car.kategori || '',
    condition: car.kondisi || '',
    transmission: car.transmisi || '',
    fuel: car.bahan_bakar || '',
    passengers: car.penumpang || '',
    status: car.status || '',
    image: car.gambar || '',
    comfort: String(car.kenyamanan || '').slice(0, 240),
    safety: String(car.keselamatan || '').slice(0, 240),
    score: scoreCandidate(car, criteria),
    isExact: meetsHardCriteria(car, criteria)
  }
}

function formatRupiah(value) {
  const amount = Number(value)
  return Number.isFinite(amount) && amount > 0 ? `Rp ${amount.toLocaleString('id-ID')}` : 'Harga belum tersedia'
}

function getHttpStatus(error) {
  const values = [error?.httpStatus, error?.status, error?.statusCode, error?.code, error?.error?.code]
  for (const value of values) {
    const status = Number(value)
    if (Number.isInteger(status) && status >= 400 && status <= 599) return status
  }
  const match = String(error?.message || '').match(/\b(429|500|502|503|504)\b/)
  return match ? Number(match[1]) : 0
}

function publicError(error) {
  if (error?.code === 'GEMINI_API_KEY_MISSING') return 'Konfigurasi layanan rekomendasi belum lengkap. Periksa GEMINI_API_KEY pada backend.'
  const status = getHttpStatus(error)
  if (status === 429) return 'Permintaan AI sedang dibatasi. Tunggu sebentar sebelum mencoba kembali.'
  if ([500, 502, 503, 504].includes(status)) return 'Layanan AI sedang mengalami gangguan sementara. Silakan coba kembali.'
  if ([400, 401, 403].includes(status)) return 'Konfigurasi atau akses Gemini API belum valid. Periksa konfigurasi backend.'
  return 'DRIVEO AI belum dapat memproses rekomendasi. Silakan coba kembali.'
}

export async function sendChat(req, res) {
  const startedAt = Date.now()
  const message = String(req.body?.message || '').trim()
  if (!message) return res.status(400).json({ success: false, message: 'Kebutuhan kendaraan wajib diisi.' })
  if (message.length > 1200) return res.status(400).json({ success: false, message: 'Pesan maksimal 1.200 karakter.' })

  const criteria = parseCriteria(message)
  if (!hasUsefulCriteria(criteria)) {
    return res.status(200).json({
      success: true,
      result: {
        type: 'clarification',
        intro: 'Agar rekomendasi lebih tepat, boleh sampaikan anggaran, jenis mobil, atau kebutuhan penggunaannya? Contoh: mobil keluarga dengan anggaran maksimal Rp200 juta.'
      }
    })
  }

  let rows
  const dbStarted = Date.now()
  try {
    const [availableRows] = await db.query(
      `SELECT id, merek, model, varian, tahun, harga, kategori, kondisi,
              transmisi, bahan_bakar, penumpang, status, gambar, kenyamanan, keselamatan
       FROM mobil
       WHERE LOWER(TRIM(status)) IN ('tersedia', 'available')
         AND harga > 0
       ORDER BY created_at DESC
       LIMIT 100`
    )
    rows = availableRows
  } catch (error) {
    console.error('[DRIVEO AI] Gagal membaca katalog:', error.message || error)
    return res.status(503).json({ success: false, message: 'Data katalog DRIVEO sedang tidak dapat diakses. Silakan coba kembali.' })
  }
  const dbMs = Date.now() - dbStarted

  if (!rows.length) {
    return res.status(200).json({
      success: true,
      result: {
        type: 'none',
        intro: 'Saat ini belum ada kendaraan berstatus tersedia dengan data harga yang dapat digunakan untuk membuat rekomendasi. Silakan periksa kembali katalog DRIVEO.'
      }
    })
  }

  const candidates = rows.map((car) => toCandidate(car, criteria))
  const exactCandidates = candidates.filter((car) => car.isExact).sort((a, b) => b.score - a.score)
  const mode = exactCandidates.length ? 'match' : 'alternative'
  const candidatePool = (mode === 'match' ? exactCandidates : [...candidates].sort((a, b) => b.score - a.score))
    .slice(0, MAX_CANDIDATES)

  if (!candidatePool.length) {
    return res.status(200).json({
      success: true,
      result: {
        type: 'none',
        intro: 'Belum ditemukan kendaraan yang relevan dengan kebutuhan tersebut di katalog DRIVEO.'
      }
    })
  }

  const compactCriteria = {
    ...criteria,
    budget: criteria.budget || null,
    requested: criteriaLabels(criteria)
  }

  try {
    const aiStarted = Date.now()
    const aiResult = await generateGeminiRecommendation({
      message,
      criteria: compactCriteria,
      candidates: candidatePool,
      mode
    })
    const aiMs = Date.now() - aiStarted

    const candidateMap = new Map(candidatePool.map((car) => [String(car.id), car]))
    const selected = []
    const seen = new Set()
    for (const item of aiResult.recommendations) {
      const id = String(item?.id ?? '').trim()
      const car = candidateMap.get(id)
      if (!car || seen.has(id)) continue
      seen.add(id)
      selected.push({
        id: car.id,
        name: car.name,
        year: car.year,
        price: car.price,
        priceFormatted: formatRupiah(car.price),
        transmission: car.transmission,
        fuel: car.fuel,
        image: car.image,
        reason: String(item?.reason || '').trim().slice(0, 420) || (mode === 'match'
          ? 'Kendaraan ini memenuhi kriteria utama yang dapat diverifikasi dari data katalog DRIVEO.'
          : 'Kendaraan ini merupakan alternatif terdekat yang tersedia berdasarkan data katalog DRIVEO.'),
        status: car.status
      })
      if (selected.length >= MAX_RECOMMENDATIONS) break
    }

    if (!selected.length) {
      return res.status(200).json({
        success: true,
        result: {
          type: 'none',
          intro: 'Belum ditemukan kendaraan yang cukup relevan untuk direkomendasikan berdasarkan kriteria tersebut. Anda dapat mengubah anggaran atau preferensi kendaraan.'
        }
      })
    }

    const result = {
      type: mode,
      intro: mode === 'match'
        ? 'Berdasarkan kebutuhan Anda, berikut kendaraan yang paling sesuai dari katalog DRIVEO.'
        : 'Belum ditemukan kendaraan yang memenuhi seluruh kriteria. Berikut alternatif terdekat yang dapat dipertimbangkan.',
      recommendations: selected
    }

    console.info('[DRIVEO AI PERF]', JSON.stringify({
      dbMs,
      aiMs,
      totalMs: Date.now() - startedAt,
      candidateCount: candidatePool.length,
      recommendationCount: selected.length,
      promptTokens: aiResult.usage?.promptTokenCount ?? null,
      outputTokens: aiResult.usage?.candidatesTokenCount ?? null
    }))

    return res.status(200).json({ success: true, result })
  } catch (error) {
    console.error('[DRIVEO AI] Request gagal:', error.message || error)
    const status = getHttpStatus(error)
    const httpStatus = error?.code === 'GEMINI_API_KEY_MISSING' ? 503 : status === 429 ? 429 : status === 503 ? 503 : status === 400 || status === 401 || status === 403 ? status : 502
    return res.status(httpStatus).json({ success: false, message: publicError(error) })
  }
}
