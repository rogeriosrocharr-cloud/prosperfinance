const CACHE_NAME = 'fiel-finance-v5';

// Detectar automaticamente o caminho base
const BASE = self.location.pathname.replace('/sw.js', '');

const ASSETS = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/manifest.json',
  BASE + '/icon-192.png',
  BASE + '/icon-512.png',
  // Dependências externas — cachear para funcionar offline
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.0/dist/umd/supabase.js',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/fonts/tabler-icons.woff2',
];

// ── Instalar: cachear assets principais ──
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(ASSETS.map(url =>
        cache.add(url).catch(err => console.warn('Cache falhou para:', url, err))
      ))
    )
  );
  self.skipWaiting();
});

// ── Ativar: limpar caches antigos ──
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: Cache First, NUNCA retorna null ──
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Ignorar Supabase e outras APIs externas
  if (
    url.includes('supabase.co') ||
    url.includes('googleapis') ||
    url.includes('gstatic') ||
    url.includes('chrome-extension') ||
    e.request.method !== 'GET'
  ) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) {
        // Atualiza cache em background
        fetch(e.request).then(res => {
          if (res && res.status === 200) {
            caches.open(CACHE_NAME).then(c => c.put(e.request, res.clone()));
          }
        }).catch(() => {});
        return cached;
      }

      // Não está no cache — busca na rede
      return fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => {
        // Offline e não está no cache — retornar index.html como fallback
        return caches.match(BASE + '/index.html')
          .then(fallback => {
            if (fallback) return fallback;
            // Última alternativa: resposta vazia com mensagem
            return new Response(
              '<html><body style="background:#0e0e0e;color:#c9a84c;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h2>FIEL Finance</h2><p>Carregando modo offline...</p><p style="font-size:12px;color:#666">Abra o app uma vez com internet para ativar o modo offline</p></div></body></html>',
              { headers: { 'Content-Type': 'text/html' } }
            );
          });
      });
    })
  );
});

// ── Notificações push ──
self.addEventListener('push', e => {
  const data = e.data?.json() || {};
  e.waitUntil(
    self.registration.showNotification(data.title || 'FIEL Finance', {
      body:    data.body  || '',
      icon:    data.icon  || BASE + '/icon-192.png',
      badge:   data.badge || BASE + '/icon-192.png',
      data:    data.data  || {},
      vibrate: [200, 100, 200],
    })
  );
});

// ── Clique na notificação ──
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
