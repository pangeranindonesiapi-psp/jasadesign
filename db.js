// ==================== PENYIMPANAN ORDER ====================
// Mode 1 (dianjurkan): PostgreSQL via Supabase/Neon/Postgres biasa.
//   Aktif otomatis bila env DATABASE_URL diisi.
// Mode 2 (fallback)  : file JSON di server (bisa hilang saat redeploy Render).
//
// Penggunaan:
//   const store = require('./db');
//   store.loadSeed(async o => { ... })  // panggil saat startup
//   await store.saveOrder(order)
//   await store.patchOrder(orderNo, { status, paidAt })
//   const order = await store.getOrder(orderNo)
//   const orders = await store.getAllOrders()

const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL || '';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

let pool = null;
let usingPostgres = false;

if (DATABASE_URL) {
    try {
        const { Pool } = require('pg');
        pool = new Pool({
            connectionString: DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });
        usingPostgres = true;
    } catch (e) {
        console.warn('PostgreSQL (pg) belum terinstall. Pakai fallback file JSON. Error:', e.message);
    }
}

// ---------- PostgreSQL ----------
async function initPostgres() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS orders (
            order_no   TEXT PRIMARY KEY,
            data       JSONB NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    `);
    console.log('[db] PostgreSQL siap: tabel "orders" aktif.');
}

async function saveOrderPostgres(order) {
    await pool.query(
        `INSERT INTO orders (order_no, data) VALUES ($1, $2::jsonb)
         ON CONFLICT (order_no) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
        [order.orderNo, JSON.stringify(order)]
    );
}

async function patchOrderPostgres(orderNo, patch) {
    const cur = await getOrderPostgres(orderNo);
    if (!cur) return null;
    const merged = Object.assign({}, cur, patch);
    await saveOrderPostgres(merged);
    return merged;
}

async function getOrderPostgres(orderNo) {
    const r = await pool.query('SELECT data FROM orders WHERE order_no = $1', [orderNo]);
    return r.rows.length ? r.rows[0].data : null;
}

async function getAllOrdersPostgres() {
    const r = await pool.query('SELECT data FROM orders ORDER BY updated_at ASC');
    return r.rows.map(row => row.data);
}

// ---------- Fallback: file JSON ----------
function persistFile() {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        const data = {};
        ordersStoreMap.forEach((o, k) => { data[k] = o; });
        fs.writeFileSync(ORDERS_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Gagal simpan orders (file):', e.message);
    }
}

function getOrderFile(orderNo) {
    return ordersStoreMap.get(orderNo) || null;
}

async function saveOrderFile(order) {
    ordersStoreMap.set(order.orderNo, order);
    persistFile();
}

async function patchOrderFile(orderNo, patch) {
    const cur = getOrderFile(orderNo);
    if (!cur) return null;
    const merged = Object.assign({}, cur, patch);
    await saveOrderFile(merged);
    return merged;
}

async function getAllOrdersFile() {
    return Array.from(ordersStoreMap.values());
}

// ---------- API publik ----------
const ordersStoreMap = new Map();

module.exports = {
    get usingPostgres() { return usingPostgres; },

    // Panggil sekali saat startup: inisialisasi DB/tabel atau muat file.
    async init() {
        if (usingPostgres) {
            await initPostgres();
        } else {
            try {
                if (fs.existsSync(ORDERS_FILE)) {
                    const data = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
                    Object.keys(data).forEach(k => ordersStoreMap.set(k, data[k]));
                    console.log('[db] Memuat orders dari file:', ordersStoreMap.size, 'order');
                }
            } catch (e) {
                console.error('Gagal memuat orders (file):', e.message);
            }
        }
    },

    async saveOrder(order) {
        if (usingPostgres) return saveOrderPostgres(order);
        return saveOrderFile(order);
    },

    async patchOrder(orderNo, patch) {
        if (usingPostgres) return patchOrderPostgres(orderNo, patch);
        return patchOrderFile(orderNo, patch);
    },

    async getOrder(orderNo) {
        if (usingPostgres) return getOrderPostgres(orderNo);
        return getOrderFile(orderNo);
    },

    async getAllOrders() {
        if (usingPostgres) return getAllOrdersPostgres();
        return getAllOrdersFile();
    }
};