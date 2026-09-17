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
        // Production: ganti dengan GA4 / Plausible / Matomo
        // window.gtag('event', eventName, data);
        console.log('[Event]', eventName, data || '');
    }

    // ============ INIT ============
    document.addEventListener('DOMContentLoaded', function () {
        handleNavbarScroll();
        initCounters();
        initPromoCountdown();
        initBillingToggle();
        initSmoothScroll();
        initSecurity();

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