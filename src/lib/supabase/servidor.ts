import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Cliente com a sessão do usuário, para Server Components e Server Actions.
 *
 * Continua usando a chave anônima: quem libera o conteúdo pago é o RLS, a
 * partir do `auth.uid()` que vem do cookie. Nenhuma rota do app carrega
 * credencial capaz de ignorar as políticas.
 */
export async function supabaseServidor() {
  const jar = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll(novos) {
          try {
            novos.forEach(({ name, value, options }) =>
              jar.set(name, value, options),
            );
          } catch {
            // Server Component não pode escrever cookie. Tudo bem: o proxy
            // já renovou a sessão antes da renderização.
          }
        },
      },
    },
  );
}

export type Usuario = {
  id: string;
  email: string | null;
  user_metadata: { nome?: string } & Record<string, unknown>;
};

/**
 * Usuário autenticado, ou null — **sem ida à rede**.
 *
 * Era `auth.getUser()`, que pergunta ao servidor de Auth a cada chamada: o
 * proxy perguntava, o layout perguntava de novo e a página, de novo. Com o
 * Next na Netlify (us-east-2) e o Supabase em São Paulo, cada pergunta era
 * uma viagem de ~130 ms antes de qualquer dado sair.
 *
 * `getClaims()` confere a assinatura do JWT localmente: o projeto assina com
 * ES256, e a chave pública é buscada uma vez e fica em cache no processo
 * (`GLOBAL_JWKS` do auth-js). Um cookie adulterado falha a verificação, então
 * isto é tão confiável quanto `getUser()` para dizer quem é a pessoa. O que
 * se perde é saber se a sessão foi revogada nos últimos minutos — o JWT vale
 * até expirar (1h). O RLS já funciona assim: o PostgREST também só confere o
 * JWT. As rotas de pagamento e a de exclusão de conta continuam com
 * `getUser()`, onde o cuidado vale mais que a viagem.
 *
 * `cache` faz layout e página dividirem a mesma leitura dentro de uma
 * renderização. `user_metadata` vem do token: quem troca o nome precisa
 * renovar a sessão para ele aparecer (ver `FormularioNome`).
 */
export const usuarioAtual = cache(async (): Promise<Usuario | null> => {
  const { data } = await (await supabaseServidor()).auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return {
    id: claims.sub,
    email: (claims.email as string | undefined) ?? null,
    user_metadata: (claims.user_metadata as Usuario["user_metadata"]) ?? {},
  };
});

/**
 * Papéis internos, lidos uma vez por renderização. O layout de /app e as
 * páginas perguntavam os dois, em rodadas separadas.
 */
export const papeisInternos = cache(async () => {
  const supabase = await supabaseServidor();
  const [admin, editor] = await Promise.all([
    supabase.rpc("sou_admin"),
    supabase.rpc("sou_editor"),
  ]);
  return { admin: Boolean(admin.data), editor: Boolean(editor.data) };
});
