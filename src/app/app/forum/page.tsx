import type { Metadata } from "next";
import { Forum, type TopicoNaLista } from "@/components/app/forum";
import { supabaseServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = {
  title: "Fórum",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * O fórum vive sob `/app`, que é `noindex` na rota e `Disallow` no robots.
 *
 * Não é excesso de zelo: conteúdo escrito por terceiros, indexável, num site
 * cuja aquisição é 100% orgânica é a forma mais rápida de o domínio ser
 * avaliado como fazenda de conteúdo — e moderar fórum público aberto é um
 * trabalho que ninguém aqui tem. Aberto a todas as contas, com plano ou sem.
 */
export default async function ForumPage() {
  const supabase = await supabaseServidor();

  const [{ data }, { data: disciplinas }] = await Promise.all([
    supabase
      .from("forum_topicos")
      .select(
        "id, titulo, corpo, autor_nome, respostas, fixado, trancado, removido, criado_em, atualizado_em, disciplinas(nome)",
      )
      .order("fixado", { ascending: false })
      .order("atualizado_em", { ascending: false })
      .limit(100),
    supabase
      .from("disciplinas")
      .select("slug, nome")
      .order("nome"),
  ]);

  type Linha = Omit<TopicoNaLista, "disciplina"> & {
    disciplinas: { nome: string } | { nome: string }[] | null;
  };

  const topicos: TopicoNaLista[] = ((data ?? []) as unknown as Linha[]).map(
    (t) => {
      const d = Array.isArray(t.disciplinas) ? t.disciplinas[0] : t.disciplinas;
      return { ...t, disciplina: d?.nome ?? null };
    },
  );

  return <Forum topicos={topicos} disciplinas={disciplinas ?? []} />;
}
