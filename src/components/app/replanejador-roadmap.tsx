"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type {
  DiagnosticoDoReplanejamento,
  PropostaDeReplanejamento,
} from "@/lib/replanejamento";

type Resumo = PropostaDeReplanejamento["resumo"];

function formatarData(data: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${data}T00:00:00Z`));
}

export function ReplanejadorRoadmap({
  diagnostico,
  versao,
}: {
  diagnostico: DiagnosticoDoReplanejamento;
  versao: number;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [horas, setHoras] = useState(diagnostico.horasPorSemana);
  const [proposta, setProposta] = useState<Resumo | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function requisitar(acao: "simular" | "aplicar") {
    if (carregando || aplicando) return;
    if (acao === "aplicar") setAplicando(true);
    else setCarregando(true);
    setErro(null);
    try {
      const resposta = await fetch("/api/roadmap/replanejar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao, versao, horasPorSemana: horas }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        setErro(dados.erro ?? "Não consegui replanejar o roadmap.");
        return;
      }
      setProposta(dados.proposta as Resumo);
      if (acao === "aplicar") {
        router.replace("/app/roadmap");
        router.refresh();
      }
    } catch {
      setErro("Sem conexão com o servidor. Tente novamente.");
    } finally {
      setCarregando(false);
      setAplicando(false);
    }
  }

  function abrirSimulacao() {
    setAberto(true);
    if (!proposta) void requisitar("simular");
  }

  const focoEmHoras = Math.round((diagnostico.minutosDeFocoRegistrados / 60) * 10) / 10;

  if (!aberto) {
    if (diagnostico.pendentes === 0) {
      return (
        <section className="flex items-center gap-3 rounded-[18px] border border-brand-200 bg-brand-50 px-5 py-4 sm:px-6">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white" aria-hidden="true">✓</span>
          <div>
            <h2 className="text-[0.95rem] font-bold text-ink">Roadmap concluído</h2>
            <p className="mt-0.5 text-[0.82rem] text-body">Não há blocos pendentes para redistribuir.</p>
          </div>
        </section>
      );
    }
    return (
      <section
        className={`flex flex-wrap items-center justify-between gap-4 rounded-[18px] border px-5 py-4 sm:px-6 ${
          diagnostico.sugerido
            ? "border-ouro-200 bg-ouro-50"
            : "border-line bg-surface"
        }`}
      >
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[1rem] ${
              diagnostico.sugerido
                ? "bg-ouro-200 text-noite"
                : "bg-brand-50 text-brand-700"
            }`}
            aria-hidden="true"
          >
            ↻
          </span>
          <div>
            <h2 className="text-[0.95rem] font-bold text-ink">
              {diagnostico.sugerido
                ? "Seu roadmap precisa de um ajuste"
                : "Sua rotina mudou?"}
            </h2>
            <p className="mt-0.5 max-w-[72ch] text-[0.82rem] leading-relaxed text-body">
              {diagnostico.atrasados > 0
                ? `${diagnostico.atrasados} ${diagnostico.atrasados === 1 ? "bloco ficou" : "blocos ficaram"} para trás. Veja uma redistribuição antes de decidir.`
                : "Simule outra disponibilidade semanal sem alterar o plano atual."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={abrirSimulacao}
          className={`rounded-full px-4 py-2.5 text-[0.82rem] font-semibold ${
            diagnostico.sugerido
              ? "bg-noite text-white hover:bg-ink"
              : "border border-hairline bg-paper text-ink hover:border-brand-300"
          }`}
        >
          {diagnostico.sugerido ? "Replanejar agora" : "Simular ajuste"}
        </button>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-[20px] border border-brand-200 bg-surface shadow-[var(--shadow-baixa)]">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line bg-brand-50 px-5 py-4 sm:px-6">
        <div>
          <span className="rotulo">Replanejamento automático</span>
          <h2 className="mt-1 text-[1.15rem] font-extrabold text-ink">
            Reorganize o que falta, sem apagar o que já aconteceu
          </h2>
          <p className="mt-1 max-w-[70ch] text-[0.82rem] leading-relaxed text-body">
            A versão atual, os estados e as anotações ficam preservados. Nada muda até sua confirmação.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="rounded-full px-3 py-1.5 text-[0.8rem] font-semibold text-muted hover:bg-surface hover:text-ink"
        >
          Fechar
        </button>
      </div>

      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-[12px] bg-paper p-3">
              <strong className="block text-[1.1rem] text-vinho-700">{diagnostico.atrasados}</strong>
              <span className="text-[0.72rem] text-muted">blocos atrasados</span>
            </div>
            <div className="rounded-[12px] bg-paper p-3">
              <strong className="block text-[1.1rem] text-brand-700">{diagnostico.concluidos}</strong>
              <span className="text-[0.72rem] text-muted">já concluídos</span>
            </div>
            <div className="rounded-[12px] bg-paper p-3">
              <strong className="block text-[1.1rem] text-ink">{diagnostico.horasPendentes}h</strong>
              <span className="text-[0.72rem] text-muted">a redistribuir</span>
            </div>
            <div className="rounded-[12px] bg-paper p-3">
              <strong className="block text-[1.1rem] text-ink">{focoEmHoras}h</strong>
              <span className="text-[0.72rem] text-muted">foco registrado</span>
            </div>
          </div>

          <label className="flex flex-col gap-1.5 text-[0.78rem] font-semibold text-body">
            Nova disponibilidade semanal
            <span className="flex h-11 items-center rounded-[11px] border border-hairline bg-surface px-3 focus-within:border-brand-300">
              <input
                type="number"
                min={1}
                max={60}
                step={0.5}
                value={horas}
                onChange={(evento) => {
                  setHoras(Number(evento.target.value));
                  setProposta(null);
                }}
                className="h-full min-w-0 flex-1 bg-transparent text-[0.9rem] font-normal text-ink outline-none"
              />
              <span className="text-[0.76rem] font-normal text-muted">horas</span>
            </span>
          </label>
          <button
            type="button"
            onClick={() => void requisitar("simular")}
            disabled={carregando || aplicando}
            className="rounded-full border border-brand-200 bg-brand-50 px-4 py-2.5 text-[0.82rem] font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-50"
          >
            {carregando ? "Calculando…" : "Atualizar simulação"}
          </button>
          <p className="text-[0.7rem] leading-relaxed text-muted">
            O foco considera somente sessões registradas no cronômetro desde a criação deste plano.
          </p>
        </div>

        <div className="min-w-0">
          {erro && (
            <p role="alert" className="rounded-[12px] bg-vinho-50 px-4 py-3 text-[0.82rem] text-vinho-700">
              {erro}
            </p>
          )}
          {!proposta && !erro && (
            <div className="flex min-h-52 items-center justify-center rounded-[14px] border border-dashed border-hairline bg-paper px-5 text-center text-[0.82rem] text-muted">
              {carregando ? "Redistribuindo os blocos…" : "Atualize a simulação para ver a nova sequência."}
            </div>
          )}
          {proposta && (
            <div className="flex flex-col gap-4">
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-[12px] border border-line p-3">
                  <span className="text-[0.7rem] text-muted">Nova duração</span>
                  <strong className="mt-0.5 block text-[1rem] text-ink">
                    {proposta.semanasNecessarias} {proposta.semanasNecessarias === 1 ? "semana" : "semanas"}
                  </strong>
                </div>
                <div className="rounded-[12px] border border-line p-3">
                  <span className="text-[0.7rem] text-muted">Conclusão prevista</span>
                  <strong className="mt-0.5 block text-[1rem] text-ink">
                    {formatarData(proposta.conclusaoPrevista)}
                  </strong>
                </div>
                <div className="rounded-[12px] border border-line p-3">
                  <span className="text-[0.7rem] text-muted">Progresso preservado</span>
                  <strong className="mt-0.5 block text-[1rem] text-brand-700">
                    {proposta.blocosPreservados} {proposta.blocosPreservados === 1 ? "bloco" : "blocos"}
                  </strong>
                </div>
              </div>

              {proposta.avisos.map((aviso) => (
                <p key={aviso} className="rounded-[11px] bg-ouro-50 px-3.5 py-2.5 text-[0.78rem] leading-relaxed text-ouro-700">
                  {aviso}
                </p>
              ))}

              <div>
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-[0.88rem] font-bold text-ink">Nova distribuição</h3>
                  <span className="text-[0.72rem] text-muted">{proposta.horasPorSemana}h/semana</span>
                </div>
                <ol className="rolagem-fina mt-2 max-h-60 divide-y divide-line overflow-y-auto rounded-[12px] border border-line">
                  {proposta.semanas.map((semana) => (
                    <li key={semana.numero} className="flex items-start justify-between gap-4 px-3.5 py-3">
                      <div className="min-w-0">
                        <strong className="block text-[0.78rem] text-brand-700">Semana {semana.numero}</strong>
                        <span className="mt-0.5 block truncate text-[0.76rem] text-muted">
                          {semana.disciplinas.join(" · ")}
                        </span>
                      </div>
                      <span className="shrink-0 text-right text-[0.74rem] text-body">
                        {semana.horas}h · {semana.blocos} {semana.blocos === 1 ? "bloco" : "blocos"}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                <p className="max-w-[48ch] text-[0.72rem] leading-relaxed text-muted">
                  Ao confirmar, esta será uma nova versão. A anterior continua guardada com todas as anotações.
                </p>
                <button
                  type="button"
                  onClick={() => void requisitar("aplicar")}
                  disabled={aplicando || carregando}
                  className="rounded-full bg-brand-600 px-5 py-2.5 text-[0.84rem] font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {aplicando ? "Criando nova versão…" : "Confirmar replanejamento"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
