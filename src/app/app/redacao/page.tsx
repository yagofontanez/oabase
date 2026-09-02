import type { Metadata } from "next";
import { Redacao, type ArtigoParaComentar } from "@/components/app/redacao";
import { SomenteEditor } from "@/components/app/somente-editor";
import { supabaseServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = {
  title: "Redação de comentário",
  robots: { index: false, follow: false },
};

/**
 * Ferramenta de editor: escrever o comentário que abre o portão de qualidade.
 *
 * A fila sai de uma consulta comum — `artigos` é leitura aberta, e não há por
 * que inventar função para ler o que qualquer visitante já lê. O que precisa
 * de `security definer` é a escrita, e ela vive em `publicar_comentario`.
 *
 * `incidencia > 0` corta a fila em 106 artigos hoje. É deliberado: uma fila
 * de 5.756 linhas ordenada por nada é uma fila que ninguém começa.
 */
export default async function RedacaoPage() {
  const supabase = await supabaseServidor();

  const CAMPOS =
    "id, slug, numero, caput, paragrafos, comentario, incidencia, indexavel, leis(slug, sigla, nome)";

  const [{ data: editor }, { data: rascunhos }, { data: vazios }, { count: publicados }] =
    await Promise.all([
      supabase.rpc("sou_editor"),
      // Rascunho: já tem comentário escrito e ainda não foi ao índice. Vem
      // primeiro porque texto escrito e não revisado é dívida, não acervo —
      // e porque quem revisa trabalha mais rápido do que quem começa do zero.
      supabase
        .from("artigos")
        .select(CAMPOS)
        .neq("comentario", "{}")
        .eq("indexavel", false)
        .order("incidencia", { ascending: false })
        .limit(60),
      supabase
        .from("artigos")
        .select(CAMPOS)
        .eq("comentario", "{}")
        .gt("incidencia", 0)
        .order("incidencia", { ascending: false })
        .limit(60),
      supabase
        .from("artigos")
        .select("id", { count: "exact", head: true })
        .eq("indexavel", true),
    ]);

  if (!editor) return <SomenteEditor />;

  type LinhaArtigo = {
    id: string;
    slug: string;
    numero: string;
    caput: string;
    paragrafos: string[] | null;
    comentario: string[] | null;
    incidencia: number;
    leis: { slug: string; sigla: string; nome: string } | null;
  };

  const converter = (linhas: unknown): ArtigoParaComentar[] =>
    ((linhas ?? []) as LinhaArtigo[])
      .filter((a) => a.leis)
      .map((a) => ({
        id: a.id,
        slug: a.slug,
        numero: a.numero,
        caput: a.caput,
        paragrafos: a.paragrafos ?? [],
        comentario: a.comentario ?? [],
        incidencia: a.incidencia,
        leiSlug: a.leis!.slug,
        leiSigla: a.leis!.sigla,
        leiNome: a.leis!.nome,
      }));

  // Rascunhos antes dos vazios: revisar o que já existe é mais barato do que
  // escrever do zero, e comentário não revisado no banco é dívida aberta.
  const fila = [
    ...converter(rascunhos as unknown),
    ...converter(vazios as unknown),
  ];

  return <Redacao fila={fila} publicados={publicados ?? 0} />;
}
