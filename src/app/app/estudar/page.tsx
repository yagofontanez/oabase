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
  for (const artigo of artigos) {
    const atual = portaDeEntrada.get(artigo.disciplinaSlug);
    if (!atual || artigo.incidencia > atual.incidencia) {
      portaDeEntrada.set(artigo.disciplinaSlug, artigo);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex max-w-[58ch] flex-col gap-2">
        <h1 className="text-[clamp(1.8rem,3.2vw,2.3rem)] leading-[1.06] font-extrabold tracking-[-0.035em] text-ink">
          Estudar
        </h1>
        <p className="text-body">
          A ordem importa mais do que o volume. Abaixo estão as disciplinas
          pelo peso que têm na prova — e, quando já existe comentário
          publicado, o artigo por onde começar em cada uma.
        </p>
      </header>

      {/* Banco de questões: o estado real, sem fingir que já está pronto. */}
      <section
        className={`flex flex-wrap items-center justify-between gap-6 rounded-[18px] p-7 ${
          temPlano ? "superficie" : "border border-line bg-sunk"
        }`}
      >
        <div className="flex max-w-[52ch] flex-col gap-1.5">
          <span className="text-[0.9rem] font-semibold text-muted">
            Banco de questões
          </span>
          <p className="text-[1.3rem] font-bold text-ink">
            {acervo.toLocaleString("pt-BR")} questões reais, comentadas
          </p>
          <p className="text-[0.94rem] text-muted">
            {temPlano
              ? "Liberado no seu plano. A tela de resolução entra na próxima fase."
              : "A resolução de questões entra junto com o checkout. Enquanto isso, tudo abaixo já está aberto."}
          </p>
        </div>
        {!temPlano && (
          <Link
            href="/precos"
            className="rounded-full bg-brand-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Ver planos
          </Link>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-[1.3rem] font-bold text-ink">
            Por onde começar
          </h2>
          <p className="text-[0.9rem] text-muted">
            Média de questões por prova, em {exames.length} exames
          </p>
        </div>

        <ol className="superficie divide-y divide-line overflow-hidden">
          {disciplinas.map((d, i) => {
            const artigo = portaDeEntrada.get(d.slug);
            const fatia = Math.round((d.mediaPorProva / total) * 100);

            return (
              <li
                key={d.slug}
                className="grid items-center gap-x-5 gap-y-2 p-5 sm:grid-cols-[2rem_1.4fr_1fr_auto]"
              >
                <span className="text-[0.9rem] font-bold text-hairline tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>

                <span className="font-semibold text-ink">{d.nome}</span>

                {/* A barra transforma a média em comparação: dá para ver o
                    peso relativo antes de ler o número. */}
                <span className="flex items-center gap-3">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunk">
                    <span
                      className="block h-full rounded-full bg-brand-400"
                      style={{ width: `${(d.mediaPorProva / maior) * 100}%` }}
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
        </ol>

        <p className="text-[0.88rem] text-muted">
          A média por disciplina ainda é estimativa: ela vira dado medido
          quando a classificação das questões do acervo for revisada.
        </p>
      </section>
    </div>
  );
}
