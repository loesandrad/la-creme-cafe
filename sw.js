/* ==========================================================================
   LA CRÈME CAFÉ — guarda o jogo dentro do tablet.

   ⭐ Luiz, 14/11: sem isto, abrir a página sem internet dá tela branca. Na
   primeira vez que o tablet abre o jogo com rede, o arquivo inteiro fica
   guardado aqui dentro. Depois disso ele abre SEMPRE, com ou sem internet.

   A regra é: responder primeiro do que está guardado (nunca espera a rede),
   e, se houver rede, baixar a versão nova por trás para a PRÓXIMA abertura.
   Assim um wifi ruim nunca trava a abertura.
   ========================================================================== */
const CACHE = 'lacreme-v2';   // v2: tira o versao.txt do guardado
const ESSENCIAL = ['./', './index.html'];

self.addEventListener('install', ev => {
  ev.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ESSENCIAL))
      .then(() => self.skipWaiting())
      /* se um dos dois falhar, não derruba a instalação: o jogo segue
         funcionando online e tenta guardar de novo na próxima abertura */
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', ev => {
  ev.waitUntil(
    caches.keys()
      .then(ns => Promise.all(ns.filter(n => n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;

  /* ⛔ o carimbo da versao NUNCA pode sair do guardado: ele existe
     justamente para descobrir que o guardado esta velho. Vai direto na
     rede, e sem rede simplesmente falha — quem chamou trata isso. */
  if (new URL(req.url).pathname.endsWith('/versao.txt')) {
    ev.respondWith(fetch(req));
    return;
  }

  ev.respondWith(
    caches.match(req, { ignoreSearch: true }).then(guardado => {
      /* busca a versão nova por trás, sem segurar a resposta */
      const rede = fetch(req).then(resp => {
        if (resp && resp.ok && resp.type === 'basic') {
          const copia = resp.clone();
          caches.open(CACHE).then(c => c.put(req, copia)).catch(() => {});
        }
        return resp;
      }).catch(() => null);

      /* tem guardado? responde na hora. Não tem? espera a rede. Sem rede e
         sem guardado, cai na página principal, que é o jogo todo. */
      return guardado || rede.then(r => r || caches.match('./index.html'));
    })
  );
});
