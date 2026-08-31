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

/** Usuário autenticado, ou null. */
export async function usuarioAtual() {
  const { data } = await (await supabaseServidor()).auth.getUser();
  return data.user;
}
