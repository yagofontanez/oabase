import type { Metadata } from "next";
import {
  ComentariosQuestao,
  type QuestaoParaComentar,
} from "@/components/app/comentarios-questao";
import { SomenteEditor } from "@/components/app/somente-editor";
import { supabaseServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = {
  title: "Comentários de questão",
  robots: { index: false, follow: false },
};

/**
 * Ferramenta de editor: escrever o comentário que explica a questão.
 *
 * A fila sai de `fila_de_comentarios`, que já traz o enunciado, gabarito e
 * artigos de apoio. O comentário de questão é o diferencial do produto pago —
 * é ele que transforma "errei" em "entendi".
 *
 * Exames mais recentes primeiro; os dispositivos vinculados dentro de cada
 * questão vêm ordenados por incidência — o que a banca cobra mais vezes.
 */
export default async function ComentariosQuestaoPage() {
  const supabase = await supabaseServidor();

  const [{ data: editor }, { data: pendentesRes }, { data: filaBruta }] =
    await Promise.all([
      supabase.rpc("sou_editor"),
      supabase.rpc("comentarios_pendentes"),
      supabase.rpc("fila_de_comentarios", { p_limite: 60 }),
    ]);

  if (!editor) return <SomenteEditor />;

  type LinhaFila = {
    questao_id: string;
    edicao: number;
    numero: number;
    enunciado: string;
    alternativas: Record<string, string>;
    gabarito: string;
    disciplina_nome: string | null;
    corpo: string[] | null;
    status: string;
    autor: string | null;
    apoio: Array<{
      rotulo: string;
      href: string;
      caput: string;
      comentario: string[];
    }>;
  };

  const fila: QuestaoParaComentar[] = ((filaBruta ?? []) as LinhaFila[]).map(
    (q) => ({
      questaoId: q.questao_id,
      edicao: q.edicao,
      numero: q.numero,
      enunciado: q.enunciado,
      alternativas: q.alternativas,
      gabarito: q.gabarito,
      disciplinaNome: q.disciplina_nome,
      corpo: q.corpo ?? [],
      status: q.status,
      autor: q.autor,
      apoio: q.apoio ?? [],
    }),
  );

  const stats = pendentesRes?.[0] as
    | { rascunhos: number; publicados: number; questoes: number }
    | undefined;

  return (
    <ComentariosQuestao
      fila={fila}
      publicados={stats?.publicados ?? 0}
      totalQuestoes={stats?.questoes ?? 0}
    />
  );
}
