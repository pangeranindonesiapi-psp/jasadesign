/* ============================================================
 * JasaDigital - Admin Dashboard Logic
 * ============================================================ */

(function () {
    'use strict';

    const ORDERS_KEY = 'jasaOrders';
    const PROMOS_KEY = 'jasaPromos';
    const AUTH_KEY = 'jasaAdminAuth';

    var ADMIN_USER = 'admin';
    var ADMIN_PASS = 'Psp130226';

    var DEFAULT_PROMOS = {
        PROMO10: { discount: 0.10, desc: 'Diskon 10%' },
        PROMO20: { discount: 0.20, desc: 'Diskon 20%' },
        GRATIS: { discount: 0.25, desc: 'Diskon 25% (Member)' }
    };

    var STATUS_LABELS = {
        pending: 'Menunggu Bayar',
        paid: 'Sudah Bayar',
        processing: 'Dalam Proses',
        verified: 'Terverifikasi',
        done: 'Selesai',
        cancelled: 'Dibatalkan'
    };

    var PAYMENT_LABELS = {
        qris: 'QRIS',
        va: 'Virtual Account',
        transfer: 'Bank Transfer',
        ewallet: 'E-Wallet'
    };

    function $(id) { return document.getElementById(id); }
    function fmt(n) { return 'Rp' + Number(n || 0).toLocaleString('id-ID'); }

    function fmtDate(iso) {
        if (!iso) return '-';
        try {
            var d = new Date(iso);
            return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) +
                ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        } catch (e) { return iso; }
    }

    function loadOrders() {
        try { return JSON.parse(localStorage.getItem(ORDERS_KEY)) || []; }
        catch (e) { return []; }
    }

    function loadPromos() {
        try {
            var p = JSON.parse(localStorage.getItem(PROMOS_KEY));
            return p || Object.assign({}, DEFAULT_PROMOS);
        } catch (e) { return Object.assign({}, DEFAULT_PROMOS); }
    }

    function savePromos(promos) {
        localStorage.setItem(PROMOS_KEY, JSON.stringify(promos));
    }

    var currentOrders = [];
    var currentStatusFilter = 'all';
    var currentSearch = '';

    var SETTINGS_KEY = 'jasaAdminSettings';

    function loadSettings() {
        try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; }
        catch (e) { return {}; }
    }

    function saveSettings(s) {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    }

    var backendOrders = [];
    var backendSynced = false;

    // ============ AMBIL ORDER DARI BACKEND (Render) ============
    function syncBackendOrders() {
        var settings = loadSettings();
        var url = settings.backendUrl || 'https://jasadesign-backend.onrender.com';
        var key = settings.adminKey || 'Psp130226';

        url = url.replace(/\/+$/, '');

        var fetchOpts = {
            method: 'GET',
            headers: { 'X-Admin-Key': key }
        };

        return fetch(url + '/api/admin/orders', fetchOpts)
            .then(function (res) {
                if (!res.ok) throw new Error('Gagal ambil order dari backend (' + res.status + ')');
                return res.json();
            })
            .then(function (data) {
                backendOrders = (data && data.orders) || [];
                backendSynced = true;
                var msg = $('syncMsg');
                if (msg) msg.textContent = 'Berhasil ambil ' + backendOrders.length + ' order dari backend.';
                renderEverything();
                return backendOrders;
            })
            .catch(function (err) {
                var msg = $('syncMsg');
                if (msg) msg.textContent = 'Gagal: ' + err.message;
                throw err;
            });
    }

    function checkAuth() {
        return sessionStorage.getItem(AUTH_KEY) === '1';
    }

    function showLogin() {
        $('loginScreen').classList.remove('d-none');
        $('adminShell').classList.add('d-none');
    }

    function showAdmin() {
        $('loginScreen').classList.add('d-none');
        $('adminShell').classList.remove('d-none');
    }

    function handleLogin(e) {
        e.preventDefault();
        var user = $('loginUser').value.trim();
        var pass = $('loginPass').value;
        if (user === ADMIN_USER && pass === ADMIN_PASS) {
            sessionStorage.setItem(AUTH_KEY, '1');
            showAdmin();
            renderEverything();
        } else {
            alert('Username atau password salah!');
        }
    }

    function renderStats() {
        var orders = currentOrders;
        var revenue = 0, pending = 0, done = 0;
        orders.forEach(function (o) {
            if (o.status === 'paid' || o.status === 'processing' || o.status === 'verified' || o.status === 'done') {
                revenue += (o.total || 0);
            }
            if (o.status === 'pending') pending++;
            if (o.status === 'done') done++;
        });
        $('statTotal').textContent = orders.length;
        $('statRevenue').textContent = fmt(revenue);
        $('statPending').textContent = pending;
        $('statDone').textContent = done;
    }

    function renderOrders() {
        var orders = currentOrders;
        if (currentStatusFilter !== 'all') {
            orders = orders.filter(function (o) { return o.status === currentStatusFilter; });
        }
        if (currentSearch) {
            var q = currentSearch.toLowerCase();
            orders = orders.filter(function (o) {
                return (o.orderNo || '').toLowerCase().indexOf(q) !== -1 ||
                    (o.name || '').toLowerCase().indexOf(q) !== -1 ||
                    (o.email || '').toLowerCase().indexOf(q) !== -1 ||
                    (o.serviceName || '').toLowerCase().indexOf(q) !== -1;
            });
        }

        var el = $('ordersTable');
        if (!orders.length) {
            el.innerHTML = '<div class="text-center p-5 text-muted"><i class="bi bi-inbox fs-1 d-block mb-2"></i>Belum ada order</div>';
            return;
        }

        var html = '<div class="table-responsive"><table class="table table-hover align-middle"><thead><tr>' +
            '<th>Order #</th><th>Layanan</th><th>Klien</th><th>Metode</th><th>Total</th><th>Status</th><th>Tanggal</th><th></th>' +
            '</tr></thead><tbody>';

        orders.forEach(function (o) {
            html += '<tr>' +
                '<td class="fw-semibold">' + (o.orderNo || '-') + '</td>' +
                '<td>' + (o.serviceName || '-') + '<br><small class="text-muted">' + (o.packageName || '') + '</small></td>' +
                '<td>' + (o.name || '-') + '<br><small class="text-muted">' + (o.email || '') + '</small></td>' +
                '<td>' + (PAYMENT_LABELS[o.paymentMethod] || o.paymentMethod) + '</td>' +
                '<td class="fw-bold">' + fmt(o.total || 0) + '</td>' +
                '<td><span class="status-badge status-' + (o.status || 'pending') + '">' + (STATUS_LABELS[o.status] || o.status) + '</span></td>' +
                '<td><small class="text-muted">' + fmtDate(o.createdAt) + '</small></td>' +
                '<td><button class="btn btn-sm btn-outline-primary" data-detail="' + window.escapeAttr(o.orderNo) + '">Detail</button></td>' +
                '</tr>';
        });

        html += '</tbody></table></div>';
        el.innerHTML = html;

        el.querySelectorAll('[data-detail]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                window.openOrderDetail(this.dataset.detail);
            });
        });
    }

    window.escapeAttr = function (str) {
        return String(str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    };

    function renderRecentOrders() {
        var recent = currentOrders.slice(0, 5);
        var el = $('recentOrders');
        if (!recent.length) {
            el.innerHTML = '<div class="text-center p-4 text-muted"><i class="bi bi-inbox fs-3 d-block mb-2"></i>Belum ada order. Bagikan link website Anda!</div>';
            return;
        }
        var html = '<div class="table-responsive"><table class="table table-sm align-middle"><thead><tr>' +
            '<th>Order #</th><th>Layanan</th><th>Klien</th><th>Total</th><th>Status</th>' +
            '</tr></thead><tbody>';
        recent.forEach(function (o) {
            html += '<tr>' +
                '<td class="fw-semibold">' + (o.orderNo || '-') + '</td>' +
                '<td>' + (o.serviceName || '-') + '</td>' +
                '<td>' + (o.name || '-') + '</td>' +
                '<td class="fw-bold">' + fmt(o.total || 0) + '</td>' +
                '<td><span class="status-badge status-' + (o.status || 'pending') + '">' + (STATUS_LABELS[o.status] || o.status) + '</span></td>' +
                '</tr>';
        });
        html += '</tbody></table></div>';
        el.innerHTML = html;
    }

    function renderServices() {
        var el = $('servicesTable');
        var services = [
            { icon: 'bi-code-slash', color: 'bg-primary-soft', name: 'Web Development', price: 'Rp250rb', desc: 'Landing page, toko online, aplikasi web' },
            { icon: 'bi-palette', color: 'bg-danger-soft', name: 'Desain Grafis', price: 'Rp150rb', desc: 'Logo, branding, feed, materi marketing' },
            { icon: 'bi-search-heart', color: 'bg-success-soft', name: 'SEO Optimization', price: 'Rp350rb', desc: 'Optimasi Google & keyword' },
            { icon: 'bi-megaphone', color: 'bg-warning-soft', name: 'Digital Marketing', price: 'Rp500rb', desc: 'Meta/Google Ads, funnel, content' },
            { icon: 'bi-robot', color: 'bg-cyan-soft', name: 'AI Automation', price: 'Rp400rb', desc: 'Chatbot, AI copywriting, automation' },
            { icon: 'bi-shield-check', color: 'bg-purple-soft', name: 'Keamanan Website', price: 'Rp300rb', desc: 'Audit, proteksi phishing, SSL' }
        ];
        var html = '<div class="table-responsive"><table class="table align-middle"><thead><tr>' +
            '<th>Layanan</th><th>Deskripsi</th><th>Harga Mulai</th><th>Status</th></tr></thead><tbody>';
        services.forEach(function (s) {
            html += '<tr>' +
                '<td><div class="d-flex align-items-center gap-2"><span class="service-icon ' + s.color + '" style="width:38px;height:38px;font-size:1rem;margin:0"><i class="bi ' + s.icon + '"></i></span><span class="fw-semibold">' + s.name + '</span></div></td>' +
                '<td class="text-muted small">' + s.desc + '</td>' +
                '<td class="fw-semibold">' + s.price + '</td>' +
                '<td><span class="status-badge status-verified">Aktif</span></td>' +
                '</tr>';
        });
        html += '</tbody></table></div>';
        el.innerHTML = html;
    }

    function renderPromos() {
        var promos = loadPromos();
        var el = $('promosTable');
        var html = '<div class="table-responsive"><table class="table align-middle"><thead><tr>' +
            '<th>Kode</th><th>Diskon</th><th>Status</th><th></th></tr></thead><tbody>';
        Object.keys(promos).forEach(function (code) {
            var p = promos[code];
            html += '<tr>' +
                '<td class="fw-bold">' + code + '</td>' +
                '<td>' + Math.round(p.discount * 100) + '%</td>' +
                '<td><span class="status-badge status-verified">Aktif</span></td>' +
                '<td><button class="btn btn-sm btn-outline-danger" data-promo-delete="' + code + '">Hapus</button></td>' +
                '</tr>';
        });
        html += '</tbody></table></div>';
        el.innerHTML = html;

        el.querySelectorAll('[data-promo-delete]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                delete promos[this.dataset.promoDelete];
                savePromos(promos);
                renderPromos();
            });
        });
    }

    window.openOrderDetail = function (orderNo) {
        var order = null;
        currentOrders.forEach(function (o) { if (o.orderNo === orderNo) order = o; });
        if (!order) return;

        $('detailOrderTitle').textContent = 'Detail Order: ' + order.orderNo;

        var html = '<div class="order-detail-section">';
        html += '<div class="mb-3 d-flex justify-content-between align-items-center">';
        html += '<span class="status-badge status-' + order.status + '">' + (STATUS_LABELS[order.status] || order.status) + '</span>';
        html += '<small class="text-muted">' + fmtDate(order.createdAt) + '</small></div>';

        html += '<h6><i class="bi bi-person me-1"></i>Data Klien</h6>';
        html += '<div class="row"><div class="col-sm-4 text-muted">Nama</div><div class="col-sm-8"><strong>' + (order.name || '-') + '</strong></div></div>';
        html += '<div class="row"><div class="col-sm-4 text-muted">Email</div><div class="col-sm-8">' + (order.email || '-') + '</div></div>';
        html += '<div class="row"><div class="col-sm-4 text-muted">WhatsApp</div><div class="col-sm-8">' + (order.phone || '-') + '</div></div>';
        html += '<hr>';

        html += '<h6><i class="bi bi-box me-1"></i>Detail Layanan</h6>';
        html += '<div class="row"><div class="col-sm-4 text-muted">Layanan</div><div class="col-sm-8"><strong>' + (order.serviceName || '-') + '</strong> (' + (order.packageName || '-') + ')</div></div>';
        html += '<div class="row"><div class="col-sm-4 text-muted">Metode Bayar</div><div class="col-sm-8">' + (PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod) + '</div></div>';
        html += '<hr>';

        html += '<h6><i class="bi bi-tag me-1"></i>Pembayaran</h6>';
        html += '<div class="row"><div class="col-sm-4 text-muted">Harga Dasar</div><div class="col-sm-8">' + fmt(order.basePrice || 0) + '</div></div>';
        if (order.discount) {
            html += '<div class="row"><div class="col-sm-4 text-muted">Diskon</div><div class="col-sm-8 text-danger">-' + fmt(order.discount) + '</div></div>';
        }
        html += '<div class="row"><div class="col-sm-4 text-muted">Biaya Layanan</div><div class="col-sm-8">' + fmt(order.serviceFee || 0) + '</div></div>';
        html += '<div class="row"><div class="col-sm-4 text-muted">Total</div><div class="col-sm-8 fw-bold fs-5">' + fmt(order.total || 0) + '</div></div>';
        html += '<hr>';

        html += '<h6><i class="bi bi-chat-left-text me-1"></i>Deskripsi Proyek</h6>';
        html += '<p class="text-muted">' + window.escapeAttr(order.description || '-') + '</p>';
        html += '</div>';

        $('orderDetailContent').innerHTML = html;

        // Actions
        var actions = $('detailActions');
        var statusHtml = '<div class="d-flex gap-2 flex-wrap">';
        statusHtml += '<button class="btn btn-sm btn-outline-primary" data-set-status="processing">Mulai Proses</button>';
        statusHtml += '<button class="btn btn-sm btn-outline-success" data-set-status="done">Tandai Selesai</button>';
        statusHtml += '<button class="btn btn-sm btn-outline-danger" data-set-status="cancelled">Batalkan</button>';
        statusHtml += '</div>';
        actions.innerHTML = statusHtml;

        actions.querySelectorAll('[data-set-status]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var newStatus = this.dataset.setStatus;
                currentOrders.forEach(function (o) { if (o.orderNo === orderNo) o.status = newStatus; });
                localStorage.setItem(ORDERS_KEY, JSON.stringify(currentOrders));
                var modal = bootstrap.Modal.getInstance($('orderDetailModal'));
                if (modal) modal.hide();
                renderEverything();
            });
        });

        new bootstrap.Modal($('orderDetailModal')).show();
    };

    function renderEverything() {
        var local = loadOrders();
        var seen = {};
        currentOrders = [];
        var merged = local.concat(backendOrders);
        merged.forEach(function (o) {
            if (!o || !o.orderNo || seen[o.orderNo]) return;
            seen[o.orderNo] = true;
            currentOrders.push(o);
        });
        renderStats();
        renderOrders();
        renderRecentOrders();
        renderServices();
        renderPromos();
    }

    function switchView(viewName) {
        document.querySelectorAll('.view').forEach(function (v) { v.classList.add('d-none'); });
        document.querySelectorAll('.admin-nav-item').forEach(function (a) { a.classList.remove('active'); });
        var target = $('view-' + viewName);
        if (target) target.classList.remove('d-none');
        var nav = document.querySelector('[data-view="' + viewName + '"]');
        if (nav) nav.classList.add('active');
        window.scrollTo(0, 0);
    }

    function logout() {
        sessionStorage.removeItem(AUTH_KEY);
        showLogin();
    }

    document.addEventListener('DOMContentLoaded', function () {
        var today = new Date();
        $('todayDate').textContent = today.toLocaleDateString('id-ID', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });

        // Auth
        if (checkAuth()) {
            showAdmin();
            renderEverything();
        } else {
            showLogin();
        }

        $('loginForm').addEventListener('submit', handleLogin);
        $('logoutBtn').addEventListener('click', function (e) {
            e.preventDefault();
            logout();
        });

        // Settings: isi nilai tersimpan
        var initialSettings = loadSettings();
        if ($('backendUrlSetting')) $('backendUrlSetting').value = initialSettings.backendUrl || 'https://jasadesign-backend.onrender.com';
        if ($('adminKeySetting')) $('adminKeySetting').value = initialSettings.adminKey || 'Psp130226';
        if ($('waNumberSetting')) $('waNumberSetting').value = initialSettings.waNumber || '6281383048811';
        if ($('midtransKeySetting')) $('midtransKeySetting').value = initialSettings.midtransKey || '';
        if (initialSettings.sandbox === false && $('sandboxToggle')) {
            $('sandboxToggle').checked = false;
        }

        $('saveSettingsBtn').addEventListener('click', function () {
            var s = loadSettings();
            var opts = {
                backendUrl: $('backendUrlSetting') ? $('backendUrlSetting').value.trim() : s.backendUrl,
                adminKey: $('adminKeySetting') ? $('adminKeySetting').value.trim() : s.adminKey,
                waNumber: $('waNumberSetting') ? $('waNumberSetting').value.trim() : s.waNumber,
                midtransKey: $('midtransKeySetting') ? $('midtransKeySetting').value.trim() : s.midtransKey,
                sandbox: $('sandboxToggle') ? $('sandboxToggle').checked : true
            };
            saveSettings(opts);
            alert('Pengaturan tersimpan.');
        });

        $('syncBackendBtn').addEventListener('click', function () {
            var btn = this;
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Mengambil...';
            syncBackendOrders()
                .catch(function () { alert('Tidak bisa terhubung ke backend. Pastikan URL & kunci admin benar.'); })
                .finally(function () {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="bi bi-arrow-repeat me-1"></i>Ambil Order dari Backend';
                });
        });

        // Nav switching
        document.querySelectorAll('.admin-nav-item[data-view]').forEach(function (item) {
            item.addEventListener('click', function (e) {
                e.preventDefault();
                switchView(this.dataset.view);
            });
        });

        // Order search & filter
        $('orderSearch').addEventListener('input', function () {
            currentSearch = this.value;
            renderOrders();
        });
        $('statusFilter').addEventListener('change', function () {
            currentStatusFilter = this.value;
            renderOrders();
        });

        // Promo add
        $('addPromoBtn').addEventListener('click', function () {
            var code = $('newPromoCode').value.trim().toUpperCase();
            var discount = parseFloat($('newPromoDiscount').value);
            if (!code) { alert('Masukkan kode promo!'); return; }
            var promos = loadPromos();
            promos[code] = { discount: discount, desc: 'Diskon ' + Math.round(discount * 100) + '%' };
            savePromos(promos);
            $('newPromoCode').value = '';
            renderPromos();
        });
    });

})();