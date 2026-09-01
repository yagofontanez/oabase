import type { Metadata } from "next";
import Link from "next/link";
import {
  IniciarSimulado,
  type OpcaoDeSimulado,
} from "@/components/app/iniciar-simulado";
import { formatarData } from "@/lib/format";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { getExames } from "@/lib/content/queries";

export const metadata: Metadata = {
  title: "Simulado",
  robots: { index: false, follow: false },
};

/** A 1ª fase: 80 questões em 5 horas, 40 acertos para passar. */
const MINUTOS_DA_PROVA = 300;

export default async function SimuladoPage() {
  const supabase = await supabaseServidor();

  const [assinaturaRes, exames, abertosRes, historicoRes] = await Promise.all([
    supabase.from("assinaturas").select("plano").eq("status", "ativa").limit(1),
    getExames(),
    supabase
      .from("simulados")
      .select("id, finaliza_em")
      .is("finalizado_em", null)
      .gt("finaliza_em", new Date().toISOString())
      .limit(1),
    supabase
      .from("simulados")
      .select("id, total, acertos, iniciado_em, finalizado_em, exames(edicao)")
      .not("finalizado_em", "is", null)
      .order("finalizado_em", { ascending: false })
      .limit(10),
  ]);

  const temPlano = Boolean(assinaturaRes.data?.[0]);
  const emAndamento = abertosRes.data?.[0] ?? null;

  if (!temPlano) {
    return (
      <div className="painel-conteudo flex max-w-[720px] flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-[clamp(1.6rem,2.6vw,1.95rem)] leading-[1.1] font-extrabold tracking-[-0.035em] text-ink">
            Simulado
          </h1>
          <p className="text-body">
            A prova cronometrada faz parte do plano. A legislação comentada, os
            exames e as estatísticas do site continuam abertos.
          </p>
        </header>
        <Link
          href="/app/assinar"
          className="self-start rounded-full bg-brand-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-brand-700"
        >
          Ver planos
        </Link>
      </div>
    );
  }

  const ingeridos = exames.filter((e) => e.questoesCarregadas > 0);
  const maisRecente = ingeridos[0];

  const opcoes: OpcaoDeSimulado[] = [
    ...(maisRecente
      ? [
          {
            chave: `exame-${maisRecente.slug}`,
            titulo: `Prova completa · ${maisRecente.edicao}º Exame`,
            texto:
              "A prova inteira, na ordem original, no tempo real. Anuladas ficam de fora — elas não têm resposta certa para treinar.",
            exame: maisRecente.slug,
            total: 80,
            minutos: MINUTOS_DA_PROVA,
          },
        ]
      : []),
    {
      chave: "bloco",
      titulo: "Bloco rápido",
      texto:
        "20 questões sorteadas de todo o acervo, em uma hora. Serve para treinar ritmo sem separar uma tarde.",
      exame: null,
      total: 20,
      minutos: 60,
    },
  ];

  type LinhaHistorico = {
    id: string;
    total: number;
    acertos: number | null;
    iniciado_em: string;
    finalizado_em: string;
    exames: { edicao: number } | { edicao: number }[] | null;
  };
  const historico = (historicoRes.data ?? []) as unknown as LinhaHistorico[];

  return (
    <div className="painel-conteudo flex max-w-[980px] flex-col gap-6">
      <header className="flex max-w-[62ch] flex-col gap-2">
        <h1 className="text-[clamp(1.6rem,2.6vw,1.95rem)] leading-[1.1] font-extrabold tracking-[-0.035em] text-ink">
          Simulado
        </h1>
        <p className="text-body">
          Sem gabarito até o fim, com o relógio correndo do lado do servidor —
          fechar a aba não pausa a prova. O que você responder aqui entra no
          caderno de erros e na fila de revisão como qualquer outra questão.
        </p>
      </header>

      {/* Simulado aberto vem antes de tudo: começar outro é impossível, e a
          pessoa precisa saber por quê sem ter de descobrir no erro. */}
      {emAndamento ? (
        <section className="superficie flex flex-wrap items-center justify-between gap-5 p-6">
          <div className="flex flex-col gap-0.5">
            <span className="flex items-center gap-2 font-semibold text-ink">
              <span className="h-1.5 w-1.5 rounded-full bg-ouro-400" />
              Você tem um simulado em andamento
            </span>
            <span className="text-[0.9rem] text-muted">
              O relógio não parou. Ele encerra sozinho no prazo.
            </span>
          </div>
          <Link
            href={`/app/simulado/${emAndamento.id}`}
            className="rounded-full bg-brand-600 px-5 py-2.5 text-[0.92rem] font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Voltar à prova
          </Link>
        </section>
      ) : (
        <IniciarSimulado opcoes={opcoes} />
      )}

      {historico.length > 0 && (
        <section className="flex flex-col gap-3">
          <span className="rotulo">Provas anteriores</span>
          <ul className="superficie divide-y divide-line overflow-hidden">
            {historico.map((s) => {
              const exame = Array.isArray(s.exames) ? s.exames[0] : s.exames;
              const acertos = s.acertos ?? 0;
              const taxa = s.total > 0 ? Math.round((acertos / s.total) * 100) : 0;
              // A régua é a da prova: 40 de 80. Num bloco de 20 a projeção
              // é proporcional, e a tela diz que é projeção.
              const passou = acertos / s.total >= 0.5;
              return (
                <li key={s.id}>
                  <Link
                    href={`/app/simulado/${s.id}`}
                    className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 p-4 transition-colors hover:bg-paper"
                  >
                    <span className="flex flex-col">
                      <span className="font-semibold text-ink">
                        {exame ? `${exame.edicao}º Exame` : "Bloco rápido"} ·{" "}
                        {s.total} questões
                      </span>
                      <span className="text-[0.85rem] text-muted">
                        {formatarData(String(s.finalizado_em).slice(0, 10))}
                      </span>
                    </span>
                    <span className="flex items-center gap-4">
                      <span className="text-[1.15rem] font-bold text-ink tabular-nums">
                        {acertos}/{s.total}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[0.8rem] font-semibold tabular-nums ${
                          passou
                            ? "bg-brand-50 text-brand-700"
                            : "bg-vinho-50 text-vinho-600"
                        }`}
                      >
                        {taxa}%
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
