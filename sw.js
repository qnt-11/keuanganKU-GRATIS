/**
 * SERVICE WORKER keuanganKU (ENTERPRISE SECURITY & CACHE LIMIT)
 * Versi 1.00
 */

const APP_VERSION = '1.00'; 
const CACHE_PREFIX = 'keuangan-ku-';
const CACHE_STATIC = CACHE_PREFIX + 'static-v' + APP_VERSION;
const CACHE_DYNAMIC = CACHE_PREFIX + 'dynamic-v' + APP_VERSION;

// Aset Statis yang disesuaikan dengan keuanganKU
const staticAssets = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png', // Tetap disertakan untuk standar PWA (jika ada di manifest)
  'https://fonts.googleapis.com/css2?family=Audiowide&family=Montserrat:wght@400;500;600;700;800;900&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

// Fungsi Pemotong Bom Waktu Memori
const limitCacheSize = (name, size) => {
  caches.open(name).then(cache => {
    cache.keys().then(keys => {
      if (keys.length > size) {
        cache.delete(keys[0]).then(() => limitCacheSize(name, size));
      }
    });
  });
};

self.addEventListener('install', event => {
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_STATIC).then(cache => cache.addAll(staticAssets))
  );
});

self.addEventListener('activate', event => {
  self.clients.claim(); 
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          // Hanya hapus cache milik keuanganKU (Aman jika di-host di domain yang sama dengan app lain)
          if (key.startsWith(CACHE_PREFIX) && key !== CACHE_STATIC && key !== CACHE_DYNAMIC) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});

// Telepati dengan HTML (Untuk fitur hapus data jika diperlukan ke depannya)
self.addEventListener('message', event => {
  if (event.data && event.data.action === 'CLEAR_CACHE') {
    caches.keys().then(keys => {
      keys.forEach(key => {
        if (key.startsWith(CACHE_PREFIX)) caches.delete(key);
      });
    });
  }
});

self.addEventListener('fetch', event => {
  let req = event.request;
  let reqUrl = new URL(req.url);

  if (req.method !== 'GET') return;
  if (!reqUrl.protocol.startsWith('http')) return;
  if (reqUrl.pathname.endsWith('sw.js')) return;

  // JALUR KHUSUS GOOGLE SHEETS
  if (reqUrl.hostname === 'script.google.com') {
    event.respondWith(fetch(req));
    return;
  }

  // Normalisasi Duplikasi Hantu ./ dan ./index.html
  if (reqUrl.pathname === '/' || reqUrl.pathname === '/index.html') {
    req = new Request('./index.html');
  }

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(cachedResponse => {
      const networkFetch = fetch(req).then(networkResponse => {
        // Anti Wifi Warkop (Captive Portal) & Anti File Rusak
        if (!networkResponse || !networkResponse.ok || networkResponse.redirected || networkResponse.type === 'opaque') {
          return networkResponse; 
        }
        
        caches.open(CACHE_DYNAMIC).then(cache => {
          cache.put(req, networkResponse.clone());
          limitCacheSize(CACHE_DYNAMIC, 60); // Maksimal 60 file di memori dinamis
        });
        return networkResponse.clone();
      }).catch(() => {
        // Fallback White Screen of Death (Buka index.html jika tidak ada internet dan file belum di-cache)
        if (req.headers.get('accept') && req.headers.get('accept').includes('text/html')) {
          return caches.match('./index.html');
        }
      });

      return cachedResponse || networkFetch; 
    })
  );
});
