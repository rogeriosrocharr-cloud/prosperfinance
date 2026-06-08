const CACHE_NAME = 'fiel-finance-v2';
const ASSETS = [
  '/prosperfinance/',
  '/prosperfinance/index.html',
  '/prosperfinance/manifest.json',
  '/prosperfinance/icon-192.png',
  '/prosperfinance/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS).catch(()=>{})));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('supabase.co')) return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res && res.status === 200 && res.type === 'basic') {
        caches.open(CACHE_NAME).then(c => c.put(e.request, res.clone()));
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});

// ── Receber notificações push ──
self.addEventListener('push', e => {
  const data = e.data?.json() || {};
  e.waitUntil(
    self.registration.showNotification(data.title || 'FIEL Finance', {
      body:  data.body  || '',
      icon:  data.icon  || '/prosperfinance/icon-192.png',
      badge: data.badge || '/prosperfinance/icon-192.png',
      data:  data.data  || {},
      vibrate: [200, 100, 200],
      requireInteraction: false,
    })
  );
});

// ── Abrir app ao clicar na notificação ──
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/prosperfinance/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes('prosperfinance'));
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});
