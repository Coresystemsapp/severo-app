/* Severo · service worker
 * Arquivos do app: rede primeiro (atualização chega na hora), cache se estiver sem sinal.
 * Fontes e SDK do Firebase: cache primeiro.
 * Firestore, Storage e mapas: não passam por aqui.
 */
const VERSAO = 'severo-v6';
const ESSENCIAIS = ['./', 'index.html', 'severo.css', 'config.js', 'icones.js', 'dados.js', 'motorista.js',
  'logo-severo.png', 'icon-192.png', 'manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ESSENCIAIS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const estatico = url.hostname === 'www.gstatic.com' || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin === self.location.origin) {
    e.respondWith(fetch(req).then((r) => {
      if (r.ok) { const copia = r.clone(); caches.open(VERSAO).then((c) => c.put(req, copia)); }
      return r;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))));
  } else if (estatico) {
    e.respondWith(caches.match(req).then((r) => r || fetch(req).then((resp) => {
      const copia = resp.clone(); caches.open(VERSAO).then((c) => c.put(req, copia)); return resp;
    })));
  }
});

/* Notificações (Firebase Cloud Messaging, mensagem só com dados) */
self.addEventListener('push', (e) => {
  let p = {};
  try { p = e.data ? e.data.json() : {}; } catch (x) { p = { data: { titulo: 'Severo', corpo: e.data ? e.data.text() : '' } }; }
  const d = p.data || p || {};
  const n = p.notification || {};
  const titulo = d.titulo || n.title || 'Severo';
  const opcoes = {
    body: d.corpo || n.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { link: d.link || '/' },
    lang: 'pt-BR'
  };
  if (d.tag) { opcoes.tag = d.tag; opcoes.renotify = true; }
  e.waitUntil(self.registration.showNotification(titulo, opcoes));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const alvo = new URL((e.notification.data && e.notification.data.link) || '/', self.location.origin);
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
    for (const w of janelas) {
      if (new URL(w.url).pathname.replace(/\.html$/, '') === alvo.pathname.replace(/\.html$/, '') && 'focus' in w) return w.focus();
    }
    return self.clients.openWindow(alvo.href);
  }));
});
