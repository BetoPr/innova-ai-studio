// Service Worker do Innova AI Studio.
// Função: resolver o problema crônico de cache do navegador que servia
// versões velhas de JS/CSS após deploy (forçando Ctrl+Shift+R toda hora).
//
// Estratégia: network-first pra .js/.css/.html same-origin.
//   - Sempre tenta puxar da rede primeiro
//   - Se a rede falhar (offline), cai pro cache
//   - Cache é atualizado a cada fetch bem-sucedido
//
// Recursos externos (Google Fonts, unpkg.com, Supabase) não são interceptados.

const CACHE_NAME = 'innova-v1';

self.addEventListener('install', (event) => {
  // Ativa imediatamente, sem esperar usuário fechar todas as abas.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Limpa caches velhos (versões anteriores do SW) e assume controle das abas.
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // só same-origin

  const path = url.pathname;
  const isAsset = /\.(js|css|html)$/.test(path) || path === '/' || path.endsWith('/');
  if (!isAsset) return; // imagens/fontes/etc passam direto pro browser

  event.respondWith(
    fetch(req)
      .then((res) => {
        // Cache a resposta nova pra fallback offline.
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req)) // offline: usa cache se tiver
  );
});
