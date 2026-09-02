import type { Metadata } from "next";
import {
  Triagem,
  type QuestaoParaRevisar,
} from "@/components/app/triagem";
import { SomenteEditor } from "@/components/app/somente-editor";
import { supabaseServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = {
  title: "Triagem de disciplina",
  robots: { index: false, follow: false },
};

/**
 * Ferramenta de editor: confirmar a disciplina de cada questão.
 *
 * Fica sob `/app` porque `/app` inteiro já é `noindex` na rota e `Disallow`
 * no robots — a fronteira que protege o produto pago protege isto de graça.
 * Quem não é editor não vê a tela **e** não conseguiria escrever de qualquer
 * forma: as funções conferem `sou_editor()` no banco. A checagem aqui é de
 * porta, como a do proxy.
 */
export default async function RevisaoPage() {
  const supabase = await supabaseServidor();

  const [
    { data: editor },
    { data: contagem },
    { data: disciplinas },
    { data: fila },
  ] = await Promise.all([
    supabase.rpc("sou_editor"),
    supabase.rpc("revisao_pendente"),
    supabase
      .from("disciplinas")
      .select("slug, nome")
      .order("media_por_prova", { ascending: false }),
    // A primeira página vem do servidor: abrir a tela e esperar a rede antes
    // de ver a primeira questão é onde o ritmo se perde.
    supabase.rpc("fila_de_revisao", { p_limite: 25 }),
  ]);

  if (!editor) return <SomenteEditor />;

  const linha = (Array.isArray(contagem) ? contagem[0] : contagem) as
    | { pendentes: number; confirmadas: number }
    | undefined;

  return (
    <Triagem
      filaInicial={(fila ?? []) as QuestaoParaRevisar[]}
      disciplinas={disciplinas ?? []}
      pendentesIniciais={Number(linha?.pendentes ?? 0)}
      confirmadasIniciais={Number(linha?.confirmadas ?? 0)}
    />
  );
}
