import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chaveAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export type ContextoMcp = {
  supabase: SupabaseClient;
  usuario: Pick<User, "id" | "email"> | null;
  transporte: "stdio" | "http" | "teste";
};

export function configuracaoSupabase() {
  if (!url || !chaveAnon) {
    throw new Error(
      "Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  return { url, chaveAnon };
}

/** Um cliente por identidade; a chave continua anônima e a RLS decide. */
export function clienteMcp(token?: string): SupabaseClient {
  const config = configuracaoSupabase();
  return createClient(config.url, config.chaveAnon, {
    auth: { persistSession: false, autoRefreshToken: false },
    ...(token
      ? { global: { headers: { Authorization: `Bearer ${token}` } } }
      : {}),
  });
}

export async function contextoComToken(
  token: string | undefined,
  transporte: ContextoMcp["transporte"],
): Promise<ContextoMcp> {
  const supabase = clienteMcp(token);
  if (!token) return { supabase, usuario: null, transporte };

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error("TOKEN_INVALIDO");
  return {
    supabase,
    usuario: { id: data.user.id, email: data.user.email },
    transporte,
  };
}
