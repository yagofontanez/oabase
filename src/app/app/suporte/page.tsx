import type { Metadata } from "next";
import { Suporte, type TicketNaTela } from "@/components/app/suporte";
import { supabaseServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = {
  title: "Suporte",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Suporte do cliente.
 *
 * A consulta não filtra por dono: quem filtra é a RLS de `tickets`, e é ela
 * que decide também no painel da equipe, com a mesma consulta. Filtrar aqui
 * daria a impressão de que a política é opcional.
 */
export default async function SuportePage() {
  const supabase = await supabaseServidor();

  const { data } = await supabase
    .from("tickets")
    .select(
      "id, assunto, status, criado_em, atualizado_em, ticket_mensagens(id, corpo, da_equipe, criado_em)",
    )
    .order("atualizado_em", { ascending: false })
    .limit(50);

  type Linha = Omit<TicketNaTela, "mensagens"> & {
    ticket_mensagens: TicketNaTela["mensagens"];
  };

  const tickets: TicketNaTela[] = ((data ?? []) as unknown as Linha[]).map(
    (t) => ({
      id: t.id,
      assunto: t.assunto,
      status: t.status,
      criado_em: t.criado_em,
      atualizado_em: t.atualizado_em,
      mensagens: [...(t.ticket_mensagens ?? [])].sort((a, b) =>
        a.criado_em.localeCompare(b.criado_em),
      ),
    }),
  );

  return <Suporte tickets={tickets} />;
}
