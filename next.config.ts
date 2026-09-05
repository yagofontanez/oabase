import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Uma URL por página.
   *
   * `trailingSlash` é o padrão do Next, mas declarar é barato e o custo de
   * não declarar é alto: se um dia a hospedagem passar a servir `/exames/` e
   * `/exames` como respostas 200 diferentes, o buscador enxerga duas páginas
   * com o mesmo conteúdo e divide o sinal entre elas.
   */
  trailingSlash: false,

  /**
   * Cabeçalhos de segurança.
   *
   * Nenhum deles é opcional num serviço que tem login e cobra assinatura:
   *
   * - `X-Content-Type-Options` impede o navegador de adivinhar o tipo de um
   *   arquivo e executar como script algo que não é.
   * - `Referrer-Policy` evita vazar a URL interna — que na área logada
   *   identifica a questão que a pessoa estava respondendo — para qualquer
   *   site externo que ela abra a partir daqui.
   * - `X-Frame-Options` impede que o app seja embutido em iframe de terceiro,
   *   que é como se monta clickjacking em cima de uma sessão autenticada.
   * - `Permissions-Policy` desliga câmera, microfone e geolocalização, que o
   *   produto não usa: API que não é usada e continua permitida é superfície
   *   de ataque de graça.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
        ],
      },
      {
        // A fronteira aberto/pago, pela terceira via. `robots` na rota e
        // `Disallow` no robots.txt já cobrem; o cabeçalho é o que resiste a
        // alguém publicar um link direto para uma página do painel.
        source: "/app/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        // O navegador consulta o service worker a cada carregamento; se um
        // CDN o servir com cache longo, uma correção de segurança demora a
        // chegar. Imutável é o `/sw.js` arquivo, não a versão que ele toca.
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
