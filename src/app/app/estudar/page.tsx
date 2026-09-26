import type { Metadata } from "next";
import {
  Estudar,
  type AtalhoDeEstudo,
  type FaixaDeEstudo,
} from "@/components/app/estudar";
import { supabaseServidor } from "@/lib/supabase/servidor";
import {
  contarArtigosPorLei,
  getArtigosIndexaveis,
  getDisciplinas,
  getExames,
  getLeis,
  getSumulas,
} from "@/lib/content/queries";

export const metadata: Metadata = {
  title: "Estudar",
  robots: { index: false, follow: false },
};

/**
 * Faixas de prioridade.
 *
 * Não é decoração: o corte é feito na fatia acumulada da prova. Metade das
 * questões sai de um punhado de disciplinas, e uma lista plana de dezoito
 * itens numerados esconde exatamente isso — que é a única decisão que importa
 * para quem tem pouco tempo.
 */
const FAIXAS = [
  {
    titulo: "O núcleo",
    texto: "Metade da prova sai daqui.",
  },
  {
    titulo: "O corpo",
    texto: "Onde a nota se decide depois do núcleo.",
  },
  {
    titulo: "A cauda",
    texto: "Duas ou três questões cada. Rendem revisão, não estudo profundo.",
  },
];

const ICONES: Record<AtalhoDeEstudo["chave"], React.ReactNode> = {
  novas: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      className="h-[18px] w-[18px]"
      aria-hidden="true"
    >
      <path d="M9.2 9a2.8 2.8 0 1 1 3.8 2.6c-.7.3-1 .9-1 1.6v.4M12 17.6h.01" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  ),
  revisao: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      className="h-[18px] w-[18px]"
      aria-hidden="true"
    >
      <path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v4h-4" />
    </svg>
  ),
  erros: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      className="h-[18px] w-[18px]"
      aria-hidden="true"
    >
      <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v15H5.5A1.5 1.5 0 0 0 4 19.5zM4 19.5A1.5 1.5 0 0 1 5.5 21H19" />
      <path d="M10.5 8.5l4 4M14.5 8.5l-4 4" />
    </svg>
  ),
  simulado: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      className="h-[18px] w-[18px]"
      aria-hidden="true"
    >
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9.5V13l2.4 1.7M9 2h6" />
    </svg>
  ),
};

export default async function EstudarPage() {
  const supabase = await supabaseServidor();

  // Uma rodada: acervo aberto, contagem de artigos e o que é da pessoa, tudo
  // junto. Eram três — o acervo, depois o desempenho, depois 42 contagens
  // lei a lei que só começavam quando a lista de leis chegava.
  //
  // `meu_desempenho` conta por questão, não por tentativa — e é ela que sabe
  // quantas voltaram para revisão hoje. Sem plano, a RLS devolve zero linhas
  // e a tela mostra o acervo em vez de números vazios.
  const [
    disciplinas,
    artigos,
    leis,
    exames,
    sumulas,
    contagemPorLei,
    assinaturaRes,
    desempenhoRes,
  ] = await Promise.all([
    getDisciplinas(),
    getArtigosIndexaveis(),
    getLeis(),
    getExames(),
    getSumulas(),
    contarArtigosPorLei(),
    supabase.from("assinaturas").select("plano").eq("status", "ativa").limit(1),
    supabase.rpc("meu_desempenho"),
  ]);

  const temPlano = Boolean(assinaturaRes.data?.[0]);
  const desempenho = (
    Array.isArray(desempenhoRes.data) ? desempenhoRes.data[0] : desempenhoRes.data
  ) as
    | { respondidas: number; acertos: number; erros: number; revisao_hoje: number }
    | undefined;

  const respondidas = desempenho?.respondidas ?? 0;
  const erros = desempenho?.erros ?? 0;
  const revisaoHoje = desempenho?.revisao_hoje ?? 0;

  const acervoQuestoes = exames.reduce((s, e) => s + e.questoesCarregadas, 0);
  const ingeridos = exames.filter((e) => e.questoesCarregadas > 0).length;

  const totalDeArtigos = leis.reduce(
    (s, l) => s + (contagemPorLei.get(l.slug) ?? 0),
    0,
  );

  const atalhos: AtalhoDeEstudo[] = [
    {
      chave: "novas",
      rotulo: "Questões novas",
      quantidade: Math.max(0, acervoQuestoes - respondidas),
      unidade: "ainda sem resposta sua",
      porque: "da prova mais recente para trás",
      vazio: "Você já passou por todas. Vá para a revisão.",
      href: "/app/questoes?modo=novas",
      icone: ICONES.novas,
    },
    {
      chave: "revisao",
      rotulo: "Revisão de hoje",
      quantidade: revisaoHoje,
      unidade: "marcadas para hoje",
      porque: "o intervalo em que você está prestes a esquecer",
      vazio: "Nada marcado para hoje. A fila volta sozinha.",
      href: "/app/questoes?modo=revisao",
      icone: ICONES.revisao,
    },
    {
      chave: "erros",
      rotulo: "Caderno de erros",
      quantidade: erros,
      unidade: "erradas na última tentativa",
      porque: "sai da lista sozinha quando você acerta",
      vazio: "Nenhum erro em aberto.",
      href: "/app/questoes?modo=erros",
      icone: ICONES.erros,
    },
    {
      chave: "simulado",
      rotulo: "Simulado",
      quantidade: null,
      unidade: "80 questões, cinco horas",
      porque: "sem gabarito até entregar, como na prova",
      vazio: "",
      href: "/app/simulado",
      icone: ICONES.simulado,
    },
  ];

  // A "porta de entrada" de cada disciplina sai do próprio acervo: o artigo
  // mais cobrado que já tem comentário publicado. Nada é escolhido à mão —
  // quando a base crescer, a sugestão melhora sozinha.
  const portaDeEntrada = new Map<string, (typeof artigos)[number]>();
  const comentados = new Map<string, number>();
  for (const artigo of artigos) {
    comentados.set(
      artigo.disciplinaSlug,
      (comentados.get(artigo.disciplinaSlug) ?? 0) + 1,
    );
    const atual = portaDeEntrada.get(artigo.disciplinaSlug);
    if (!atual || artigo.incidencia > atual.incidencia) {
      portaDeEntrada.set(artigo.disciplinaSlug, artigo);
    }
  }

  const siglaPorLei = new Map(leis.map((l) => [l.slug, l.sigla]));
  const leiDaDisciplina = new Map<string, (typeof leis)[number]>();
  for (const lei of leis) {
    if (lei.disciplinaSlug && !leiDaDisciplina.has(lei.disciplinaSlug)) {
      leiDaDisciplina.set(lei.disciplinaSlug, lei);
    }
  }

  const total = disciplinas.reduce((s, d) => s + d.mediaPorProva, 0);
  const maior = disciplinas[0]?.mediaPorProva ?? 1;

  // `disciplinas` já vem ordenada por peso, então a fatia acumulada até cada
  // posição é o que define em que faixa a disciplina cai.
  const comFaixa = disciplinas.map((d, i) => {
    const acumulado = disciplinas
      .slice(0, i + 1)
      .reduce((s, anterior) => s + anterior.mediaPorProva, 0);
    const fatia = acumulado / total;
    return { ...d, faixa: fatia <= 0.52 ? 0 : fatia <= 0.85 ? 1 : 2 };
  });

  const faixas: FaixaDeEstudo[] = FAIXAS.map((faixa, i) => {
    const itens = comFaixa
      .filter((d) => d.faixa === i)
      .map((d) => {
        const artigo = portaDeEntrada.get(d.slug);
        const lei = leiDaDisciplina.get(d.slug);
        return {
          slug: d.slug,
          nome: d.nome,
          mediaPorProva: d.mediaPorProva,
          fatia: (d.mediaPorProva / maior) * 100,
          comentados: comentados.get(d.slug) ?? 0,
          artigo: artigo
            ? {
                href: `/legislacao/${artigo.leiSlug}/${artigo.slug}`,
                rotulo: `Art. ${artigo.numero} ${siglaPorLei.get(artigo.leiSlug) ?? ""}`.trim(),
              }
            : null,
          lei: lei
            ? {
                href: `/legislacao/${lei.slug}`,
                sigla: lei.sigla,
                artigos: contagemPorLei.get(lei.slug) ?? 0,
              }
            : null,
        };
      });

    return {
      ...faixa,
      itens,
      questoes: itens.reduce((s, d) => s + d.mediaPorProva, 0),
    };
  }).filter((g) => g.itens.length > 0);

  return (
    <Estudar
      atalhos={atalhos}
      acervo={{
        questoes: acervoQuestoes,
        exames: ingeridos,
        artigos: totalDeArtigos,
        normas: leis.length,
        sumulas: sumulas.length,
        comentados: artigos.length,
      }}
      faixas={faixas}
      temPlano={temPlano}
      respondidas={respondidas}
    />
  );
}
