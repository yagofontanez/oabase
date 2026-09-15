import type { Metadata } from "next";
import {
  PainelAdmin,
  type DiaDeAtividade,
  type LinhaDeDisciplina,
  type Metricas,
  type UsuarioAdmin,
} from "@/components/app/painel-admin";
import { SomenteAdmin } from "@/components/app/somente-editor";
import { supabaseServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = {
  title: "Administração",
  robots: { index: false, follow: false },
};

/**
 * Painel de operação.
 *
 * Fica sob `/app`, que já é `noindex` na rota e `Disallow` no robots. A
 * checagem aqui é de porta: quem decide é `sou_admin()` dentro de cada
 * função, e nenhuma delas devolve linha sem ele — mesmo que alguém chame o
 * PostgREST direto com a chave anônima.
 *
 * Admin é capacidade separada de editor de propósito: dar acesso às
 * ferramentas de conteúdo não pode dar, de brinde, a lista de clientes.
 */
export default async function AdminPage() {
  const supabase = await supabaseServidor();

  const { data: admin } = await supabase.rpc("sou_admin");
  if (!admin) return <SomenteAdmin />;

  const [metricas, usuarios, atividade, disciplinas] = await Promise.all([
    supabase.rpc("metricas_admin"),
    supabase.rpc("usuarios_admin", { p_busca: null, p_limite: 50 }),
    supabase.rpc("atividade_admin"),
    supabase.rpc("disciplinas_admin"),
  ]);

  const { data: funil } = await supabase.rpc("funil_ativacao_admin");

  return (
    <PainelAdmin
      metricas={(metricas.data ?? {}) as Metricas}
      funil={(funil ?? {}) as Metricas}
      usuariosIniciais={(usuarios.data ?? []) as UsuarioAdmin[]}
      atividade={(atividade.data ?? []) as DiaDeAtividade[]}
      disciplinas={(disciplinas.data ?? []) as LinhaDeDisciplina[]}
    />
  );
}
