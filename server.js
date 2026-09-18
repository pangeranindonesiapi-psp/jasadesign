/* ============================================================
 * JasaDigital - Backend Server (Node.js + Express)
 *
 * Fitur:
 *  - API pembuatan transaksi (QRIS, VA, Bank, E-Wallet) via Midtrans
 *  - Webhook notifikasi pembayaran dari Midtrans
 *  - Security headers (CSP, HSTS, anti-clickjacking, dll)
 *  - Input validation & sanitasi
 *
 * Cara menjalankan:
 *   npm install
 *   set MIDTRANS_SERVER_KEY=SB-Mid-server-XXXX
 *   node server.js
 *
 * KONFIGURASI ENV (VARIABEL LINGKUNGAN):
 *   PORT=3000
 *   MIDTRANS_SERVER_KEY=<server key dari dashboard Midtrans>
 *   MIDTRANS_IS_PRODUCTION=false    // true saat production
 *   ADMIN_PASSWORDHash=<hash password admin>
 *   WHATSAPP_NUMBER=6281383048811
 * ============================================================ */

'use strict';

const express = require('express');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Header CORS - hanya izinkan domain sendiri
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ||
    'http://localhost:3000,' +
    'http://localhost:5500,' +
    'https://pangeranindonesiapi-psp.github.io').split(',');

// ==================== SECURITY HEADERS (Anti-Phishing) ====================
app.use((req, res, next) => {
    // Content-Security-Policy: blokir skrip mencurigakan/eksternal
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://app.sandbox.midtrans.com https://app.midtrans.com; " +
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; " +
        "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net data:; " +
        "img-src 'self' data: https:; " +
        "connect-src 'self' https://app.sandbox.midtrans.com https://api.telegram.org https://graph.facebook.com; " +
        "frame-src https://app.sandbox.midtrans.com https://app.midtrans.com; " +
        "base-uri 'self'; form-action 'self'; frame-ancestors 'self'"
    );

    // X-Frame-Options: anti-clickjacking
    res.setHeader('X-Frame-Options', 'DENY');

    // X-Content-Type-Options: anti-MIME sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Referrer-Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // HSTS (hanya di HTTPS/production)
    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    }

    // CORS untuk domain sendiri
    const reqOrigin = req.headers.origin || '';
    if (ALLOWED_ORIGINS.indexOf(reqOrigin) !== -1) {
        res.setHeader('Access-Control-Allow-Origin', reqOrigin);
        res.setHeader('Vary', 'Origin');
    } else {
        res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0]);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

// ==================== BODY PARSING ====================
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(__dirname));

// ==================== SANITIZE / VALIDATOR ====================
function sanitize(str, maxLen = 500) {
    return String(str || '')
        .replace(/<[^>]*>/g, '')
        .replace(/[<>"'`]/g, '')
        .replace(/[\u0000-\u001F\u007F]/g, '')
        .trim()
        .slice(0, maxLen);
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
    return /^[0-9]{8,15}$/.test(phone);
}

// ==================== ORDER STORE (PostgreSQL / file JSON) ====================
// - Mode terbaik: PostgreSQL (Supabase/Neon) bila env DATABASE_URL diisi.
// - Fallback: file JSON (bisa hilang saat redeploy Render free-tier).
const db = require('./db');
db.init().catch(e => console.error('Gagal init db:', e.message));

function generateOrderNo() {
    const now = new Date();
    const ds = now.getFullYear().toString().slice(2) +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0');
    const rand = crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 5);
    return 'JD-' + ds + '-' + rand;
}

// ==================== MIDTRANS SNAP ====================
const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY || 'SB-Mid-server-YOUR_KEY';
const MIDTRANS_IS_PRODUCTION = process.env.MIDTRANS_IS_PRODUCTION === 'true';

const MIDTRANS_API_BASE = MIDTRANS_IS_PRODUCTION
    ? 'https://app.midtrans.com/snap/v1/transactions'
    : 'https://app.sandbox.midtrans.com/snap/v1/transactions';

function midtransAuth() {
    return 'Basic ' + Buffer.from(MIDTRANS_SERVER_KEY + ':').toString('base64');
}

async function createMidtransTransaction(order) {
    const payload = {
        transaction_details: {
            order_id: order.orderNo,
            gross_amount: order.total
        },
        item_details: [
            {
                id: order.service,
                price: order.basePrice - order.discount,
                quantity: 1,
                name: order.serviceName + ' - ' + order.packageName
            }
        ],
        customer_details: {
            first_name: order.name.split(' ')[0],
            last_name: order.name.split(' ').slice(1).join(' ') || '',
            email: order.email,
            phone: order.phone
        },
        credit_card: { secure: true },
        enabled_payments: [
            'qris',
            'bank_transfer_va_permata',
            'bank_transfer_va_bca',
            'bank_transfer_va_bni',
            'bank_transfer_va_bri',
            'bank_transfer_va_mandiri',
            'echannel',
            'gopay',
            'shopeepay',
            'dana',
            'ovo',
            'cimb_clicks',
            'danamon_online'
        ],
        custom_field1: 'JasaDigital',
        metadata: {
            service: order.service,
            package: order.package
        }
    };

    const fetch = await import('node-fetch');
    const res = await fetch.default(MIDTRANS_API_BASE, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': midtransAuth()
        },
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error('Midtrans API error: ' + res.status + ' ' + errText.slice(0, 200));
    }

    return await res.json(); // returns { token, redirect_url }
}

// ==================== ROUTES ====================

// Root API info
app.get('/api', (req, res) => {
    res.json({
        app: 'JasaDigital API',
        version: '1.0.0',
        status: 'ok'
    });
});

// BUAT ORDER + TRANSAKSI
app.post('/api/orders', async (req, res) => {
    try {
        const body = req.body || {};

        // Validasi & sanitasi input
        if (!Services[body.service]) {
            return res.status(400).json({ error: 'Layanan tidak valid' });
        }
        if (!Packages[body.package]) {
            return res.status(400).json({ error: 'Paket tidak valid' });
        }
        const name = sanitize(body.name, 100);
        const email = sanitize(body.email, 100);
        const phone = sanitize(body.phone, 15).replace(/\D/g, '');
        const description = sanitize(body.description, 1000);

        if (name.length < 3) return res.status(400).json({ error: 'Nama minimal 3 karakter' });
        if (!isValidEmail(email)) return res.status(400).json({ error: 'Email tidak valid' });
        if (!isValidPhone(phone)) return res.status(400).json({ error: 'Nomor HP tidak valid' });

        // Hitung harga
        const svc = Services[body.service];
        const pkg = Packages[body.package];
        const basePrice = Math.round(svc.price * pkg.multiplier);
        const discount = 0;
        const serviceFee = 5000;
        const total = basePrice - discount + serviceFee;

        const order = {
            orderNo: generateOrderNo(),
            service: body.service,
            serviceName: svc.name,
            package: body.package,
            packageName: pkg.name,
            name,
            email,
            phone,
            description,
            paymentMethod: body.paymentMethod || 'qris',
            basePrice,
            discount,
            serviceFee,
            total,
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        // Simpan order
        await db.saveOrder(order);

        // Buat transaksi Midtrans
        try {
            const snap = await createMidtransTransaction(order);
            order.snapToken = snap.token;
            order.snapRedirect = snap.redirect_url;
        } catch (e) {
            order.snapError = e.message;
        }

        res.status(201).json({ order });
    } catch (err) {
        console.error('Error /api/orders:', err);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// LIHAT STATUS ORDER (publik - hanya data terbatas)
app.get('/api/orders/:orderNo', async (req, res) => {
    const order = await db.getOrder(sanitize(req.params.orderNo, 30));
    if (!order) return res.status(404).json({ error: 'Order tidak ditemukan' });
    res.json({
        orderNo: order.orderNo,
        status: order.status,
        total: order.total,
        paymentMethod: order.paymentMethod
    });
});

// LIHAT SEMUA ORDER (khusus admin - butuh header X-Admin-Key)
app.get('/api/admin/orders', async (req, res) => {
    try {
        const key = req.headers['x-admin-key'] || req.query.key || '';
        const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Psp130226';
        if (key !== ADMIN_PASSWORD) {
            return res.status(401).json({ error: 'Unauthorized. Kirim header X-Admin-Key.' });
        }

        const ordersAll = await db.getAllOrders();
        ordersAll.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

        // Hapus field sensitif agar tidak bocor lewat API
        const safeOrders = ordersAll.map(o => ({
            orderNo: o.orderNo,
            service: o.service,
            serviceName: o.serviceName,
            package: o.package,
            packageName: o.packageName,
            name: o.name,
            email: o.email,
            phone: o.phone,
            paymentMethod: o.paymentMethod,
            basePrice: o.basePrice,
            discount: o.discount,
            serviceFee: o.serviceFee,
            total: o.total,
            status: o.status,
            createdAt: o.createdAt,
            paidAt: o.paidAt || null
        }));

        res.json({ orders: safeOrders });
    } catch (err) {
        console.error('Error /api/admin/orders:', err);
        res.status(500).json({ error: 'Gagal mengambil order' });
    }
});

// WEBHOOK NOTIFIKASI MIDTRANS (payment status)
app.post('/api/midtrans-notification', async (req, res) => {
    try {
        const body = req.body || {};

        // --- VERIFIKASI SIGNATURE (anti-phishing/fraud) ---
        // Signature: SHA512(order_id + status_code + gross_amount + ServerKey)
        const serverKey = MIDTRANS_SERVER_KEY;
        const hash = crypto
            .createHash('sha512')
            .update(body.order_id + body.status_code + body.gross_amount + serverKey)
            .digest('hex');

        if (hash !== body.signature_key) {
            console.warn('[SECURITY] Signature tidak valid untuk order', body.order_id);
            return res.status(400).json({ error: 'Signature tidak valid' });
        }

        // Proses status
        const order = await db.getOrder(body.order_id);
        if (order) {
            const patch = {};
            switch (body.transaction_status) {
                case 'capture':
                case 'settlement':
                    patch.status = 'paid';
                    patch.paidAt = new Date().toISOString();
                    patch.paymentType = body.payment_type;
                    patch.fraudStatus = body.fraud_status;
                    break;
                case 'pending':
                    patch.status = 'pending';
                    break;
                case 'deny':
                case 'cancel':
                case 'expire':
                    patch.status = 'cancelled';
                    break;
                case 'refund':
                case 'partial_refund':
                    patch.status = 'refunded';
                    break;
            }
            await db.patchOrder(body.order_id, patch);

            // TODO: Kirim notifikasi payment ke WhatsApp/Telegram berhasil
            console.log('[PAYMENT]', body.order_id, '->', patch.status || 'no-change');
        }

        res.json({ status: 'ok' });
    } catch (err) {
        console.error('Webhook error:', err);
        res.status(500).json({ error: 'Internal error' });
    }
});

// ==================== STATIC DATA SERVICE/PACKAGE ====================
const Services = {
    web: { name: 'Web Development', price: 250000 },
    desain: { name: 'Desain Grafis', price: 150000 },
    seo: { name: 'SEO Optimization', price: 350000 },
    marketing: { name: 'Digital Marketing', price: 500000 },
    ai: { name: 'AI Automation', price: 400000 },
    security: { name: 'Keamanan Website', price: 300000 }
};

const Packages = {
    starter: { name: 'Starter', multiplier: 1 },
    business: { name: 'Business', multiplier: 2.5 },
    enterprise: { name: 'Enterprise', multiplier: 6 }
};

// ==================== 404 ====================
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// ==================== START ====================
app.listen(PORT, () => {
    console.log(`JasaDigital server running at http://localhost:${PORT}`);
    console.log(`Midtrans mode: ${MIDTRANS_IS_PRODUCTION ? 'PRODUCTION' : 'SANDBOX'}`);
    console.log(`Penyimpanan: ${db.usingPostgres ? 'PostgreSQL' : 'file JSON (fallback)'}`);
});