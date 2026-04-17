const CACHE_NAME = 'keuanganku-v2';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

// Proses Instalasi & Menyimpan Cache ke Memori HP
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Membuka cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Proses Aktivasi & Membersihkan Cache Lama jika ada pembaruan
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Proses Menampilkan Data (Bisa Online maupun Offline)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Jika file ada di memori HP (cache), langsung tampilkan (Mode Offline)
        if (response) {
          return response;
        }
        // Jika tidak ada, minta dari internet (Mode Online)
        return fetch(event.request).then(
          function(response) {
            // Jika gagal ambil dari internet, hentikan
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            // Simpan file baru ke memori HP untuk digunakan offline nanti
            var responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(function(cache) {
                // Hanya simpan file dengan link HTTP/HTTPS yang valid
                if (event.request.url.startsWith('http')) {
                    cache.put(event.request, responseToCache);
                }
              });
            return response;
          }
        );
      })
  );
});
