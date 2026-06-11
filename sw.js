const CACHE_NAME = 'fiel-finance-v6';
const BASE = self.location.pathname.replace('/sw.js', '');

const ASSETS = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/manifest.json',
  BASE + '/icon-192.png',
  BASE + '/icon-512.png',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.0/dist/umd/supabase.js',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css',
];

// Forçar ativação imediata quando solicitado
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(ASSETS.map(url =>
        cache.add(url).catch(err => console.warn('Cache miss:', url, err))
      ))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Nunca interceptar Supabase auth/API calls
  if (
    url.includes('supabase.co') ||
    url.includes('chrome-extension') ||
    e.request.method !== 'GET'
  ) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      // Retornar cache imediatamente
      if (cached) {
        // Revalidar em background
        fetch(e.request).then(res => {
          if (res?.status === 200) {
            caches.open(CACHE_NAME).then(c => c.put(e.request, res.clone()));
          }
        }).catch(() => {});
        return cached;
      }

      // Não está no cache — buscar na rede
      return fetch(e.request).then(res => {
        if (res?.status === 200) {
          caches.open(CACHE_NAME).then(c => c.put(e.request, res.clone()));
        }
        return res;
      }).catch(() => {
        // Fallback para index.html
        return caches.match(BASE + '/index.html').then(fb =>
          fb || new Response(
            '<html><body style="background:#0e0e0e;color:#c9a84c;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column"><h2>FIEL Finance</h2><p>Modo offline</p><p style="font-size:12px;color:#888;margin-top:8px">Abra o app uma vez com internet para ativar o modo offline</p></body></html>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          )
        );
      });
    })
  );
});

self.addEventListener('push', e => {
  const data = e.data?.json() || {};
  e.waitUntil(
    self.registration.showNotification(data.title || 'FIEL Finance', {
      body: data.body || '', icon: data.icon || BASE + '/icon-192.png',
      badge: data.badge || BASE + '/icon-192.png',
      data: data.data || {}, vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || BASE + '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes('fiel') || c.url.includes('prosper'));
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});
