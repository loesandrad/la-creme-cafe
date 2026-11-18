/* ==========================================================================
   LA CRÈME CAFÉ — guarda o jogo dentro do tablet.

   ⭐ 14/11: sem isto, abrir a página sem internet dá tela branca. Na
   primeira vez que o tablet abre o jogo com rede, o arquivo inteiro fica
   guardado aqui dentro. Depois disso ele abre SEMPRE, com ou sem internet.

   A regra é: responder primeiro do que está guardado (nunca espera a rede),
   e, se houver rede, baixar a versão nova por trás para a PRÓXIMA abertura.
   Assim um wifi ruim nunca trava a abertura.

   ⛔ Dois erros meus na primeira versão, que faziam o guardado NUNCA se
   atualizar — o tablet ficava preso na versão velha para sempre:
   · a busca de fundo não entrava em waitUntil, e o navegador desligava o
     trabalhador antes de ela terminar;
   · ela usava o pedido original, que o navegador respondia do cache dele.
   Agora a busca revalida com o servidor (barato: 304 quando nada mudou) e o
   trabalhador fica vivo até gravar.
   ========================================================================== */
const CACHE = 'lacreme-v3';
const ESSENCIAL = ['./', './index.html'];

self.addEventListener('install', ev => {
  ev.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ESSENCIAL))
      .then(() => self.skipWaiting())
      /* se falhar, não derruba a instalação: o jogo segue funcionando online
         e tenta guardar de novo na próxima abertura */
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

  let u;
  try { u = new URL(req.url); } catch (e) { return; }
  if (u.origin !== self.location.origin) return;

  /* ⛔ o carimbo da versão NUNCA pode sair do guardado: ele existe justamente
     para descobrir que o guardado está velho. Vai direto na rede. */
  if (u.pathname.endsWith('/versao.txt')) {
    ev.respondWith(fetch(req));
    return;
  }

  /* Pedido explícito de atualização, feito pela página quando percebe que
     saiu versão nova: busca na rede e REGRAVA o guardado antes de responder.
     É o que torna a troca de versão determinística, em vez de torcer para a
     busca de fundo ter terminado a tempo. */
  if (u.searchParams.get('atualizar') === '1') {
    ev.respondWith((async () => {
      const limpa = new Request(u.origin + u.pathname, { cache: 'reload' });
      const resp = await fetch(limpa);
      if (resp && resp.ok) {
        const c = await caches.open(CACHE);
        await c.put(new URL('./index.html', u).href, resp.clone());
        await c.put(new URL('./', u).href, resp.clone());
      }
      return resp;
    })());
    return;
  }

  /* a busca de fundo é criada AQUI, de forma síncrona, para poder entrar no
     waitUntil — é isso que mantém o trabalhador vivo até gravar */
  const atualizacao = fetch(new Request(req.url, { cache: 'no-cache' }))
    .then(resp => {
      if (resp && resp.ok && resp.type === 'basic') {
        const copia = resp.clone();
        return caches.open(CACHE).then(c => c.put(req, copia)).then(() => resp);
      }
      return resp;
    })
    .catch(() => null);

  ev.waitUntil(atualizacao);

  /* tem guardado? responde na hora. Não tem? espera a rede. Sem rede e sem
     guardado, cai na página principal, que é o jogo inteiro. */
  ev.respondWith(
    caches.match(req, { ignoreSearch: true })
      .then(guardado => guardado ||
        atualizacao.then(r => r || caches.match('./index.html')))
  );
});
