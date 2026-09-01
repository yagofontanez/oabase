import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Prova, type QuestaoDaProva } from "@/components/app/prova";
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
