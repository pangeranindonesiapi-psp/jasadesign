/* ============================================================
 * JasaDigital - Order & Payment Logic
 * Payment methods: QRIS, Virtual Account, Bank Transfer, E-Wallet
 * Anti-phishing: input sanitization, validation, no data leaks
 * ============================================================ */

(function () {
    'use strict';

    // ============ KONFIGURASI ============
    // Ganti dengan Merchant ID & Server Key Midtrans Anda
    // Daftar di https://dashboard.snap.midtrans.com
    const CONFIG = {
        // Mode sandbox untuk testing. Ganti ke false saat production.
        SANDBOX: true,
        MERCHANT_NAME: 'JasaDigital',
        MIDTRANS_SERVER_KEY: 'SB-Mid-server-YOUR_SERVER_KEY_HERE',
        // URL backend server (Node.js). Ganti ke URL Render setelah deploy:
        // contoh: 'https://jasadesign-xxxx.onrender.com'
        BACKEND_URL: 'https://jasadesign-backend.onrender.com',
        CURRENCY: 'IDR',
        TAX_PERCENT: 0,       // PPN 11% -> 0.11 jika perlu
        SERVICE_FEE: 5000     // biaya layanan / unique midtrans fee
    };

    // Daftar layanan & harga
    const SERVICES = {
        web:       { name: 'Web Development',      price: 250000, icon: 'bi-code-slash' },
        desain:    { name: 'Desain Grafis',        price: 150000, icon: 'bi-palette' },
        seo:       { name: 'SEO Optimization',     price: 350000, icon: 'bi-search-heart' },
        marketing: { name: 'Digital Marketing',    price: 500000, icon: 'bi-megaphone' },
        ai:        { name: 'AI Automation',        price: 400000, icon: 'bi-robot' },
        security:  { name: 'Keamanan Website',     price: 300000, icon: 'bi-shield-check' }
    };

    const PACKAGES = {
        starter:    { name: 'Starter',    multiplier: 1 },
        business:   { name: 'Business',   multiplier: 2.5 },
        enterprise: { name: 'Enterprise', multiplier: 6 }
    };

    // Kode promo (untuk demo)
    const PROMOS = {
        PROMO10: { discount: 0.10, desc: 'Diskon 10%' },
        PROMO20: { discount: 0.20, desc: 'Diskon 20%' },
        GRATIS  : { discount: 0.25, desc: 'Diskon 25% (Member)' }
    };

    // Store order (localStorage utk demo - dalam produksi gunakan database)
    const ORDERS_KEY = 'jasaOrders';
    const ORDER_ID_KEY = 'lastOrderId';

    // ============ STATE ============
    let state = {
        service: null,
        package: 'starter',
        paymentMethod: 'qris',
        promo: null,
        orderNo: null,
        selectedBank: 'bca'
    };

    // ============ UTIL FUNCTIONS ============
    function formatRupiah(n) {
        return 'Rp' + Number(n).toLocaleString('id-ID');
    }

    function $(id) { return document.getElementById(id); }

    function sanitizeInput(str) {
        if (!str) return '';
        return String(str)
            .replace(/<[^>]*>/g, '')           // hapus tag HTML
            .replace(/[<>"'`]/g, '')           // hapus karakter berbahaya
            .replace(/[\u0000-\u001F\u007F]/g, '')  // hapus control chars
            .trim()
            .slice(0, 500);                    // batasi panjang
    }

    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function generateOrderNo() {
        const now = new Date();
        const dateStr = now.getFullYear().toString().slice(2) +
            String(now.getMonth() + 1).padStart(2, '0') +
            String(now.getDate()).padStart(2, '0');
        const rand = Math.floor(Math.random() * 90000 + 10000);
        return 'JD-' + dateStr + '-' + rand;
    }

    function generateVANumber(bank, amount) {
        // Format demo VA - production menggunakan Midtrans Snap API
        const bankPrefix = {
            bca:     '3901',
            mandiri: '451',
            bni:     '8808',
            bri:     '8888',
            permata: '806',
            cimb:    '890'
        };
        const prefix = bankPrefix[bank] || '999';
        const amtStr = String(amount).padStart(10, '0').slice(0, 10);
        const rand = Math.floor(Math.random() * 90 + 10);
        return prefix + amtStr + rand;
    }

    function loadOrders() {
        try {
            return JSON.parse(localStorage.getItem(ORDERS_KEY)) || [];
        } catch (e) {
            return [];
        }
    }

    function saveOrder(order) {
        const orders = loadOrders();
        order.status = 'pending';
        orders.unshift(order);
        localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
        localStorage.setItem(ORDER_ID_KEY, order.orderNo);
    }

    function findOrder(orderNo) {
        return loadOrders().find(o => o.orderNo === orderNo) || null;
    }

    function updateOrderStatus(orderNo, status) {
        const orders = loadOrders();
        const idx = orders.findIndex(o => o.orderNo === orderNo);
        if (idx !== -1) {
            orders[idx].status = status;
            localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
            return orders[idx];
        }
        return null;
    }

    // ============ CALCULATE PRICE ============
    function getBasePrice() {
        const svc = SERVICES[state.service];
        if (!svc) return 0;
        const pkg = PACKAGES[state.package] || PACKAGES.starter;
        return Math.round(svc.price * pkg.multiplier);
    }

    function getTotalPrice() {
        let base = getBasePrice();
        if (state.promo) {
            base = base - (base * state.promo.discount);
        }
        base = base + CONFIG.SERVICE_FEE;
        return Math.round(base);
    }

    function updateSummary() {
        const svc = SERVICES[state.service];
        const pkg = PACKAGES[state.package];

        $('summaryService').textContent = svc ? 'Layanan: ' + svc.name : 'Layanan: -';
        $('summaryPackage').textContent = pkg ? 'Paket: ' + pkg.name : 'Paket: -';

        let total = getTotalPrice();
        let base = getBasePrice();
        let html = formatRupiah(base);
        if (state.promo) {
            const disc = Math.round(base * state.promo.discount);
            html = '<span class="text-muted text-decoration-line-through me-2">' + formatRupiah(base) + '</span>';
            html += '<span class="text-success">-' + formatRupiah(disc) + ' </span>&rarr; ';
        }
        $('summaryPrice').innerHTML = html + ' ' + (CONFIG.SERVICE_FEE ? '(+fee)' : '');
        $('totalPrice').textContent = formatRupiah(total);
    }

    // ============ INIT FORM FROM URL ============
    function initFromUrl() {
        try {
            const params = new URLSearchParams(window.location.search);
            const svc = params.get('service');
            const pkg = params.get('package');
            if (svc && SERVICES[svc]) {
                $('serviceSelect').value = svc;
                state.service = svc;
            }
            if (pkg && PACKAGES[pkg]) {
                $('packageSelect').value = pkg;
                state.package = pkg;
            }
            updateSummary();
        } catch (e) {
            // ignore
        }
    }

    // ============ VALIDATION ============
    function validateForm() {
        const form = $('orderForm');
        form.classList.add('was-validated');

        if (!form.checkValidity()) {
            scrollToFirstInvalid();
            return false;
        }

        const email = sanitizeInput($('emailInput').value);
        if (!isValidEmail(email)) {
            $('emailInput').classList.add('is-invalid');
            return false;
        }

        return true;
    }

    function scrollToFirstInvalid() {
        const invalid = document.querySelector('.was-validated :invalid');
        if (invalid) invalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // ============ BUILD ORDER ============
    function buildOrder() {
        const order = {
            orderNo: generateOrderNo(),
            service: state.service,
            serviceName: SERVICES[state.service].name,
            package: state.package,
            packageName: PACKAGES[state.package].name,
            name: sanitizeInput($('nameInput').value),
            email: sanitizeInput($('emailInput').value).toLowerCase(),
            phone: '62' + sanitizeInput($('phoneInput').value).replace(/[^0-9]/g, ''),
            description: sanitizeInput($('descInput').value),
            paymentMethod: state.paymentMethod,
            basePrice: getBasePrice(),
            discount: state.promo ? Math.round(getBasePrice() * state.promo.discount) : 0,
            serviceFee: CONFIG.SERVICE_FEE,
            total: getTotalPrice(),
            status: 'pending',
            createdAt: new Date().toISOString()
        };
        return order;
    }

    // ============ KIRIM NOTIFIKASI WA (DEMO) ============
    function notifyWhatsApp(order) {
        // Dalam produksi, kirim ke server yang memanggil WhatsApp Business API
        // Berikut hanya placeholder untuk demo
        const msg =
            '*ORDER BARU JasaDigital*\n\n' +
            'Order: ' + order.orderNo + '\n' +
            'Layanan: ' + order.serviceName + ' (' + order.packageName + ')\n' +
            'Nama: ' + order.name + '\n' +
            'Total: ' + formatRupiah(order.total) + '\n' +
            'Pembayaran: ' + order.paymentMethod.toUpperCase() + '\n\n' +
            'Silakan hubungi klien untuk konfirmasi.';
        console.log('[WhatsApp Notification]', msg);
        // Uncomment untuk auto redirect ke WA (production, ganti nomor Anda)
        // window.open('https://wa.me/6281383048811?text=' + encodeURIComponent(msg), '_blank');
    }

    // ============ RENDER PAYMENT ============
    function renderPayment(order) {
        const el = $('paymentContent');
        const method = order.paymentMethod;
        let html = '';

        // Countdown 15 menit
        const countdownEnd = Date.now() + (15 * 60 * 1000);

        html += '<div class="payment-box">';
        html += '<span class="payment-order-id">Order: <strong>' + order.orderNo + '</strong></span>';
        html += '<div class="payment-amount gradient-text">' + formatRupiah(order.total) + '</div>';
        html += '<p class="text-muted small">Silakan selesaikan pembayaran sebelum batas waktu.</p>';

        if (method === 'qris') {
            // QRIS
            html += '<div class="qr-placeholder">';
            html += '<div class="text-center p-4">';
            html += '<i class="bi bi-qr-code" style="font-size:5rem;color:var(--text-dark)"></i>';
            html += '<p class="small mt-2 mb-0">QRIS - ' + CONFIG.MERCHANT_NAME + '</p>';
            html += '</div></div>';
            html += '<p class="small text-muted">Scan menggunakan <strong>GoPay, OVO, DANA, ShopeePay, LinkAja, atau aplikasi bank</strong> yang mendukung QRIS.</p>';
        } else if (method === 'va') {
            // Virtual Account
            const banks = ['bca', 'mandiri', 'bni', 'bri', 'permata', 'cimb'];
            html += '<div class="render-bank-select">';
            html += '<p class="text-muted small text-start mb-2">Pilih Bank:</p>';
            html += '<div class="d-flex gap-2 flex-wrap justify-content-center mb-3">';
            banks.forEach(b => {
                html += '<button class="btn btn-sm ' + (b === state.selectedBank ? 'btn-accent' : 'btn-outline-primary') +
                    '" data-bank="' + b + '">' + b.toUpperCase() + '</button>';
            });
            html += '</div></div>';

            const vaNumber = generateVANumber(state.selectedBank, order.total);

            html += '<div class="va-box">';
            html += '<div class="d-flex justify-content-between align-items-start mb-2">';
            html += '<div>';
            html += '<small class="text-muted d-block mb-1">Nomor VA</small>';
            html += '<span class="va-number">' + vaNumber + '</span>';
            html += '</div>';
            html += '<button class="copy-btn" onclick="copyToClipboard(\'' + vaNumber + '\', this)">Copy</button>';
            html += '</div>';
            html += '</div>';

            html += '<ol class="payment-steps">';
            html += '<li>1. Buka aplikasi mobile banking <strong>' + state.selectedBank.toUpperCase() + '</strong></li>';
            html += '<li>2. Pilih menu <strong>Transfer &rarr; Virtual Account</strong></li>';
            html += '<li>3. Masukkan nomor VA di atas dan ikuti petunjuk</li>';
            html += '<li>4. Nominal otomatis terisi sesuai total tagihan</li>';
            html += '</ol>';
        } else if (method === 'transfer') {
            // Bank Transfer manual
            html += '<div class="va-box">';
            html += '<small class="text-muted d-block mb-1">Bank BRI</small>';
            html += '<h4 class="mb-1"><strong>1234-5678-9010</strong></h4>';
            html += '<small class="text-muted d-block">a.n. JasaDigital</small>';
            html += '<button class="copy-btn mt-2" onclick="copyToClipboard(\'123456789010\', this)">Copy Nomor Rekening</button>';
            html += '</div>';
            html += '<ol class="payment-steps">';
            html += '<li>1. Transfer sejumlah <strong>' + formatRupiah(order.total) + '</strong></li>';
            html += '<li>2. Kirim bukti transfer via <strong>WhatsApp</strong> ke +62 813-8304-8811 atau tekan tombol di bawah</li>';
            html += '<li>3. Konfirmasi maksimal 2x24 jam, order langsung diproses</li>';
            html += '</ol>';
        } else if (method === 'ewallet') {
            // E-Wallet
            html += '<div class="va-box">';
            html += '<small class="text-muted d-block mb-1">Pilih E-Wallet</small>';
            html += '<div class="d-flex gap-2 flex-wrap">';
            html += '<span class="payment-chip"><i class="bi bi-phone me-1"></i>GoPay</span>';
            html += '<span class="payment-chip"><i class="bi bi-phone me-1"></i>OVO</span>';
            html += '<span class="payment-chip"><i class="bi bi-phone me-1"></i>DANA</span>';
            html += '</div></div>';
            html += '<p class="small text-muted">Anda akan dialihkan ke halaman pembayaran setelah memilih metode.</p>';
        }

        // Countdown
        html += '<div class="payment-countdown" id="paymentCountdown" data-end="' + countdownEnd + '">⏳ Sisa waktu: 15:00</div>';

        // Button
        color = method === 'transfer' ? 'success' : 'accent';
        html += '<button class="btn btn-' + color + ' btn-lg w-100 fw-bold payment-done-btn" id="markPaidBtn">';
        html += '<i class="bi bi-check-circle me-2"></i> Saya Sudah Bayar';
        html += '</button>';
        html += '<p class="small text-muted mt-2">Butuh bantuan? <a href="https://wa.me/6281383048811" target="_blank" rel="noopener">Hubungi kami</a></p>';

        html += '</div>';

        el.innerHTML = html;

        // Bind bank selector
        el.querySelectorAll('[data-bank]').forEach(btn => {
            btn.addEventListener('click', function () {
                state.selectedBank = this.dataset.bank;
                renderPayment(order); // re-render
            });
        });

        // Bind copy
        el.querySelectorAll('.copy-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const text = this.previousElementSibling && this.previousElementSibling.tagName === 'SPAN' ?
                    this.previousElementSibling.textContent : this.classList.contains('mt-2') ?
                    this.textContent.replace('Copy Nomor Rekening', '') : '';
                copyToClipboard(text.trim(), this);
            });
        });

        // Bind paid button
        const paidBtn = el.querySelector('#markPaidBtn');
        if (paidBtn) {
            paidBtn.addEventListener('click', function () {
                updateOrderStatus(order.orderNo, 'paid');
                this.disabled = true;
                this.innerHTML = '<i class="bi bi-check-circle-fill me-2"></i> Menunggu Konfirmasi Admin...';
                setTimeout(function () {
                    const modal = bootstrap.Modal.getInstance($('paymentModal'));
                    modal.hide();
                    showSuccess(order);
                    notifyWhatsApp(order);
                }, 1500);
            });
        }

        // Start countdown
        startCountdown(countdownEnd);
    }

    function startCountdown(endTime) {
        const el = $('paymentCountdown');
        if (!el) return;

        function tick() {
            const remaining = endTime - Date.now();
            if (remaining <= 0) {
                el.textContent = '⏳ Waktu habis - Generate ulang order';
                el.style.background = '#FEE2E2';
                return;
            }
            const mins = Math.floor(remaining / 60000);
            const secs = Math.floor((remaining % 60000) / 1000);
            el.textContent = '⏳ Sisa waktu: ' +
                String(mins).padStart(2, '0') + ':' +
                String(secs).padStart(2, '0');
        }
        tick();
        setInterval(tick, 1000);
    }

    function showSuccess(order) {
        $('successOrderId').textContent = 'Order ' + order.orderNo + ' telah diterima. Status: Menunggu konfirmasi.';
        const modal = new bootstrap.Modal($('successModal'));
        modal.show();
        resetForm();
    }

    function resetForm() {
        $('orderForm').reset();
        $('orderForm').classList.remove('was-validated');
        state = {
            service: null,
            package: 'starter',
            paymentMethod: 'qris',
            promo: null,
            orderNo: null,
            selectedBank: 'bca'
        };
        $('promoInput').value = '';
        $('promoMsg').innerHTML = '';
        updateSummary();
    }

    // ============ COPY TO CLIPBOARD (global) ============
    window.copyToClipboard = function (text, btn) {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(function () {
                if (btn) {
                    const old = btn.textContent;
                    btn.textContent = '✓ Copied';
                    setTimeout(function () { btn.textContent = old; }, 2000);
                }
            }).catch(function () {
                fallbackCopy(text, btn);
            });
        } else {
            fallbackCopy(text, btn);
        }
    };

    function fallbackCopy(text, btn) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand('copy');
            if (btn) {
                const old = btn.textContent;
                btn.textContent = '✓ Copied';
                setTimeout(function () { btn.textContent = old; }, 2000);
            }
        } catch (e) {
            // ignore
        }
        document.body.removeChild(ta);
    }

    // ============ EVENT LISTENERS ============
    document.addEventListener('DOMContentLoaded', function () {
        // Init from URL
        initFromUrl();

        // Service change
        $('serviceSelect').addEventListener('change', function () {
            state.service = this.value || null;
            updateSummary();
        });

        // Package change
        $('packageSelect').addEventListener('change', function () {
            state.package = this.value || 'starter';
            updateSummary();
        });

        // Payment method radio
        document.querySelectorAll('input[name="paymentMethod"]').forEach(function (radio) {
            radio.addEventListener('change', function () {
                state.paymentMethod = this.value;
            });
        });

        // Promo
        $('promoBtn').addEventListener('click', function () {
            const code = sanitizeInput($('promoInput').value).toUpperCase();
            const promo = PROMOS[code];
            const msg = $('promoMsg');
            if (promo) {
                state.promo = promo;
                msg.innerHTML = '<span class="text-success fw-semibold">✓ ' + promo.desc + ' diterapkan!</span>';
                updateSummary();
            } else {
                state.promo = null;
                msg.innerHTML = '<span class="text-danger">Kode promo tidak valid.</span>';
                updateSummary();
            }
        });

        // Form submit
        $('orderForm').addEventListener('submit', function (e) {
            e.preventDefault();
            e.stopPropagation();

            if (!validateForm()) return;

            const btn = $('submitBtn');
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Memproses...';

            const order = buildOrder();

            // Coba kirim ke backend (bikin transaksi Midtrans asli)
            submitToBackend(order).then(function (backendResult) {
                if (backendResult && backendResult.snapRedirect) {
                    // Backend aktif: buka halaman pembayaran Midtrans Snap
                    saveOrder(order);
                    btn.disabled = false;
                    btn.innerHTML = '<i class="bi bi-lock-fill me-2"></i>Bayar Sekarang &amp; Pesan';
                    window.open(backendResult.snapRedirect, '_blank');
                    showInfoModal(order.orderNo);
                    return;
                }
                // Backend tidak aktif / gagal bikin transaksi -> mode demo lokal
                setTimeout(function () {
                    saveOrder(order);
                    btn.disabled = false;
                    btn.innerHTML = '<i class="bi bi-lock-fill me-2"></i>Bayar Sekarang &amp; Pesan';
                    renderPayment(order);
                    const modal = new bootstrap.Modal($('paymentModal'));
                    modal.show();
                }, 400);
            }).catch(function () {
                setTimeout(function () {
                    saveOrder(order);
                    btn.disabled = false;
                    btn.innerHTML = '<i class="bi bi-lock-fill me-2"></i>Bayar Sekarang &amp; Pesan';
                    renderPayment(order);
                    const modal = new bootstrap.Modal($('paymentModal'));
                    modal.show();
                }, 400);
            });
        });
    });

    // ============ KIRIM ORDER KE BACKEND (Midtrans) ============
    function submitToBackend(order) {
        const payload = {
            service: order.service,
            package: order.package,
            name: order.name,
            email: order.email,
            phone: order.phone.replace(/[^0-9]/g, ''),
            description: order.description,
            paymentMethod: order.paymentMethod
        };

        return fetch(CONFIG.BACKEND_URL + '/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(10000)
        })
            .then(function (res) {
                if (!res.ok) throw new Error('Backend status: ' + res.status);
                return res.json();
            })
            .then(function (data) {
                if (data && data.order) return data.order;
                throw new Error('Respons backend tidak valid');
            });
    }

    function showInfoModal(orderNo) {
        // Modal info sederhana pakai Bootstrap Toast
        const modalEl = $('paymentModal');
        const content = $('paymentContent');
        content.innerHTML =
            '<div class="payment-box">' +
            '<div class="success-icon mb-3"><i class="bi bi-arrow-up-right-circle-fill"></i></div>' +
            '<h5 class="fw-bold">Order ' + orderNo + ' dibuat!</h5>' +
            '<p class="text-muted">Halaman pembayaran Midtrans sudah dibuka di tab baru. Selesaikan pembayaran di sana untuk konfirmasi otomatis.</p>' +
            '<a class="btn btn-accent w-100 fw-bold" href="index.html">Kembali ke Beranda</a>' +
            '</div>';
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }

})();