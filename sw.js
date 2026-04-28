/**
 * SERVICE WORKER keuanganKU (BASIC - 100% OFFLINE)
 * Versi 1.01
 */

const APP_VERSION = '1.01'; 
const CACHE_PREFIX = 'keuanganku-basic-';
const CACHE_STATIC = CACHE_PREFIX + 'static-v' + APP_VERSION;
const CACHE_DYNAMIC = CACHE_PREFIX + 'dynamic-v' + APP_VERSION;

// Daftar aset wajib. (chart.js sudah dihapus agar hemat kuota & memori)
const staticAssets = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=Audiowide&family=Montserrat:wght@400;500;600;700;800;900&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

// Mencegah cache dinamis membengkak (Ramah Baterai & RAM)
const limitCacheSize = (name, size) => {
  caches.open(name).then(cache => {
    cache.keys().then(keys => {
      if (keys.length > size) {
        const keysToDelete = keys.slice(0, keys.length - size);
        Promise.all(keysToDelete.map(key => cache.delete(key)));
      }
    });
  });
};

self.addEventListener('install', event => {
  self.skipWaiting(); 
  // Individual Caching agar PWA tetap terinstal meski ada file CDN yang gagal dimuat
  event.waitUntil(
    caches.open(CACHE_STATIC).then(cache => {
      return Promise.all(
        staticAssets.map(asset => {
          return fetch(asset)
            .then(response => {
              if (response.ok) {
                return cache.put(asset, response);
              }
            })
            .catch(error => {
              console.warn('Lewati cache sementara (offline/CDN down):', asset);
            });
        })
      );
    })
  );
});

self.addEventListener('activate', event => {
  self.clients.claim(); 
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          // Menghapus cache versi lama atau yang bentrok
          if (key.startsWith(CACHE_PREFIX) && key !== CACHE_STATIC && key !== CACHE_DYNAMIC) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});

self.addEventListener('message', event => {
  // Mendengarkan perintah Hapus Data dari tombol HTML
  if (event.data && event.data.action === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(keys => {
        return Promise.all(
          keys.filter(key => key.startsWith(CACHE_PREFIX))
              .map(key => caches.delete(key))
        );
      })
    );
  }
});

self.addEventListener('fetch', event => {
  let req = event.request;
  let reqUrl = new URL(req.url);

  if (req.method !== 'GET') return;
  if (!reqUrl.protocol.startsWith('http')) return;
  if (reqUrl.pathname.endsWith('sw.js')) return;

  // Normalisasi request root menjadi index.html
  const isIndex = reqUrl.pathname.endsWith('/') || reqUrl.pathname.endsWith('/index.html');
  const cacheKey = isIndex ? new Request('./index.html') : req;

  event.respondWith(
    caches.match(cacheKey, { ignoreSearch: true }).then(cachedResponse => {
      
      // Pencocokan presisi file statis
      const isLocalStatic = staticAssets.some(asset => {
        if (asset.startsWith('http')) return false;
        const assetUrl = new URL(asset, self.location.origin);
        return reqUrl.pathname === assetUrl.pathname;
      });
      const isCDNStatic = staticAssets.some(asset => asset.startsWith('http') && reqUrl.href === asset);
      const isGstaticFont = reqUrl.hostname === 'fonts.gstatic.com';
      
      const isStatic = isIndex || isLocalStatic || isCDNStatic || isGstaticFont;

      if (isStatic) {
        // STRATEGI CACHE-FIRST (Sangat cepat untuk HTML, CSS, Font, JS Inti)
        return cachedResponse || fetch(req).then(networkResponse => {
          if (networkResponse && networkResponse.ok) {
            caches.open(CACHE_STATIC).then(cache => cache.put(cacheKey, networkResponse.clone()));
          }
          return networkResponse;
        }).catch(() => {
          if (req.headers.get('accept') && req.headers.get('accept').includes('text/html')) {
            return caches.match('./index.html');
          }
          return Response.error();
        });
      } else {
        // STRATEGI STALE-WHILE-REVALIDATE (Aman untuk file non-statis)
        const fetchPromise = fetch(req).then(networkResponse => {
          if (networkResponse && networkResponse.ok && !networkResponse.redirected && networkResponse.type !== 'opaque') {
            caches.open(CACHE_DYNAMIC).then(cache => {
              cache.put(req, networkResponse.clone());
              limitCacheSize(CACHE_DYNAMIC, 60); 
            });
          }
          return networkResponse;
        }).catch(() => {
          if (req.headers.get('accept') && req.headers.get('accept').includes('text/html')) {
            return caches.match('./index.html');
          }
          return Response.error(); 
        });

        // Tampilkan dari cache langsung jika ada, biarkan fetch (update) berjalan di background
        if (cachedResponse) {
          event.waitUntil(fetchPromise);
          return cachedResponse;
        }
        
        return fetchPromise;
      }
    })
  );
});
