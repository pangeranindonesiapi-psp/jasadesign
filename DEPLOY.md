# 🚀 Deploy JasaDigital ke Internet

## Ringkasan Cepat
1. Daftar Midtrans: https://midtrans.com/daftar
2. Buat akun Vercel/Netlify (gratis) untuk deploy
3. Hosting di Vercel: https://vercel.com (frontend)
4. Hosting server Node.js di: Railway.app / Render.com / Koyeb (gratis tier)

---

## Langkah 1: Setup Midtrans

### Daftar Akun Midtrans
1. Buka https://midtrans.com/daftar
2. Isi data: nama, email, nama bisnis, jenis usaha
3. Unggah KTP (biasanya di-review dalam 1-2 hari)
4. Setelah disetujui, login ke https://dashboard.midtrans.com/
5. Salin `Server Key` (buka Settings > Access Keys)

### Aktifkan Metode Pembayaran
Di dashboard Midtrans, buka **Settings > Payment Options**:
- ✅ QRIS
- ✅ Bank Transfer (BCA, Mandiri, BNI, BRI, Permata)
- ✅ GoPay / Dana / ShopeePay
- ✅ Virtual Account

### Webhook URL
Isi webhook URL di Midtrans dashboard:
```
https://yourdomain.com/api/midtrans-notification
```

---

## Langkah 2: Deploy Website (Frontend)

### Opsi A: Vercel (Gratis)
```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Login
vercel login

# 3. Deploy (dari folder project)
vercel --yes

# 4. Deploy ke production
vercel --prod
```

### Opsi B: Netlify (Gratis)
1. Buka https://app.netlify.com/
2. Drag & drop folder `D:\jasa-digital` ke Netlify
3. Dapat URL: `your-project.netlify.app`

### Opsi C: GitHub Pages
```bash
git init
git add .
git commit -m "deploy"
git push origin main
# Setup di repository settings > Pages > Deploy from branch
```

---

## Langkah 3: Deploy Server Backend

### Railway.app (Recommended)
1. Daftar di https://railway.app/ (pakai GitHub)
2. Push code ke GitHub repository
3. New Project > Deploy from GitHub Repo
4. Set environment variables di Railway dashboard:
   - `MIDTRANS_SERVER_KEY`: isi Server Key Midtrans
   - `MIDTRANS_IS_PRODUCTION`: `true` untuk production
   - `PORT`: `3000`
   - `NODE_ENV`: `production`
5. Railway otomatis deploy saat ada push ke GitHub

### Render.com
1. Daftar di https://render.com/
2. New > Web Service
3. Connect GitHub repository
4. Build: `npm install`
5. Start: `node server.js`
6. Set env vars

### Koyeb
1. https://koyeb.com/
2. Create service > Import from GitHub
3. Set env vars

---

## Langkah 4: Domain & SSL

### Beli Domain (opsional, mulai Rp15rb/tahun)
- **Rumahweb**: https://rumahweb.com (domain ID terbaik)
- **Domainesia**: https://domainesia.com (murah .com/.id)
- **Hostinger**: https://hostinger.co.id

### Setup SSL (gratis)
- Vercel/Netlify: SSL otomatis
- Railway/Render: SSL otomatis
- Untuk custom domain: tambahkan CNAME record ke platform

---

## Langkah 5: Konfigurasi Production

### Update `server.js` production
```javascript
// Pastikan environment di-set dengan benar
process.env.NODE_ENV = 'production';
process.env.MIDTRANS_IS_PRODUCTION = 'true';
```

### Update URL di Midtrans Dashboard
```
Settings > System Configuration > Payment Notification URL
https://yourdomain.com/api/midtrans-notification
```

### Setup Notifikasi (WhatsApp Business API)
1. Daftar WhatsApp Business API via Biru.id / Qontak.com
2. Buat template pesan notifikasi
3. Integrasi di server.js (ganti console.log dengan API call)

---

## Langkah 6: Monitoring & Backup

### Monitoring
- **UptimeRobot** (gratis): https://uptimerobot.com/ - monitor website & server
- **Vercel Analytics**: Built-in analytics untuk frontend

### Backup
- Database: backup harian (cron job untuk download data)
- Code: backup ke GitHub (otomatis)

---

## Checklist Production
- [ ] Domain tersedia & diarahkan ke hosting
- [ ] SSL aktif (https://)
- [ ] Midtrans Production Mode ON
- [ ] Webhook URL terisi di Midtrans dashboard
- [ ] Environment variables lengkap di server
- [ ] WhatsApp Business API aktif (untuk notifikasi)
- [ ] Admin password diubah dari default
- [ ] UptimeRobot monitoring aktif
- [ ] Google Analytics / Plausible dipasang
- [ ] Test transaksi pembayaran berhasil
