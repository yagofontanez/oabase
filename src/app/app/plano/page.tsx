import type { Metadata } from "next";
import {
  PlanoConversa,
  type PortaDeEntrada,
} from "@/components/app/plano-conversa";
import { supabaseServidor, usuarioAtual } from "@/lib/supabase/servidor";
import {
  diasAte,
  getArtigosIndexaveis,
  getDisciplinas,
  getLeis,
  getProximoExame,
} from "@/lib/content/queries";
import type { Mensagem, Plano } from "@/lib/ia/plano";
import type { ItemRoadmap } from "@/lib/roadmap";

export const metadata: Metadata = {
  title: "Plano de estudos",
  robots: { index: false, follow: false },
};

export default async function PlanoPage() {
  const supabase = await supabaseServidor();

  const [registroRes, disciplinas, artigos, leis, usuario, proximo] =
    await Promise.all([
      supabase
        .from("planos_estudo")
        .select("plano, conversa, versao_roadmap")
        .maybeSingle(),
      getDisciplinas(),
      getArtigosIndexaveis(),
      getLeis(),
      usuarioAtual(),
      getProximoExame(),
    ]);

  const registro = registroRes.data;
  const plano = (registro?.plano as Plano | null) ?? null;
  const conversa: Mensagem[] = Array.isArray(registro?.conversa)
    ? (registro.conversa as Mensagem[])
    : [];
  const versaoRoadmap = registro?.versao_roadmap ?? 0;
  const itensRes =
    versaoRoadmap > 0
      ? await supabase
          .from("roadmap_itens")
          .select("id, semana, ordem, disciplina, objetivo, horas, estado")
          .eq("versao", versaoRoadmap)
          .order("semana")
          .order("ordem")
      : { data: [] };
  const roadmapInicial = (itensRes.data ?? []) as ItemRoadmap[];

  // A porta de entrada de cada disciplina sai do acervo — o artigo mais
  // cobrado com comentário publicado. É o que garante que o link ao lado de
  // cada bloco do plano aponte para conteúdo real, e não para algo que o
  // modelo tenha imaginado.
  const sigla = new Map(leis.map((l) => [l.slug, l.sigla]));
  const nomePorSlug = new Map(disciplinas.map((d) => [d.slug, d.nome]));
  const portas: Record<string, PortaDeEntrada> = {};

  for (const artigo of artigos) {
    const nome = nomePorSlug.get(artigo.disciplinaSlug);
    if (!nome) continue;
    if (!portas[nome]) {
      portas[nome] = {
        href: `/legislacao/${artigo.leiSlug}/${artigo.slug}`,
        rotulo: `Comece pelo art. ${artigo.numero} ${sigla.get(artigo.leiSlug) ?? ""} →`,
      };
    }
  }

  const nome =
    (usuario?.user_metadata?.nome as string | undefined)?.split(" ")[0] ??
    usuario?.email?.split("@")[0] ??
    "tudo bem?";

  return (
    <PlanoConversa
      planoInicial={plano}
      conversaInicial={conversa}
      roadmapInicial={roadmapInicial}
      portas={portas}
      nome={nome}
      diasRestantes={diasAte(proximo.data)}
      edicao={proximo.edicao}
    />
  );
}
