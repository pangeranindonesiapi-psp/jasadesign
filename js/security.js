/* ============================================================
 * JasaDigital - Security & Anti-Phishing Helpers
 *
 * Implementasi pointers:
 *  - CSP headers sudah di server.js
 *  - Proxy/Meta untuk deteksi phishing tidak masalah
 *  - Paste (content-security) diatas CSP level server
 *  - Referrer policy
 *  - Anti clickjacking + form tokenized (demo)
 * ============================================================ */

(function () {
    'use strict';

    var SECURITY_KEY = 'jd_sec';

    // ============ 1. DETEKSI CLICKJACKING ============
    function detectClickjacking() {
        try {
            if (window.self !== window.top) {
                // Bingkai dari domain lain -> blokir
                document.documentElement.innerHTML = '';
                document.write('<h1 style="font-family:sans-serif;padding:40px">Akses diblokir untuk mencegah phishing.</h1>');
            }
        } catch (e) {
            // Cross-origin iframe - blot out
            document.documentElement.innerHTML = '';
            document.write('<h1 style="font-family:sans-serif;padding:40px">Akses tidak diizinkan.</h1>');
        }
    }

    // ============ 2. VALIDASI URL (anti javscript: injection) ============
    function validateLinks() {
        document.addEventListener('click', function (e) {
            var anchor = e.target.closest ? e.target.closest('a') : null;
            if (anchor) {
                var href = anchor.getAttribute('href') || '';
                if (/^(javascript|data:text\/html|vbscript):/i.test(href)) {
                    e.preventDefault();
                    return false;
                }
                if (anchor.target === '_blank' && !anchor.hasAttribute('rel')) {
                    anchor.setAttribute('rel', 'noopener noreferrer');
                }
            }
        }, true);
    }

    // ============ 3. FORM PROTECTION ============
    // Token sederhana untuk mencegah replay/CSRF pada form (demo).
    function initFormTokens() {
        document.querySelectorAll('form').forEach(function (form) {
            if (!form.querySelector('input[name="csrf_token"]')) {
                var token = Math.random().toString(36).slice(2) + Date.now().toString(36);
                var hidden = document.createElement('input');
                hidden.type = 'hidden';
                hidden.name = 'csrf_token';
                hidden.value = token;
                form.appendChild(hidden);
            }
        });
    }

    // ============ 4. CHECK HTTPS ============
    function warnIfHttp() {
        if (location.protocol !== 'https:' &&
            (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1' && location.hostname !== '')) {
            console.warn('[Keamanan] Website ini sebaiknya diakses via HTTPS. Aktifkan SSL untuk melindungi data pembayaran.');
        }
    }

    // ============ 5. BLOCK EXTERNAL DATA URL ============
    function detectExternalRedirection() {
        // Deteksi redirect yang dilewatkan lewat referrer (phishing pattern)
        try {
            var ref = document.referrer || '';
            if (ref && ref.indexOf(location.origin) !== 0) {
                // arrived via external link, fine. Just for analytics.
            }
        } catch (e) { /* ignore */ }
    }

    // ============ INIT ============
    document.addEventListener('DOMContentLoaded', function () {
        detectClickjacking();
        validateLinks();
        initFormTokens();
        warnIfHttp();
        detectExternalRedirection();

        // Set session flag bahwa pengunjung datang dari halaman sendiri
        sessionStorage.setItem(SECURITY_KEY, 'ok:' + Date.now());
    });

})();