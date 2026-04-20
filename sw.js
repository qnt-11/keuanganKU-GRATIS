/**
 * SERVICE WORKER keuanganKU (FINAL ABSOLUT + NETWORK SECURITY BUGFIX)
 * Fitur: Cache Splitting, True Stale-While-Revalidate, Safe Offline Fallback, Background Lock, Anti-Bloat, Anti-Crash.
 */

// =========================================================
// ⚠️ PENTING: GANTI ANGKA INI SETIAP ADA UPDATE DI INDEX.HTML
// =========================================================
const APP_VERSION = '1.04'; 

// Pemisahan Brankas Memori
const CACHE_STATIC = 'keuanganku-static-v' + APP_VERSION;
const CACHE_DYNAMIC = 'keuanganku-dynamic-v' + APP_VERSION;

// BRANKAS STATIS: (Hanya Font & Excel, tanpa Chart.js)
const staticAssets = [
  'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

// BRANKAS DINAMIS: File utama aplikasi
const dynamicAssets = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  self.skipWaiting(); 
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_STATIC).then(cache => cache.addAll(staticAssets)),
      caches.open(CACHE_DYNAMIC).then(cache => cache.addAll(dynamicAssets))
    ])
  );
});

self.addEventListener('activate', event => {
  self.clients.claim(); 
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_STATIC && key !== CACHE_DYNAMIC) return caches.delete(key);
        })
      );
    })
  );
});

self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  // ========================================================
  // A. FILTER KEAMANAN JARINGAN (ANTI-CRASH & BOM WAKTU)
  // ========================================================
  // 1. Jangan cache sw.js
  if (requestUrl.pathname.endsWith('sw.js')) return;
  // 2. WAJIB: Abaikan semua request kecuali GET (Mencegah POST/PUT error)
  if (event.request.method !== 'GET') return;
  // 3. WAJIB: Abaikan URL alien dari ekstensi browser (Hanya proses HTTP/HTTPS)
  if (!requestUrl.protocol.startsWith('http')) return;

  // B. JALUR KHUSUS GOOGLE SHEETS (Disiapkan jika nanti di-upgrade ke PRO)
  if (requestUrl.hostname === 'script.google.com') {
    event.respondWith(fetch(event.request));
    return;
  }

  // C. BRANKAS STATIS (Cache First untuk Library & Font Google)
  if (staticAssets.some(url => event.request.url.includes(url)) || requestUrl.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(event.request, { ignoreSearch: true }).then(cachedResponse => {
        return cachedResponse || fetch(event.request).then(networkResponse => {
          if (networkResponse && (networkResponse.status === 200 || networkResponse.status === 0)) {
            caches.open(CACHE_STATIC).then(cache => cache.put(event.request, networkResponse.clone()));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // D. BRANKAS DINAMIS (True Stale-While-Revalidate)
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(cachedResponse => {
      const networkFetch = fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_DYNAMIC).then(cache => {
            // Simpan file asli tanpa ekor parameter agar memori rapi
            cache.put(event.request.url.split('?')[0], responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // OFFLINE FALLBACK AMAN
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html', { ignoreSearch: true });
        }
      });

      // KUNCI BACKGROUND PROCESS
      if (cachedResponse) {
        event.waitUntil(networkFetch); 
        return cachedResponse; 
      }
      return networkFetch; 
    })
  );
});
