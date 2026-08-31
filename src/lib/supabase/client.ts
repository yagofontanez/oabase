import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chaveAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Sem credenciais, o app cai para os dados de exemplo e continua rodando. */
export const supabaseConfigurado = Boolean(url && chaveAnon);

/**
 * Cliente com a chave anônima — inclusive no servidor, de propósito.
 *
 * As páginas públicas nunca carregam uma credencial capaz de ler o conteúdo
 * pago: se um dia uma rota nova consultar `questoes` por engano, o RLS
 * devolve zero linhas em vez de vazar o produto. A service role fica
 * reservada ao pipeline de ingestão, que roda fora do app.
 */
export function supabaseAnon() {
  if (!url || !chaveAnon) {
    throw new Error(
      "Supabase não configurado: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  return createClient(url, chaveAnon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
