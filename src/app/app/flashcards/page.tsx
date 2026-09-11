import type { Metadata } from "next";
import { Flashcards } from "@/components/app/flashcards";
import { adicionarDias, hojeEmBrasilia } from "@/lib/calendario";
import { getArtigo, getLei, getSumula } from "@/lib/content/queries";
import type {
  Flashcard,
  FonteDoFlashcard,
  FonteParaNovoFlashcard,
} from "@/lib/flashcards";
import { supabaseServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = {
  title: "Flashcards",
  robots: { index: false, follow: false },
};

type LinhaFlashcard = {
  id: string;
  frente: string;
  verso: string;
  trecho_fonte: string;
  proxima_revisao: string;
  intervalo_dias: number;
  facilidade: number;
  repeticoes: number;
  suspenso: boolean;
  criado_em: string;
  atualizado_em: string;
  lei_slug: string | null;
  lei_sigla: string | null;
  artigo_slug: string | null;
  artigo_numero: string | null;
  sumula_slug: string | null;
  sumula_numero: number | null;
  sumula_vinculante: boolean | null;
  revisoes_total: number;
};

function parametro(valor: string | string[] | undefined) {
  return typeof valor === "string" ? valor : null;
}

async function fontePedida(
  artigoBruto: string | null,
  sumulaSlug: string | null,
  trechoBruto: string | null,
): Promise<FonteParaNovoFlashcard | null> {
  const trechoPedido = (trechoBruto ?? "").slice(0, 2000);
  if (artigoBruto) {
    const [leiSlug, artigoSlug, sobra] = artigoBruto.split("/");
    if (!leiSlug || !artigoSlug || sobra) return null;
    const [lei, artigo] = await Promise.all([
      getLei(leiSlug),
      getArtigo(leiSlug, artigoSlug),
    ]);
    if (!lei || !artigo) return null;
    const texto = [artigo.caput, ...artigo.paragrafos].join("\n\n");
    const trecho = texto.includes(trechoPedido) ? trechoPedido : "";
    return {
      tipo: "artigo",
      leiSlug,
      artigoSlug,
      rotulo: `Art. ${artigo.numero} ${lei.sigla}`,
      href: `/legislacao/${leiSlug}/${artigoSlug}`,
      trecho,
    };
  }
  if (sumulaSlug) {
    const sumula = await getSumula(sumulaSlug);
    if (!sumula) return null;
    const trecho = sumula.texto.includes(trechoPedido) ? trechoPedido : "";
    return {
      tipo: "sumula",
      sumulaSlug,
      rotulo: sumula.vinculante
        ? `Súmula Vinculante ${sumula.numero}`
        : `Súmula ${sumula.numero} do ${sumula.tribunal.toUpperCase()}`,
      href: `/sumulas/${sumula.slug}`,
      trecho,
    };
  }
  return null;
}

export default async function FlashcardsPage({
  searchParams,
}: {
  searchParams: Promise<{
    modo?: string;
    artigo?: string;
    sumula?: string;
    trecho?: string;
  }>;
}) {
  const consulta = await searchParams;
  const hoje = hojeEmBrasilia();
  const supabase = await supabaseServidor();
  const [listaRes, revisadosRes, fonteInicial] = await Promise.all([
    supabase.rpc("listar_meus_flashcards"),
    supabase
      .from("flashcard_revisoes")
      .select("id", { count: "exact", head: true })
      .gte("revisado_em", `${hoje}T00:00:00-03:00`)
      .lt(
        "revisado_em",
        `${adicionarDias(hoje, 1)}T00:00:00-03:00`,
      ),
    fontePedida(
      parametro(consulta.artigo),
      parametro(consulta.sumula),
      parametro(consulta.trecho),
    ),
  ]);
  if (listaRes.error) {
    throw new Error(`Não foi possível abrir os flashcards: ${listaRes.error.message}`);
  }

  const cartoes: Flashcard[] = ((listaRes.data ?? []) as LinhaFlashcard[]).map(
    (linha) => {
      let fonte: FonteDoFlashcard = null;
      if (
        linha.lei_slug &&
        linha.lei_sigla &&
        linha.artigo_slug &&
        linha.artigo_numero
      ) {
        fonte = {
          tipo: "artigo",
          leiSlug: linha.lei_slug,
          artigoSlug: linha.artigo_slug,
          rotulo: `Art. ${linha.artigo_numero} ${linha.lei_sigla}`,
          href: `/legislacao/${linha.lei_slug}/${linha.artigo_slug}`,
        };
      } else if (linha.sumula_slug && linha.sumula_numero) {
        fonte = {
          tipo: "sumula",
          sumulaSlug: linha.sumula_slug,
          rotulo: linha.sumula_vinculante
            ? `Súmula Vinculante ${linha.sumula_numero}`
            : `Súmula ${linha.sumula_numero}`,
          href: `/sumulas/${linha.sumula_slug}`,
        };
      }
      return {
        id: linha.id,
        frente: linha.frente,
        verso: linha.verso,
        trechoFonte: linha.trecho_fonte,
        proximaRevisao: linha.proxima_revisao,
        intervaloDias: Number(linha.intervalo_dias),
        facilidade: Number(linha.facilidade),
        repeticoes: Number(linha.repeticoes),
        suspenso: linha.suspenso,
        criadoEm: linha.criado_em,
        atualizadoEm: linha.atualizado_em,
        revisoesTotal: Number(linha.revisoes_total),
        fonte,
      };
    },
  );

  return (
    <Flashcards
      cartoesIniciais={cartoes}
      fonteInicial={fonteInicial}
      hoje={hoje}
      revisadosHoje={revisadosRes.count ?? 0}
      abrirRevisao={consulta.modo === "revisao"}
    />
  );
}
