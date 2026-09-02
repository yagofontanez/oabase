import type { Metadata } from "next";
import { Suporte, type TicketNaTela } from "@/components/app/suporte";
import { SomenteAdmin } from "@/components/app/somente-editor";
import { supabaseServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = {
  title: "Suporte · fila",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * A fila da equipe.
 *
 * A consulta é a mesma da tela do cliente — quem muda o resultado é a RLS,
 * que abre todos os tickets para quem é admin. O nome de quem abriu vem de
 * `usuarios_admin`, porque `auth.users` não é legível pelo papel autenticado
 * e não deveria ser só para exibir um e-mail na lista.
 */
export default async function FilaDeSuportePage() {
  const supabase = await supabaseServidor();

  const { data: admin } = await supabase.rpc("sou_admin");
  if (!admin) return <SomenteAdmin />;

  const [{ data }, { data: pessoas }] = await Promise.all([
    supabase
      .from("tickets")
      .select(
        "id, user_id, assunto, status, criado_em, atualizado_em, ticket_mensagens(id, corpo, da_equipe, criado_em)",
      )
      .order("atualizado_em", { ascending: false })
      .limit(100),
    supabase.rpc("usuarios_admin", { p_busca: null, p_limite: 200 }),
  ]);

  const emailPorId = new Map(
    ((pessoas ?? []) as { user_id: string; email: string }[]).map((p) => [
      p.user_id,
      p.email,
    ]),
  );

  type Linha = Omit<TicketNaTela, "mensagens"> & {
    user_id: string;
    ticket_mensagens: TicketNaTela["mensagens"];
  };

  const tickets: TicketNaTela[] = ((data ?? []) as unknown as Linha[]).map(
    (t) => ({
      id: t.id,
      assunto: t.assunto,
      status: t.status,
      criado_em: t.criado_em,
      atualizado_em: t.atualizado_em,
      autor: emailPorId.get(t.user_id) ?? null,
      mensagens: [...(t.ticket_mensagens ?? [])].sort((a, b) =>
        a.criado_em.localeCompare(b.criado_em),
      ),
    }),
  );

  return <Suporte tickets={tickets} equipe />;
}
