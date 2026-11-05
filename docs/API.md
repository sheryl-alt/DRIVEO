# DRIVEO API Contract

Frontend runs by default on `http://localhost:5173`.
Backend runs by default on `http://localhost:5000`.

## Authentication

### POST /api/auth/user/login
Request:
```json
{ "email": "user@example.com", "password": "..." }
```

Response:
```json
{
  "success": true,
  "token": "...",
  "user": { "id": 1, "name": "User", "email": "user@example.com", "role": "user" }
}
```

### POST /api/auth/admin/login
Same shape, but returned role is `admin`.

## Cars

### GET /api/cars
Optional query params:
`search`, `brand`, `minPrice`, `maxPrice`, `year`, `transmission`, `fuel`, `status`

### GET /api/cars/:id

### POST /api/cars
Admin only. Used by the Admin Dashboard to add a car.

### PUT /api/cars/:id
Admin only.

### DELETE /api/cars/:id
Admin only.

## DRIVEO AI Recommendation

### POST /api/ai/chat
Request:
```json
{
  "message": "Saya mencari mobil keluarga dengan anggaran maksimal Rp200 juta dan transmisi otomatis."
}
```

Successful recommendation response:
```json
{
  "success": true,
  "result": {
    "type": "match",
    "intro": "Berikut kendaraan yang paling sesuai dengan kebutuhan Anda.",
    "recommendations": [
      {
        "id": 12,
        "name": "Merek Model",
        "year": 2023,
        "price": 185000000,
        "priceFormatted": "Rp 185.000.000",
        "transmission": "Otomatis (A/T)",
        "fuel": "Bensin",
        "image": "/uploads/example.jpg",
        "reason": "Memenuhi kriteria utama yang Anda sampaikan.",
        "status": "Tersedia"
      }
    ]
  }
}
```

`result.type` can be:
- `match`: one or two vehicles meet the verifiable criteria.
- `alternative`: no full match; one closest available alternative is preferred, with a second only when it is genuinely useful.
- `clarification`: the user's input does not yet contain enough vehicle criteria.
- `none`: no relevant available vehicle can be recommended.

Recommendation rules:
1. Candidate vehicles are read from the `mobil` table and must have an available status and a valid price.
2. Backend filters and ranks candidates before sending a compact candidate list to Gemini.
3. Gemini may select only candidate IDs supplied by the backend.
4. One best recommendation is preferred. A second is included only when it genuinely meets the criteria or is a similarly relevant alternative.
5. Each recommendation includes the vehicle name, price, year, transmission, fuel type, image path, and a concise reason. Missing specifications are not invented.
6. No chat history is stored or sent between requests.

## Important

- Gemini API key stays in backend `.env`; never put it in Vue/frontend.
- Frontend should not directly connect to MySQL.
- Admin-only endpoints must check JWT role.
- Keep response field names stable so frontend and backend stay synchronized.
