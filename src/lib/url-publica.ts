import type { NextRequest } from "next/server";
import { site } from "@/lib/site";

/**
 * Endereço público de um caminho, para redirecionar a partir de rota.
 *
 * Atrás do Caddy, `request.url` numa rota é o endereço onde o Next escuta
 * **dentro do container** (`https://0.0.0.0:3000`), não o domínio: um
 * `new URL("/entrar", request.url)` mandava a pessoa para um endereço que
 * não abre. Foi assim que `/auth/confirm` — o link de confirmação de
 * cadastro — ficou quebrado desde a virada para a VPS, sem erro nenhum no
 * log. Na Netlify o problema não aparecia.
 *
 * O host vem do cabeçalho que o Caddy repassa, mas **só vale se for um dos
 * nossos**: host desconhecido cai no domínio principal. Montar redirecionamento
 * com cabeçalho livre é abrir a porta para mandar gente a qualquer site.
 */
const HOSTS_NOSSOS = new Set([
  "oabase.com.br",
  "www.oabase.com.br",
  "novo.oabase.com.br",
  "localhost:3000",
]);

export function urlPublica(request: NextRequest, caminho: string): URL {
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").toLowerCase();
  if (HOSTS_NOSSOS.has(host)) {
    const protocolo = host.startsWith("localhost") ? "http" : "https";
    return new URL(caminho, `${protocolo}://${host}`);
  }
  return new URL(caminho, site.url);
}
