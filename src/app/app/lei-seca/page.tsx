import type { Metadata } from "next";
import { CadernoLeiSeca } from "@/components/app/caderno-lei-seca";
import type { ItemDoCaderno } from "@/lib/caderno-lei-seca";
import { hojeEmBrasilia } from "@/lib/calendario";
import { supabaseServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = {
  title: "Caderno de lei seca",
  robots: { index: false, follow: false },
};

type LinhaDoCaderno = {
  artigo_id: string;
  lei_slug: string;
  lei_nome: string;
  lei_sigla: string;
  artigo_slug: string;
  numero: string;
  caput: string;
  paragrafos: string[] | null;
  nota: string;
  lido_em: string | null;
  revisar_em: string | null;
  favorito: boolean;
  importante_para: string;
  visto_em_questao: boolean;
  atualizado_em: string;
  destaques: number;
};

export default async function CadernoLeiSecaPage() {
  const supabase = await supabaseServidor();
  const [cadernoRes, alteracoesRes] = await Promise.all([
    supabase.rpc("listar_meu_caderno_lei_seca"),
    supabase.rpc("minhas_alteracoes_legislativas"),
  ]);
  if (cadernoRes.error) {
    throw new Error(`Não foi possível abrir o caderno de lei seca: ${cadernoRes.error.message}`);
  }
  if (alteracoesRes.error) {
    throw new Error(`Não foi possível consultar as alterações legislativas: ${alteracoesRes.error.message}`);
  }

  const itens: ItemDoCaderno[] = ((cadernoRes.data ?? []) as LinhaDoCaderno[]).map(
    (linha) => ({
      artigoId: linha.artigo_id,
      leiSlug: linha.lei_slug,
      leiNome: linha.lei_nome,
      leiSigla: linha.lei_sigla,
      artigoSlug: linha.artigo_slug,
      numero: linha.numero,
      caput: linha.caput,
      paragrafos: linha.paragrafos ?? [],
      nota: linha.nota,
      lidoEm: linha.lido_em,
      revisarEm: linha.revisar_em,
      favorito: linha.favorito,
      importantePara: linha.importante_para,
      vistoEmQuestao: linha.visto_em_questao,
      atualizadoEm: linha.atualizado_em,
      destaques: Number(linha.destaques),
    }),
  );

  const alteracoes = ((alteracoesRes.data ?? []) as {
    artigo_id: string;
    lei_slug: string;
    lei_sigla: string;
    artigo_slug: string;
    numero: string;
    detectada_em: string;
  }[]).map((linha) => ({
    artigoId: linha.artigo_id,
    leiSlug: linha.lei_slug,
    leiSigla: linha.lei_sigla,
    artigoSlug: linha.artigo_slug,
    numero: linha.numero,
    detectadaEm: linha.detectada_em,
  }));

  return <CadernoLeiSeca itens={itens} hoje={hojeEmBrasilia()} alteracoes={alteracoes} />;
}
