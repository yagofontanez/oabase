/**
 * Service worker do OABase.
 *
 * Duas regras sustentam tudo aqui e nenhuma é opcional:
 *
 * 1. `/app` nunca sai desse arquivo. A área paga é decidida pela RLS a cada
 *    sessão; cachear uma resposta autenticada permitiria ler questão do
 *    offline depois que a assinatura acabou. Para o conteúdo pago, o SW é
 *    invisível (network-only).
 *
 * 2. Nenhuma requisição a domínio externo é tocada. As consultas ao Supabase
 *    vão por `fetch` no cliente; interceptá-las daria a um cacheato poder de
 *    decidir sobre resposta de banco.
 *
 * O que sobra é o que compensa: o HTML das páginas abertas e os estáticos do
 * Next, ambos públicos por definição.
 */

const VERSAO = "oabase-v1";
const CACHE_ESTATICOS = `${VERSAO}-static`;
const CACHE_PAGINAS = `${VERSAO}-paginas`;

self.addEventListener("install", (evento) => {
  // Não esperar o fechamento das abas antigas para ativar.
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chaves) =>
        Promise.all(
          chaves
            .filter((chave) => chave !== CACHE_ESTATICOS && chave !== CACHE_PAGINAS)
            .map((chave) => caches.delete(chave)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (evento) => {
  const requisicao = evento.request;

  if (requisicao.method !== "GET") return;

  const url = new URL(requisicao.url);

  // Só a mesma origem (o próprio site).
  if (url.origin !== self.location.origin) return;

  // A fronteira aberto/pago, aqui também. `/app` é network-only.
  if (url.pathname === "/app" || url.pathname.startsWith("/app/")) return;

  // Estáticos do Next têm hash no nome: uma vez baixado, nunca muda.
  if (url.pathname.startsWith("/_next/static")) {
    evento.respondWith(
      caches.match(requisicao).then((emCache) => {
        if (emCache) return emCache;
        return fetch(requisicao).then((resposta) => {
          if (resposta.ok) {
            const copia = resposta.clone();
            caches.open(CACHE_ESTATICOS).then((cache) => cache.put(requisicao, copia));
          }
          return resposta;
        });
      }),
    );
    return;
  }

  // Documentos e recursos públicos: network-first, com o cache como rede de
  // segurança fora do ar. A navegação é o caso central; ícones e fontes do
  // sandbox também entram no cache de páginas.
  if (requisicao.mode === "navigate" || url.pathname.endsWith(".png") || url.pathname.endsWith(".svg")) {
    evento.respondWith(
      fetch(requisicao)
        .then((resposta) => {
          if (resposta.ok) {
            const copia = resposta.clone();
            caches.open(CACHE_PAGINAS).then((cache) => cache.put(requisicao, copia));
          }
          return resposta;
        })
        .catch(() =>
          caches.match(requisicao).then((emCache) => emCache || caches.match("/")),
        ),
    );
  }
});