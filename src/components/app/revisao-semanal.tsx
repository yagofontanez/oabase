"use client";

import Link from "next/link";
import { useState } from "react";
import { formatarData } from "@/lib/format";
import {
  sugestoesDaSemana,
  type AcaoDaRevisao,
  type MetricasDaSemana,
  type RevisaoSalva,
} from "@/lib/revisao-semanal";

function horas(minutos: number) {
  if (minutos < 60) return `${minutos} min`;
  const inteiras = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto ? `${inteiras}h ${resto}min` : `${inteiras}h`;
}

function prioridadeClasse(prioridade: "alta" | "media" | "positiva") {
  if (prioridade === "alta") return "border-vinho-200 bg-vinho-50 text-vinho-700";
  if (prioridade === "positiva") return "border-brand-200 bg-brand-50 text-brand-700";
  return "border-ouro-200 bg-ouro-50 text-ouro-700";
}

export function RevisaoSemanal({
  metricas,
  salvaInicial,
  semanaAtual,
  semanaAnterior,
  proximaSemana,
}: {
  metricas: MetricasDaSemana;
  salvaInicial: RevisaoSalva | null;
  semanaAtual: string;
  semanaAnterior: string;
  proximaSemana: string;
}) {
  const sugestoes = sugestoesDaSemana(metricas);
  const [reflexao, setReflexao] = useState(salvaInicial?.reflexao ?? "");
  const [compromisso, setCompromisso] = useState(salvaInicial?.compromisso ?? "");
  const [acoes, setAcoes] = useState<AcaoDaRevisao[]>(
    salvaInicial?.acoes ??
      sugestoes
        .filter((sugestao) => sugestao.prioridade === "alta")
        .map((sugestao) => sugestao.id),
  );
  const [salva, setSalva] = useState(Boolean(salvaInicial));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const planejadoMinutos = Math.round(Number(metricas.planejado.horas) * 60);
  const aderencia = planejadoMinutos
    ? Math.round((metricas.executado.minutos / planejadoMinutos) * 100)
    : 0;
  const aderenciaVisual = Math.min(100, aderencia);
  const maiorCarga = Math.max(
    60,
    ...metricas.disciplinas.map((disciplina) =>
      Math.max(disciplina.horasPlanejadas * 60, disciplina.minutosFoco),
    ),
  );
  const atual = metricas.inicio === semanaAtual;
  const historicoFechado = !atual && Boolean(salvaInicial);
  const temAtividade =
    metricas.planejado.blocos > 0 ||
    metricas.executado.minutos > 0 ||
    metricas.questoes.respondidas > 0;

  async function salvar() {
    if (salvando) return;
    setSalvando(true);
    setErro(null);
    try {
      const resposta = await fetch("/api/revisao-semanal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inicio: metricas.inicio, reflexao, compromisso, acoes }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro ?? "Não consegui salvar a revisão.");
      setSalva(true);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não consegui salvar a revisão.");
    } finally {
      setSalvando(false);
    }
  }

  function alternarAcao(acao: AcaoDaRevisao) {
    setAcoes((atuais) =>
      atuais.includes(acao)
        ? atuais.filter((item) => item !== acao)
        : [...atuais, acao],
    );
    setSalva(false);
  }

  return (
    <div className="painel-conteudo flex max-w-[1280px] flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div>
          <span className="rotulo">Fechamento baseado no que aconteceu</span>
          <h1 className="mt-1 text-[clamp(1.8rem,3vw,2.45rem)] leading-none font-extrabold tracking-[-0.045em] text-ink">
            Revisão semanal
          </h1>
          <p className="mt-2 text-[0.9rem] text-body">
            {formatarData(metricas.inicio, { day: "2-digit", month: "long" })} a {formatarData(metricas.fim, { day: "2-digit", month: "long", year: "numeric" })}
            {atual && " · semana em andamento"}
            {historicoFechado && " · fechamento preservado"}
          </p>
        </div>
        <nav aria-label="Navegar entre semanas" className="flex items-center gap-2">
          <Link href={`/app/revisao-semanal?semana=${semanaAnterior}`} className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-surface text-body" aria-label="Semana anterior">←</Link>
          <Link href="/app/revisao-semanal" className="rounded-full border border-hairline bg-surface px-3.5 py-2 text-[0.76rem] font-semibold text-body">Esta semana</Link>
          {proximaSemana <= semanaAtual ? (
            <Link href={`/app/revisao-semanal?semana=${proximaSemana}`} className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-surface text-body" aria-label="Próxima semana">→</Link>
          ) : (
            <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-muted/30">→</span>
          )}
        </nav>
      </header>

      {!temAtividade ? (
        <section className="superficie flex flex-col items-start gap-3 p-7 sm:p-9">
          <span className="rotulo">Semana sem registro</span>
          <h2 className="text-[1.3rem] font-bold text-ink">Ainda não há execução para revisar.</h2>
          <p className="max-w-[62ch] text-[0.9rem] leading-relaxed text-body">Comece uma sessão guiada ou registre foco. Quando houver atividade, este fechamento será montado sem você preencher números à mão.</p>
          <Link href="/app/hoje" className="rounded-full bg-brand-600 px-5 py-2.5 text-[0.84rem] font-semibold text-white">Começar a estudar</Link>
        </section>
      ) : (
        <>
          <section className="grid overflow-hidden rounded-[24px] bg-brand-900 text-white shadow-[0_18px_45px_rgba(8,58,49,.16)] lg:grid-cols-[1.05fr_.95fr]">
            <div className="p-6 sm:p-8">
              <span className="text-[0.72rem] font-bold tracking-[0.14em] text-ouro-200 uppercase">Ritmo da semana</span>
              <h2 className="mt-3 text-[clamp(1.45rem,3vw,2.1rem)] font-extrabold tracking-[-0.04em]">
                {metricas.roadmap.pendentes === 0 && metricas.planejado.blocos > 0
                  ? "O combinado coube na semana."
                  : aderencia >= 75
                    ? "O ritmo foi bom; falta fechar as pontas."
                    : "O plano e a rotina se afastaram."}
              </h2>
              <p className="mt-3 max-w-[58ch] text-[0.9rem] leading-relaxed text-white/68">
                {metricas.roadmap.concluidos} de {metricas.planejado.blocos} blocos concluídos · {horas(metricas.executado.minutos)} de foco medido.
              </p>
              <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/15"><span className="block h-full rounded-full bg-ouro-400" style={{ width: `${aderenciaVisual}%` }} /></div>
              <div className="mt-2 flex justify-between text-[0.72rem] text-white/50"><span>{aderencia}% do tempo planejado</span><span>{horas(planejadoMinutos)} previstos</span></div>
            </div>
            <div className="grid grid-cols-2 border-t border-white/10 bg-white/[0.04] lg:border-t-0 lg:border-l">
              {[
                [String(metricas.roadmap.concluidos), "blocos concluídos"],
                [String(metricas.roadmap.pendentes), "blocos pendentes"],
                [String(metricas.questoes.respondidas), "questões respondidas"],
                [metricas.questoes.taxa === null ? "—" : `${metricas.questoes.taxa}%`, "taxa de acerto"],
              ].map(([valor, rotulo]) => (
                <div key={rotulo} className="flex flex-col justify-center border-r border-b border-white/10 p-5 last:border-b-0 sm:p-6">
                  <strong className="text-[1.65rem] tracking-[-0.04em] text-white">{valor}</strong>
                  <span className="mt-1 text-[0.72rem] text-white/50">{rotulo}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-3">
            {[
              [String(metricas.executado.sessoes), "sessões de foco", "tempo efetivamente registrado"],
              [String(metricas.materiaisLidos), "materiais lidos", "marcados nas sessões guiadas"],
              [String(metricas.revisoesVencidas), "revisões acumuladas", "estado atual da fila até esta semana"],
            ].map(([valor, rotulo, detalhe]) => (
              <div key={rotulo} className="superficie p-5"><strong className="text-[1.35rem] text-brand-700">{valor}</strong><h3 className="mt-1 text-[0.84rem] font-bold text-ink">{rotulo}</h3><p className="mt-0.5 text-[0.7rem] text-muted">{detalhe}</p></div>
            ))}
          </section>

          {metricas.disciplinas.length > 0 && (
            <section className="superficie overflow-hidden">
              <div className="border-b border-line bg-paper px-5 py-4 sm:px-6"><span className="rotulo">Distribuição real</span><h2 className="mt-1 text-[1.2rem] font-bold text-ink">Onde o tempo entrou — e onde não entrou</h2></div>
              <div className="divide-y divide-line">
                {metricas.disciplinas.map((disciplina) => {
                  const previsto = Math.round(disciplina.horasPlanejadas * 60);
                  const negligenciada = previsto > 0 && disciplina.minutosFoco === 0 && disciplina.pendentes > 0;
                  return (
                    <div key={disciplina.nome} className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(160px,.8fr)_1.2fr_auto] sm:items-center sm:px-6">
                      <div><strong className="text-[0.86rem] text-ink">{disciplina.nome}</strong><span className={`mt-0.5 block text-[0.7rem] ${negligenciada ? "font-semibold text-vinho-600" : "text-muted"}`}>{negligenciada ? "sem foco registrado" : `${disciplina.concluidos} concluídos · ${disciplina.pendentes} pendentes`}</span></div>
                      <div className="flex flex-col gap-1.5"><span className="h-1.5 overflow-hidden rounded-full bg-sunk"><span className="block h-full rounded-full bg-brand-400" style={{ width: `${Math.min(100, (disciplina.minutosFoco / maiorCarga) * 100)}%` }} /></span><span className="h-1.5 overflow-hidden rounded-full bg-sunk"><span className="block h-full rounded-full bg-ouro-400/70" style={{ width: `${Math.min(100, (previsto / maiorCarga) * 100)}%` }} /></span></div>
                      <div className="text-right text-[0.72rem] tabular-nums"><strong className="block text-brand-700">{horas(disciplina.minutosFoco)} reais</strong><span className="text-muted">{horas(previsto)} previstos</span></div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section>
            <div className="mb-4"><span className="rotulo">Próxima semana</span><h2 className="mt-1 text-[1.25rem] font-bold text-ink">Ajustes sugeridos pelos seus dados</h2><p className="mt-1 text-[0.82rem] text-muted">Marque apenas o que você realmente pretende fazer. Cada sugestão mostra o dado que a originou.</p></div>
            <div className="grid gap-3 lg:grid-cols-2">
              {sugestoes.map((sugestao) => (
                <article key={sugestao.id} className="superficie flex gap-4 p-5">
                  <input type="checkbox" checked={acoes.includes(sugestao.id)} onChange={() => alternarAcao(sugestao.id)} aria-label={`Selecionar: ${sugestao.titulo}`} className="mt-1 h-4 w-4 shrink-0 accent-brand-600" />
                  <div className="min-w-0 flex-1"><span className={`inline-flex rounded-full border px-2 py-0.5 text-[0.64rem] font-bold uppercase ${prioridadeClasse(sugestao.prioridade)}`}>{sugestao.prioridade === "positiva" ? "funcionou" : sugestao.prioridade}</span><h3 className="mt-2 text-[0.95rem] font-bold text-ink">{sugestao.titulo}</h3><p className="mt-1 text-[0.78rem] leading-relaxed text-body">{sugestao.detalhe}</p><Link href={sugestao.href} className="mt-3 inline-block text-[0.76rem] font-semibold text-brand-700 underline decoration-brand-200 underline-offset-4">{sugestao.rotuloDoLink} →</Link></div>
                </article>
              ))}
            </div>
          </section>

          {metricas.registros.some((registro) => registro.resumo || registro.pendencias) && (
            <section>
              <div className="mb-4"><span className="rotulo">Memória das sessões</span><h2 className="mt-1 text-[1.25rem] font-bold text-ink">O que você aprendeu e o que ficou aberto</h2></div>
              <div className="grid gap-3 lg:grid-cols-2">
                {metricas.registros.filter((registro) => registro.resumo || registro.pendencias).map((registro) => (
                  <article key={registro.id} className="superficie p-5"><div className="flex items-baseline justify-between gap-3"><h3 className="text-[0.9rem] font-bold text-ink">{registro.disciplina}</h3><span className="text-[0.7rem] text-muted">{registro.minutos} min</span></div>{registro.resumo && <div className="mt-3"><span className="text-[0.66rem] font-bold tracking-[0.1em] text-brand-700 uppercase">Ficou claro</span><p className="mt-1 text-[0.8rem] leading-relaxed text-body">{registro.resumo}</p></div>}{registro.pendencias && <div className="mt-3 rounded-[11px] bg-ouro-50 p-3"><span className="text-[0.66rem] font-bold tracking-[0.1em] text-ouro-700 uppercase">Volta depois</span><p className="mt-1 text-[0.8rem] leading-relaxed text-ouro-700">{registro.pendencias}</p></div>}</article>
                ))}
              </div>
            </section>
          )}

          <section className="superficie p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><span className="rotulo">Fechar a semana</span><h2 className="mt-1 text-[1.25rem] font-bold text-ink">Registre uma decisão, não uma nota</h2></div>{salva && <span className="rounded-full bg-brand-50 px-3 py-1.5 text-[0.72rem] font-semibold text-brand-700">Fechamento salvo</span>}</div>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-[0.76rem] font-semibold text-muted">O que explica esta semana?<textarea value={reflexao} onChange={(evento) => { setReflexao(evento.target.value); setSalva(false); }} maxLength={4000} rows={5} placeholder="O que ajudou, o que atrapalhou e o que você percebeu…" className="rounded-[12px] border border-hairline px-3.5 py-3 text-[0.86rem] font-normal text-ink outline-none focus:border-brand-300" /></label>
              <label className="flex flex-col gap-1.5 text-[0.76rem] font-semibold text-muted">Compromisso concreto para a próxima semana<textarea value={compromisso} onChange={(evento) => { setCompromisso(evento.target.value); setSalva(false); }} maxLength={1000} rows={5} placeholder="Ex.: terça e quinta, às 19h, começo pelas revisões…" className="rounded-[12px] border border-hairline px-3.5 py-3 text-[0.86rem] font-normal text-ink outline-none focus:border-brand-300" /></label>
            </div>
            {erro && <p role="alert" className="mt-4 rounded-[11px] bg-vinho-50 px-4 py-3 text-[0.8rem] text-vinho-700">{erro}</p>}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="max-w-[62ch] text-[0.72rem] text-muted">Os números são recalculados no banco ao salvar; o navegador envia somente seu texto e as ações escolhidas.</p><button type="button" onClick={() => void salvar()} disabled={salvando} className="rounded-full bg-brand-600 px-5 py-2.5 text-[0.84rem] font-semibold text-white disabled:opacity-50">{salvando ? "Salvando…" : salva ? "Atualizar fechamento" : "Fechar esta semana"}</button></div>
          </section>
        </>
      )}
    </div>
  );
}
