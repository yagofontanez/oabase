/**
 * O `proximo` de login, cadastro e callback — só caminho interno.
 *
 * Toda rota que redireciona para onde o endereço mandar é uma porta de
 * phishing se aceitar outro site. Conferir o prefixo não basta: `/\site.com`
 * e `/<tab>/site.com` começam com uma barra só, e o `new URL` (como o
 * navegador) lê os dois como `//site.com`. Quem decide é o próprio parser:
 * resolvido contra uma origem fixa, o caminho tem de continuar nela.
 */
export function destinoInterno(pedido: string | null | undefined, padrao = "/app"): string {
  if (!pedido?.startsWith("/")) return padrao;
  const base = "https://interno.invalid";
  try {
    const url = new URL(pedido, base);
    if (url.origin !== base) return padrao;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return padrao;
  }
}
