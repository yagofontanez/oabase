import type { Metadata } from "next";
import {
  AlteracoesLegislativas,
  type AlteracaoLegislativa,
} from "@/components/app/alteracoes-legislativas";
import { SomenteEditor } from "@/components/app/somente-editor";
import { supabaseServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = {
  title: "Alterações legislativas",
  robots: { index: false, follow: false },
};

type Linha = {
  id: string;
  artigo_id: string;
  lei_slug: string;
  lei_sigla: string;
  artigo_slug: string;
  numero: string;
  caput_anterior: string;
  paragrafos_anteriores: string[];
  caput_novo: string;
  paragrafos_novos: string[];
  comentario_anterior: string[];
  indexavel_anterior: boolean;
  detectada_em: string;
};

export default async function AlteracoesLegislativasPage() {
  const supabase = await supabaseServidor();
  const { data: editor } = await supabase.rpc("sou_editor");
  if (!editor) return <SomenteEditor />;

  const { data, error } = await supabase.rpc("fila_alteracoes_legislativas");
  if (error) throw new Error(`Não foi possível abrir o radar legislativo: ${error.message}`);

  const fila: AlteracaoLegislativa[] = ((data ?? []) as Linha[]).map((linha) => ({
    id: linha.id,
    artigoId: linha.artigo_id,
    leiSlug: linha.lei_slug,
    leiSigla: linha.lei_sigla,
    artigoSlug: linha.artigo_slug,
    numero: linha.numero,
    caputAnterior: linha.caput_anterior,
    paragrafosAnteriores: linha.paragrafos_anteriores ?? [],
    caputNovo: linha.caput_novo,
    paragrafosNovos: linha.paragrafos_novos ?? [],
    comentarioAnterior: linha.comentario_anterior ?? [],
    indexavelAnterior: linha.indexavel_anterior,
    detectadaEm: linha.detectada_em,
  }));

  return <AlteracoesLegislativas fila={fila} />;
}
