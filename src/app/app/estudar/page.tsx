import type { Metadata } from "next";
import Link from "next/link";
import { supabaseServidor } from "@/lib/supabase/servidor";
import {
  getArtigosIndexaveis,
  getDisciplinas,
  getExames,
  getLeis,
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
    texto: "Metade da prova sai daqui. Sem estas, a conta não fecha.",
  },
  {
    titulo: "O corpo",
    texto: "Onde a nota se decide depois de o núcleo estar garantido.",
  },
  {
    titulo: "A cauda",
    texto: "Duas ou três questões cada. Rendem revisão, não estudo profundo.",
  },
];

export default async function EstudarPage() {
  const [disciplinas, artigos, leis, exames] = await Promise.all([
    getDisciplinas(),
    getArtigosIndexaveis(),
    getLeis(),
    getExames(),
  ]);

  const supabase = await supabaseServidor();
  const { data: assinaturas } = await supabase
    .from("assinaturas")
    .select("plano")
    .eq("status", "ativa")
    .limit(1);
  const temPlano = Boolean(assinaturas?.[0]);

  const acervo = exames.reduce((s, e) => s + e.questoesCarregadas, 0);
  const total = disciplinas.reduce((s, d) => s + d.mediaPorProva, 0);
  const maior = disciplinas[0]?.mediaPorProva ?? 1;

  const siglaPorLei = new Map(leis.map((l) => [l.slug, l.sigla]));

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

  // `disciplinas` já vem ordenada por peso, então a fatia acumulada até
  // cada posição é o que define em que faixa a disciplina cai.
  const comFaixa = disciplinas.map((d, i) => {
    const acumulado = disciplinas
      .slice(0, i + 1)
      .reduce((s, anterior) => s + anterior.mediaPorProva, 0);
    const fatia = acumulado / total;
    return { ...d, faixa: fatia <= 0.52 ? 0 : fatia <= 0.85 ? 1 : 2 };
  });

  const grupos = FAIXAS.map((faixa, i) => {
    const itens = comFaixa.filter((d) => d.faixa === i);
    return {
      ...faixa,
      itens,
      questoes: itens.reduce((s, d) => s + d.mediaPorProva, 0),
    };
  }).filter((g) => g.itens.length > 0);

  return (
    <div className="painel-conteudo flex flex-col gap-8">
      <header className="flex max-w-[62ch] flex-col gap-2">
        <h1 className="text-[clamp(1.75rem,3vw,2.15rem)] leading-[1.08] font-extrabold tracking-[-0.035em] text-ink">
          Estudar
        </h1>
        <p className="text-body">
          A ordem importa mais do que o volume. As disciplinas abaixo estão
          agrupadas pela fatia que ocupam na prova — e, quando já existe
          comentário publicado, com o artigo por onde começar em cada uma.
        </p>
      </header>

      {/* Banco de questões: o estado real, sem fingir que já está pronto. */}
      <section className="superficie flex flex-wrap items-center justify-between gap-6 p-6">
        <div className="flex max-w-[56ch] flex-col gap-1">
          <span className="rotulo">Banco de questões</span>
          <p className="text-[1.2rem] font-bold text-ink">
            {acervo.toLocaleString("pt-BR")} questões reais, com gabarito
            oficial
          </p>
          <p className="text-[0.92rem] text-muted">
            {temPlano
              ? "Liberado no seu plano. Errar registra no caderno de erros e agenda a revisão sozinho."
              : "A resolução de questões faz parte do plano. Enquanto isso, tudo abaixo já está aberto."}
          </p>
        </div>
        <Link
          href={temPlano ? "/app/questoes" : "/app/assinar"}
          className="rounded-full bg-brand-600 px-5 py-2.5 text-[0.92rem] font-semibold text-white transition-colors hover:bg-brand-700"
        >
          {temPlano ? "Começar a resolver" : "Ver planos"}
        </Link>
      </section>

      <section className="flex flex-col gap-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-[1.3rem] font-bold text-ink">Por onde começar</h2>
          <p className="text-[0.9rem] text-muted">
            Média de questões por prova, em {exames.length} exames
          </p>
        </div>

        {grupos.map((grupo) => (
          <div key={grupo.titulo} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 className="flex items-baseline gap-2.5 font-bold text-ink">
                {grupo.titulo}
                <span className="text-[0.84rem] font-semibold text-brand-600 tabular-nums">
                  ≈{grupo.questoes}q · {Math.round((grupo.questoes / total) * 100)}
                  % da prova
                </span>
              </h3>
              <p className="text-[0.88rem] text-muted">{grupo.texto}</p>
            </div>

            <ul className="superficie divide-y divide-line overflow-hidden">
              {grupo.itens.map((d) => {
                const artigo = portaDeEntrada.get(d.slug);
                const publicados = comentados.get(d.slug) ?? 0;
                const fatia = Math.round((d.mediaPorProva / total) * 100);

                return (
                  <li
                    key={d.slug}
                    className="grid items-center gap-x-6 gap-y-2.5 p-5 sm:grid-cols-[1.4fr_1fr_auto]"
                  >
                    <span className="flex flex-col gap-0.5">
                      <span className="font-semibold text-ink">{d.nome}</span>
                      <span className="text-[0.82rem] text-muted">
                        {publicados > 0
                          ? `${publicados} ${publicados === 1 ? "artigo comentado" : "artigos comentados"}`
                          : "comentários em produção"}
                      </span>
                    </span>

                    {/* A barra transforma a média em comparação: dá para ver o
                        peso relativo antes de ler o número. */}
                    <span className="flex items-center gap-3">
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunk">
                        <span
                          className="block h-full rounded-full bg-brand-400"
                          style={{
                            width: `${(d.mediaPorProva / maior) * 100}%`,
                          }}
                        />
                      </span>
                      <span className="shrink-0 text-[0.86rem] text-muted tabular-nums">
                        {d.mediaPorProva}q · {fatia}%
                      </span>
                    </span>

                    {artigo ? (
                      <Link
                        href={`/legislacao/${artigo.leiSlug}/${artigo.slug}`}
                        className="justify-self-start rounded-full bg-brand-50 px-4 py-1.5 text-[0.86rem] font-semibold whitespace-nowrap text-brand-700 transition-colors hover:bg-brand-100 sm:justify-self-end"
                      >
                        Art. {artigo.numero} {siglaPorLei.get(artigo.leiSlug)} →
                      </Link>
                    ) : (
                      <span className="justify-self-start text-[0.84rem] text-muted sm:justify-self-end">
                        sem material ainda
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        <p className="text-[0.88rem] text-muted">
          A média por disciplina ainda é estimativa: ela vira dado medido quando
          a classificação das questões do acervo for revisada.
        </p>
      </section>
    </div>
  );
}
