/* ============================================================
 * JasaDigital - Main Landing Page Logic
 * ============================================================ */

(function () {
    'use strict';

    // ============ NAVBAR SCROLL ============
    function handleNavbarScroll() {
        var nav = document.getElementById('mainNav');
        if (window.scrollY > 50) {
            nav.classList.add('navbar-scrolled');
        } else {
            nav.classList.remove('navbar-scrolled');
        }
    }

    // ============ ANIMATED COUNTERS ============
    function animateCounter(el, target, suffix) {
        var current = 0;
        var step = Math.max(1, Math.round(target / 60));
        var timer = setInterval(function () {
            current += step;
            if (current >= target) {
                current = target;
                clearInterval(timer);
            }
            el.textContent = current.toLocaleString('id-ID') + (suffix || '');
        }, 30);
    }

    function initCounters() {
        var statOrder = document.getElementById('statOrders');
        if (statOrder && statOrder.dataset.animated !== 'yes' &&
            statOrder.textContent.indexOf('5') !== -1) {
            // Only animate if it's raw number; skip for default text like "1.500+"
            var raw = parseInt(statOrder.textContent.replace(/[^0-9]/g, ''), 10);
            if (raw > 0 && raw < 100) {
                statOrder.dataset.animated = 'yes';
                animateCounter(statOrder, raw, '+');
            }
        }
    }

    // ============ PROMO COUNTDOWN (opening soon) ============
    function initPromoCountdown() {
        // Example: countdown 7 days from now
        var end = Date.now() + 7 * 24 * 60 * 60 * 1000;
        var el = document.getElementById('promoCountdown');
        if (!el) return;
        setInterval(function () {
            var remaining = end - Date.now();
            if (remaining <= 0) return;
            var days = Math.floor(remaining / 86400000);
            var hours = Math.floor((remaining % 86400000) / 3600000);
            var mins = Math.floor((remaining % 3600000) / 60000);
            var secs = Math.floor((remaining % 60000) / 1000);
            el.textContent = days + 'd ' + hours + 'h ' + mins + 'm ' + secs + 's';
        }, 1000);
    }

    // ============ BILLING TOGGLE (annual discount) ============
    function initBillingToggle() {
        var toggle = document.getElementById('annualSwitch');
        if (!toggle) return;
        var prices = {
            starter: { onetime: 250000, monthly: 250000 },
            business: { onetime: 750000, monthly: 750000 },
            enterprise: { onetime: 2500000, monthly: 2500000 }
        };

        toggle.addEventListener('change', function () {
            var annual = this.checked;
            var isAnnual = annual;
            var discountMultiplier = isAnnual ? 0.75 : 1; // -25%
            updatePricingDisplay(discountMultiplier);
        });
    }

    function updatePricingDisplay(multiplier) {
        document.querySelectorAll('.pricing-card').forEach(function (card, idx) {
            var priceEl = card.querySelector('.price');
            if (!priceEl) return;
            var base = (2500000 + (750000 * idx)); // approximate for demo
            var price = Math.round((base * multiplier) / 1000) / 1 + ' jt';
            // Simplified for readability - full logic in real system
        });
    }

    // ============ FEATURE SMOOTH SCROLL ============
    function initSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(function (link) {
            link.addEventListener('click', function (e) {
                var href = this.getAttribute('href');
                if (href.length > 1) {
                    var target = document.querySelector(href);
                    if (target) {
                        e.preventDefault();
                        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }
            });
        });
    }

    // ============ PHISHING/ANTI-XSS PROTECTION (client side) ============
    function initSecurity() {
        // 1. Detect if page loaded in iframe from different origin (clickjacking protection)
        try {
            if (window.self !== window.top) {
                document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;"><p>⚠️ Halaman ini tidak dapat ditampilkan di iframe untuk melindungi Anda dari phishing.</p></div>';
            }
        } catch (e) {
            document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;"><p>Halaman ini diblokir dari embedding untuk keamanan Anda.</p></div>';
        }

        // 2. Warn against "dangerous" URL params
        // (e.g. prevent javascript: URLs)
        document.querySelectorAll('a[href]').forEach(function (a) {
            var href = a.getAttribute('href');
            if (href && /^javascript:/i.test(href)) {
                a.removeAttribute('href');
            }
            if (href && href.indexOf('data:text/html') === 0) {
                a.removeAttribute('href');
            }
        });

        // 3. Disable form submissions without validation (already handled in order.js)
        // 4. Strict external links: add rel="noopener noreferrer"
        document.querySelectorAll('a[target="_blank"]').forEach(function (a) {
            a.setAttribute('rel', 'noopener noreferrer');
        });
    }

    // ============ ANALYTICS HOOK (demo) ============
    function trackEvent(eventName, data) {
        // Jika Google Analytics sudah aktif, kirim event ke GA4
        if (typeof window.gtag === 'function') {
            window.gtag('event', eventName, data || {});
        }
        console.log('[Event]', eventName, data || '');
    }

    // ============ CEK STATUS ORDER ============
    var BACKEND_URL = 'https://jasadesign-backend.onrender.com';
    var STATUS_LABELS = {
        pending: 'Menunggu Pembayaran',
        paid: 'Sudah Dibayar',
        processing: 'Dalam Proses Pengerjaan',
        verified: 'Terverifikasi',
        done: 'Selesai',
        cancelled: 'Dibatalkan',
        refunded: 'Refund'
    };
    var STATUS_COLORS = {
        pending: 'warning', paid: 'primary', processing: 'info',
        verified: 'success', done: 'success', cancelled: 'danger', refunded: 'secondary'
    };

    function esc(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function fmtRp(n) {
        return 'Rp' + Number(n || 0).toLocaleString('id-ID');
    }

    function statusBadge(status) {
        var st = status || '?';
        var c = STATUS_COLORS[st] || 'secondary';
        return '<span class="badge bg-' + c + '">' + esc(STATUS_LABELS[st] || st) + '</span>';
    }

    function initCekOrder() {
        var form = document.getElementById('cekOrderForm');
        if (!form) return;

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var input = document.getElementById('cekOrderInput');
            var out = document.getElementById('cekOrderResult');
            var no = (input ? input.value : '').trim().toUpperCase();
            if (!no) {
                out.innerHTML = '<div class="alert alert-warning mb-0">Masukkan nomor order terlebih dahulu.</div>';
                return;
            }
            out.innerHTML = '<div class="text-center py-3"><span class="spinner-border text-primary"></span></div>';

            trackEvent('cek_order', { order_no: no });

            fetch(BACKEND_URL + '/api/orders/' + encodeURIComponent(no))
                .then(function (r) {
                    if (r.status === 404) throw new Error('NOT_FOUND');
                    if (!r.ok) throw new Error('ERR');
                    return r.json();
                })
                .then(function (o) {
                    out.innerHTML =
                        '<div class="alert alert-success mb-0">' +
                        '<div class="fw-bold mb-1"><i class="bi bi-check-circle me-1"></i>Order <span class="text-primary">' + esc(o.orderNo) + '</span> ' + statusBadge(o.status) + '</div>' +
                        '<small class="d-block text-muted">Metode: ' + esc(o.paymentMethod || '-') + '</small>' +
                        '<small class="d-block text-muted">Total: <strong class="text-dark">' + fmtRp(o.total) + '</strong></small>' +
                        '</div>';
                })
                .catch(function () {
                    // Fallback: cari di order demo lokal (mode testing)
                    var local = [];
                    try { local = JSON.parse(localStorage.getItem('jasaOrders')) || []; } catch (x) { local = []; }
                    var found = null;
                    for (var i = 0; i < local.length; i++) {
                        if (local[i].orderNo === no) { found = local[i]; break; }
                    }
                    if (found) {
                        out.innerHTML =
                            '<div class="alert alert-info mb-0">' +
                            '<div class="fw-bold mb-1"><i class="bi bi-info-circle me-1"></i>Order <span class="text-primary">' + esc(found.orderNo) + '</span> ' + statusBadge(found.status) + '</div>' +
                            '<small class="d-block text-muted">' + esc(found.serviceName || '') + '</small>' +
                            '</div>';
                    } else {
                        out.innerHTML =
                            '<div class="alert alert-warning mb-0"><i class="bi bi-search me-1"></i>Order <strong>' + esc(no) + '</strong> tidak ditemukan. Periksa kembali nomor order Anda atau hubungi kami via WhatsApp.</div>';
                    }
                });
        });
    }

    // ============ INIT ============
    document.addEventListener('DOMContentLoaded', function () {
        handleNavbarScroll();
        initCounters();
        initPromoCountdown();
        initBillingToggle();
        initSmoothScroll();
        initSecurity();
        initCekOrder();

        // Scroll listener for navbar
        window.addEventListener('scroll', handleNavbarScroll);

        // Track outbound clicks
        document.querySelectorAll('a[target="_blank"]').forEach(function (a) {
            a.addEventListener('click', function () {
                trackEvent('outbound_click', this.href);
            });
        });

        // Order CTAs
        document.querySelectorAll('a[href^="order.html"]').forEach(function (a) {
            a.addEventListener('click', function () {
                trackEvent('order_cta_click', this.href);
            });
        });
    });

})();