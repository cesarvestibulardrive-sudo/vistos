// ============================================================
// Service Worker: cache dos arquivos do site para abrir offline.
// Os DADOS (turmas, vistos, etc.) ficam a cargo da persistência
// offline do Firestore, configurada em js/auth.js — isso aqui
// só garante que o próprio site (HTML/CSS/JS) abra sem internet.
// ============================================================

const CACHE_NOME = "vistos-cache-v52";
const ARQUIVOS_PARA_CACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/bootstrap-scoped.css",
  "./css/bootstrap-icons-scoped.css",
  "./css/style.css",
  "./css/fonts/bootstrap-icons.woff",
  "./css/fonts/bootstrap-icons.woff2",
  "./js/firebase-config.js",
  "./js/usuarios.js",
  "./js/auth.js",
  "./js/modal.js",
  "./js/turmas.js",
  "./js/visto.js",
  "./js/chamada.js",
  "./js/ocorrencia.js",
  "./js/seminario.js",
  "./js/pesos.js",
  "./js/admin.js",
  "./js/app.js",
  "./js/vendor/jspdf.umd.min.js",
  "./js/vendor/jspdf.plugin.autotable.min.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NOME).then((cache) => cache.addAll(ARQUIVOS_PARA_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((nomes) =>
      Promise.all(
        nomes
          .filter((nome) => nome !== CACHE_NOME)
          .map((nome) => caches.delete(nome))
      )
    )
  );
  self.clients.claim();
});

// Estratégia: "rede primeiro, cache como plano B".
// Sempre que houver internet, busca a versão mais recente do servidor
// (e atualiza o cache). Sem internet, cai para a última versão salva.
// Isso evita ficar preso a uma versão antiga depois de cada deploy.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Nunca cachear chamadas ao Firebase (Auth/Firestore) — isso é
  // responsabilidade da persistência offline do próprio Firestore.
  if (url.hostname.includes("googleapis.com") || url.hostname.includes("firebaseio.com")) {
    return;
  }

  // Arquivos de outras origens (ex: fontes do Google) — deixa o navegador cuidar.
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((resposta) => {
        const copia = resposta.clone();
        caches.open(CACHE_NOME).then((cache) => cache.put(event.request, copia));
        return resposta;
      })
      .catch(() =>
        caches.match(event.request).then((respostaCache) => respostaCache || caches.match("./index.html"))
      )
  );
});
