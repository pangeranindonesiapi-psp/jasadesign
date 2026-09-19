# JasaDigital

Platform jasa digital untuk UMKM Indonesia: pembuatan website, desain grafis, SEO, digital marketing, dan AI automation.

## 🚀 Fitur

- Landing page + halaman order + admin dashboard
- Pembayaran QRIS, Virtual Account, Bank Transfer (via Midtrans Snap)
- Anti-phishing & keamanan (CSP, anti-clickjacking, sanitasi input, CSRF token)
- "Cek Status Order" untuk pelanggan
- Google Analytics (GA4) terpasang di semua halaman
- Admin backend list order (proteksi X-Admin-Key)

## 📁 Struktur

```
index.html        Landing page
order.html        Form order + metode pembayaran
admin.html        Dashboard admin
css/              Gaya (style, order)
js/               app, order, admin, security
server.js         Backend Express + Midtrans Snap
db.js             Penyimpanan order (PostgreSQL / fallback file)
TEMPLATE-DM.md    Template DM siap kirim
RENCANA-30-HARI.md  Rencana marketing 30 hari
DEPLOY.md         Panduan deploy
```

## 🔧 Teknologi

- Frontend: HTML/CSS/JS murni (Bootstrap 5), dihosting di **GitHub Pages**
- Backend: Node.js + Express di **Render**
- Database: **PostgreSQL** (Supabase), fallback file JSON
- Payment: Midtrans Snap

## 🌐 Link Penting

- Website: https://pangeranindonesiapi-psp.github.io/jasadesign/
- API: https://jasadesign-backend.onrender.com
- Endpoint: `GET /api/admin/orders` (dengan header `X-Admin-Key`)

## ⚙️ Env Vars (backend)

Salin `.env.example` ke `.env` lalu isi. Untuk Render/Production set di dashboard:

| Variabel | Keterangan |
|---|---|
| `DATABASE_URL` | Connection string PostgreSQL (wajib untuk penyimpanan permanen) |
| `MIDTRANS_SERVER_KEY` | Kunci server Midtrans (sandbox/production) |
| `MIDTRANS_IS_PRODUCTION` | `true`/`false` |
| `WHATSAPP_NUMBER` | Nomor bisnis format internasional tanpa `+` |
| `ADMIN_PASSWORD` | Password admin untuk `/api/admin/orders` |
| `ALLOWED_ORIGINS` | Origin yang diizinkan CORS (pisah koma) |

## 🚀 Menjalankan Lokal

```bash
npm install
npm start
# lalu buka http://localhost:3000
```

## 🛠️ Status

- [x] Website + admin live (GitHub Pages)
- [x] Backend live (Render) + database PostgreSQL (Supabase)
- [x] Fitur cek status, GA4 (menunggu ID pengukuran), template marketing
- [ ] Koneksi Midtrans aktif (menunggu Server Key)

© 2026 JasaDigital