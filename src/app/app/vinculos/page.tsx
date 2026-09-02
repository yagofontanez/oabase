import type { Metadata } from "next";
import {
  Vinculos,
  type QuestaoParaVincular,
} from "@/components/app/vinculos";
import { SomenteEditor } from "@/components/app/somente-editor";
import { getLeis } from "@/lib/content/queries";
import { supabaseServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = {
  title: "Vincular questão a dispositivo",
  robots: { index: false, follow: false },
};

/**
 * Ferramenta de editor: dizer qual artigo a questão cobra.
 *
 * É o vínculo que o regex não consegue dar — a prova quase nunca nomeia o
 * dispositivo — e o único que pode entrar em `questao_artigos` além da
 * citação, porque `origem = 'humano'` significa exatamente isto: alguém leu.
 */
export default async function VinculosPage() {
  const supabase = await supabaseServidor();

  const [{ data: editor }, { data: fila }, leis] = await Promise.all([
    supabase.rpc("sou_editor"),
    supabase.rpc("fila_de_vinculo", { p_limite: 12 }),
    getLeis(),
  ]);

  if (!editor) return <SomenteEditor />;

  return (
    <Vinculos
      filaInicial={(fila ?? []) as QuestaoParaVincular[]}
      leis={leis.map((l) => ({ slug: l.slug, sigla: l.sigla, nome: l.nome }))}
    />
  );
}
