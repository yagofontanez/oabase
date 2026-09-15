import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Prova, type QuestaoDaProva } from "@/components/app/prova";
import { getDisciplinas } from "@/lib/content/queries";
import { formatarData } from "@/lib/format";
import { supabaseServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = {
  title: "Simulado",
  robots: { index: false, follow: false },
};

type LinhaDaProva = {
  ordem: number;
  questao_id: string;
  numero: number;
  enunciado: string;
  alternativas: Record<string, string>;
  exame_edicao: number;
  disciplina_nome: string | null;
  marcada: string | null;
};

type LinhaDoRelatorio = {
  ordem: number;
  questao_id: string;
  numero: number;
  exame_edicao: number;
  exame_slug: string;
  disciplina_nome: string | null;
  marcada: string | null;
  gabarito: string;
  acertou: boolean;
};

export default async function SimuladoEmCursoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await supabaseServidor();
  const disciplinasDoAcervo = await getDisciplinas();

  const { data: simulado } = await supabase
    .from("simulados")
    .select("id, minutos, total, acertos, iniciado_em, finaliza_em, finalizado_em, exames(edicao, slug)")
    .eq("id", id)
    .maybeSingle();

  // A RLS já garante que só o dono enxerga a linha; ausência aqui é 404 tanto
  // para simulado inexistente quanto para simulado de outra pessoa, que é
  // exatamente o que se quer dizer nos dois casos.
  if (!simulado) notFound();

  const exame = Array.isArray(simulado.exames)
    ? simulado.exames[0]
    : simulado.exames;

  /* Quem diz se acabou é o banco, e não o relógio deste processo. As funções
     que gravam a marcação e a correção já comparam com `now()` do Postgres;
     um segundo relógio decidindo a mesma coisa é um bug esperando um servidor
     com hora dessincronizada — a tela mostraria a prova aberta e o banco
     recusaria cada marcação, sem explicar por quê. */
  const { data: encerrado } = await supabase.rpc("simulado_encerrado", {
    p_simulado_id: id,
  });

  /* ---------------- Prova em andamento ---------------- */
  if (!encerrado) {
    const { data } = await supabase.rpc("questoes_do_simulado", {
      p_simulado_id: id,
    });
    const questoes: QuestaoDaProva[] = ((data ?? []) as LinhaDaProva[]).map(
      (q) => ({
        ordem: q.ordem,
        questaoId: q.questao_id,
        numero: q.numero,
        enunciado: q.enunciado,
        alternativas: q.alternativas,
        exameEdicao: q.exame_edicao,
        disciplina: q.disciplina_nome,
        marcada: (q.marcada as QuestaoDaProva["marcada"]) ?? null,
      }),
    );

    return (
      <Prova
        simuladoId={id}
        questoes={questoes}
        finalizaEm={simulado.finaliza_em}
        edicao={exame?.edicao ?? null}
      />
    );
  }

  /* ---------------- Relatório ---------------- */

  // O prazo pode ter vencido com a aba fechada. Corrigir na primeira abertura
  // é o que impede um simulado de ficar preso em aberto para sempre — e
  // `finalizar_simulado` é idempotente, então chamar de novo não custa nada.
  if (simulado.finalizado_em === null) {
    await supabase.rpc("finalizar_simulado", { p_simulado_id: id });
  }

  const { data: relatorio } = await supabase.rpc("relatorio_do_simulado", {
    p_simulado_id: id,
  });
  const linhas = (relatorio ?? []) as LinhaDoRelatorio[];

  const respondidas = linhas.filter((l) => l.marcada).length;
  const acertos = linhas.filter((l) => l.acertou).length;
  const total = linhas.length;
  const taxa = total > 0 ? Math.round((acertos / total) * 100) : 0;
  const passou = total > 0 && acertos / total >= 0.5;

  // Por disciplina: é onde o relatório vira estudo em vez de nota.
  const porDisciplina = new Map<string, { certas: number; total: number }>();
  for (const l of linhas) {
    const nome = l.disciplina_nome ?? "Sem classificação";
    const atual = porDisciplina.get(nome) ?? { certas: 0, total: 0 };
    atual.total += 1;
    if (l.acertou) atual.certas += 1;
    porDisciplina.set(nome, atual);
  }
  const disciplinas = [...porDisciplina.entries()]
    .map(([nome, v]) => ({ nome, ...v, taxa: Math.round((v.certas / v.total) * 100) }))
    .sort((a, b) => b.total - a.total || a.taxa - b.taxa);

  const erradas = linhas.filter((l) => !l.acertou);
  const slugPorNome = new Map(
    disciplinasDoAcervo.map((disciplina) => [disciplina.nome, disciplina.slug]),
  );
  const prioridades = disciplinas
    .map((disciplina) => ({
      ...disciplina,
      erros: disciplina.total - disciplina.certas,
      slug: slugPorNome.get(disciplina.nome) ?? null,
    }))
    .filter((disciplina) => disciplina.erros > 0 && disciplina.slug)
    .sort((a, b) => b.erros - a.erros || a.taxa - b.taxa)
    .slice(0, 3);
  const faltaramParaOCorte =
    total === 80 ? Math.max(0, 40 - acertos) : Math.max(0, Math.ceil(total / 2) - acertos);

  return (
    <div className="painel-conteudo flex max-w-[1000px] flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 border-b border-line pb-5">
        <div className="flex flex-col gap-1">
          <span className="rotulo">Resultado</span>
          <h1 className="text-[clamp(1.6rem,2.6vw,1.95rem)] leading-[1.1] font-extrabold tracking-[-0.035em] text-ink">
            {exame ? `${exame.edicao}º Exame` : "Bloco rápido"}
          </h1>
          <p className="text-[0.94rem] text-muted">
            {formatarData(String(simulado.finalizado_em ?? simulado.iniciado_em).slice(0, 10))}{" "}
            · {respondidas} de {total} respondidas
          </p>
        </div>
        <div className="flex flex-col gap-0.5 sm:items-end">
          <span className="flex items-baseline gap-2">
            <span
              className={`text-[2.6rem] leading-none font-extrabold tracking-[-0.045em] tabular-nums ${
                passou ? "text-brand-700" : "text-vinho-600"
              }`}
            >
              {acertos}
            </span>
            <span className="text-[1rem] font-semibold text-ink">
              de {total} · {taxa}%
            </span>
          </span>
          <span className="text-[0.85rem] text-muted">
            {total === 80
              ? passou
                ? "Acima dos 40 acertos que aprovam"
                : `Faltaram ${40 - acertos} acertos para a linha de corte`
              : "Projetado na régua da 1ª fase: 50% aprova"}
          </span>
        </div>
      </header>

      {/* ---- Por disciplina ---- */}
      <section className="superficie flex flex-col gap-4 p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="rotulo">Onde você acertou e onde não</span>
          <span className="text-[0.8rem] text-muted">
            classificação por disciplina é aproximada
          </span>
        </div>
        <ul className="flex flex-col gap-3">
          {disciplinas.map((d) => (
            <li key={d.nome} className="flex flex-col gap-1.5">
              <span className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 flex-1 truncate text-[0.92rem] text-body">
                  {d.nome}
                </span>
                <span className="shrink-0 text-[0.86rem] font-semibold text-ink tabular-nums">
                  {d.certas}/{d.total}
                </span>
              </span>
              <span className="h-1.5 overflow-hidden rounded-full bg-sunk">
                <span
                  className={`block h-full rounded-full ${
                    d.taxa >= 50 ? "bg-brand-400" : "bg-vinho-200"
                  }`}
                  style={{ width: `${d.taxa}%` }}
                />
              </span>
            </li>
          ))}
        </ul>
      </section>

      {prioridades.length > 0 && (
        <section className="overflow-hidden rounded-[22px] bg-brand-900 text-white shadow-[0_18px_45px_rgba(8,58,49,0.14)]">
          <div className="grid gap-6 p-6 sm:p-7 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <span className="text-[0.72rem] font-bold tracking-[0.14em] text-ouro-200 uppercase">
                Plano de recuperação
              </span>
              <h2 className="mt-2 text-[1.45rem] leading-tight font-extrabold tracking-[-0.025em] text-white">
                {faltaramParaOCorte > 0
                  ? `${faltaramParaOCorte} ${faltaramParaOCorte === 1 ? "ponto separou" : "pontos separaram"} você da linha de corte`
                  : "Proteja a margem antes do próximo simulado"}
              </h2>
              <p className="mt-3 text-[0.9rem] leading-relaxed text-white/70">
                A ordem abaixo começa onde este simulado concentrou mais erros.
                É uma prioridade de revisão, não uma previsão de aprovação; a
                classificação por disciplina ainda é aproximada.
              </p>
            </div>

            <ol className="grid gap-2.5">
              {prioridades.map((disciplina, indice) => (
                <li key={disciplina.nome}>
                  <Link
                    href={`/app/questoes?modo=erros&disciplina=${disciplina.slug}`}
                    className="group flex items-center gap-4 rounded-[15px] border border-white/10 bg-white/[0.07] p-4 transition-colors hover:bg-white/[0.12]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ouro-400 text-[0.78rem] font-extrabold text-noite">
                      {indice + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-[0.92rem] text-white">
                        Revisar {disciplina.nome}
                      </strong>
                      <span className="mt-0.5 block text-[0.78rem] text-brand-100">
                        {disciplina.erros} {disciplina.erros === 1 ? "erro" : "erros"} em {disciplina.total} questões · comece pelo caderno de erros
                      </span>
                    </span>
                    <span className="text-ouro-200 transition-transform group-hover:translate-x-0.5" aria-hidden="true">→</span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-white/[0.04] px-6 py-4 sm:px-7">
            <p className="text-[0.8rem] text-brand-100">
              Depois das três filas, faça um bloco rápido para medir novamente sem ver o gabarito durante a prova.
            </p>
            <Link
              href="/app/simulado"
              className="rounded-full border border-white/20 px-4 py-2 text-[0.82rem] font-semibold text-white transition-colors hover:bg-white hover:text-brand-900"
            >
              Programar novo bloco
            </Link>
          </div>
        </section>
      )}

      {/* ---- Espelho ---- */}
      <section className="superficie flex flex-col gap-4 p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="rotulo">Espelho da prova</span>
          <span className="text-[0.8rem] text-muted">
            sua marcação · gabarito
          </span>
        </div>
        <div className="oab-cartao">
          {linhas.map((l) => (
            <span
              key={l.questao_id}
              title={`Questão ${l.ordem}: você marcou ${l.marcada ?? "—"}, gabarito ${l.gabarito}`}
              className={`flex h-8 items-center justify-center rounded-[6px] text-[0.72rem] font-semibold tabular-nums ${
                l.acertou
                  ? "bg-brand-500 text-white"
                  : l.marcada
                    ? "bg-vinho-500 text-white"
                    : "bg-sunk text-muted"
              }`}
            >
              {l.ordem}
            </span>
          ))}
        </div>
        <p className="text-[0.82rem] text-muted">
          Esmeralda acertou · ameixa errou · cinza ficou em branco. As{" "}
          {erradas.filter((l) => l.marcada).length} erradas já estão no caderno
          de erros.
        </p>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/app/questoes?modo=erros"
          className="rounded-full bg-brand-600 px-5 py-2.5 text-[0.92rem] font-semibold text-white transition-colors hover:bg-brand-700"
        >
          Revisar os erros
        </Link>
        <Link
          href="/app/simulado"
          className="rounded-full border border-hairline px-5 py-2.5 text-[0.92rem] font-semibold text-ink transition-colors hover:border-brand-300 hover:text-brand-700"
        >
          Outro simulado
        </Link>
      </div>
    </div>
  );
}
