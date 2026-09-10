"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  adicionarDias,
  dataUtc,
  diaIndisponivel,
  fimDoMes,
  fimDaSemana,
  hojeEmBrasilia,
  inicioDaSemana,
  inicioDoMes,
  intervaloDeDatas,
  type ItemDoCalendario,
  type PreferenciasDoCalendario,
} from "@/lib/calendario";

type Visualizacao = "semana" | "mes";

const DIAS = [
  { valor: 1, curto: "Seg", longo: "Segunda" },
  { valor: 2, curto: "Ter", longo: "Terça" },
  { valor: 3, curto: "Qua", longo: "Quarta" },
  { valor: 4, curto: "Qui", longo: "Quinta" },
  { valor: 5, curto: "Sex", longo: "Sexta" },
  { valor: 6, curto: "Sáb", longo: "Sábado" },
  { valor: 0, curto: "Dom", longo: "Domingo" },
];

function formatarDia(data: string, opcoes?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    ...opcoes,
  }).format(dataUtc(data));
}

function moverMes(data: string, quantidade: number) {
  const [ano, mes] = data.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1 + quantidade, 1))
    .toISOString()
    .slice(0, 10);
}

function classesDoEstado(item: ItemDoCalendario) {
  if (item.estado === "concluido") return "border-brand-200 bg-brand-50 text-brand-800";
  if (item.estado === "em_andamento") return "border-ouro-200 bg-ouro-50 text-ouro-700";
  return "border-line bg-surface text-ink";
}

function EditorDoItem({
  item,
  horarioPadrao,
  salvando,
  onSalvar,
  onRemover,
}: {
  item: ItemDoCalendario;
  horarioPadrao: string;
  salvando: boolean;
  onSalvar: (data: string, horario: string) => void;
  onRemover: () => void;
}) {
  const [data, setData] = useState(item.dataPlanejada ?? hojeEmBrasilia());
  const [horario, setHorario] = useState(item.horarioPlanejado ?? horarioPadrao);
  return (
    <aside className="superficie h-fit p-5 xl:sticky xl:top-6">
      <span className="rotulo">Bloco selecionado</span>
      <h2 className="mt-2 text-[1.05rem] font-bold text-ink">{item.disciplina}</h2>
      <p className="mt-1 text-[0.82rem] leading-relaxed text-body">{item.objetivo}</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-[0.72rem] font-semibold text-muted">
          Data
          <input type="date" value={data} onChange={(evento) => setData(evento.target.value)} className="h-10 min-w-0 rounded-[10px] border border-hairline px-2.5 text-[0.82rem] font-normal text-ink outline-none focus:border-brand-300" />
        </label>
        <label className="flex flex-col gap-1 text-[0.72rem] font-semibold text-muted">
          Horário
          <input type="time" value={horario} onChange={(evento) => setHorario(evento.target.value)} className="h-10 min-w-0 rounded-[10px] border border-hairline px-2.5 text-[0.82rem] font-normal text-ink outline-none focus:border-brand-300" />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => onSalvar(data, horario)} disabled={salvando || !data || !horario} className="rounded-full bg-brand-600 px-4 py-2 text-[0.8rem] font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
          {salvando ? "Salvando…" : "Salvar data"}
        </button>
        {item.dataPlanejada && (
          <button type="button" onClick={onRemover} disabled={salvando} className="rounded-full border border-hairline px-4 py-2 text-[0.8rem] font-semibold text-muted hover:text-ink disabled:opacity-50">
            Deixar sem data
          </button>
        )}
      </div>
      <Link href={`/app/roadmap?item=${item.id}`} className="mt-4 block text-[0.78rem] font-semibold text-brand-700 underline decoration-brand-200 underline-offset-4">
        Abrir materiais e questões →
      </Link>
      {item.estado !== "concluido" && (
        <Link href={`/app/sessao/${item.id}`} className="mt-2 inline-flex rounded-full bg-ouro-400 px-4 py-2 text-[0.78rem] font-bold text-noite">
          Iniciar sessão guiada
        </Link>
      )}
    </aside>
  );
}

export function CalendarioEstudos({
  itensIniciais,
  preferenciasIniciais,
}: {
  itensIniciais: ItemDoCalendario[];
  preferenciasIniciais: PreferenciasDoCalendario;
}) {
  const hoje = useMemo(() => hojeEmBrasilia(), []);
  const [itens, setItens] = useState(itensIniciais);
  const [preferencias, setPreferencias] = useState(preferenciasIniciais);
  const [rascunho, setRascunho] = useState(preferenciasIniciais);
  const [visualizacao, setVisualizacao] = useState<Visualizacao>("semana");
  const [cursor, setCursor] = useState(hoje);
  const [configurando, setConfigurando] = useState(false);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [novaExcecao, setNovaExcecao] = useState("");

  const selecionado = itens.find((item) => item.id === selecionadoId) ?? null;
  const inicio =
    visualizacao === "semana"
      ? inicioDaSemana(cursor)
      : inicioDaSemana(inicioDoMes(cursor));
  const fim =
    visualizacao === "semana"
      ? fimDaSemana(cursor)
      : fimDaSemana(fimDoMes(cursor));
  const datas = intervaloDeDatas(inicio, fim);
  const semData = itens.filter(
    (item) => item.estado !== "concluido" && !item.dataPlanejada,
  );
  const vencidos = itens.filter(
    (item) =>
      item.estado !== "concluido" &&
      item.dataPlanejada &&
      item.dataPlanejada < hoje,
  );
  const agendados = itens.filter((item) => item.dataPlanejada).length;

  async function chamar(corpo: Record<string, unknown>) {
    const resposta = await fetch("/api/calendario", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.erro ?? "Não consegui atualizar o calendário.");
    return dados;
  }

  async function mover(itemId: string, data: string | null, horario?: string) {
    if (ocupado) return;
    setOcupado(itemId);
    setErro(null);
    setMensagem(null);
    try {
      const dados = await chamar({
        acao: "mover",
        itemId,
        data,
        horario: horario ?? preferencias.horarioPreferido,
      });
      setItens((atuais) =>
        atuais.map((item) =>
          item.id === itemId
            ? {
                ...item,
                dataPlanejada: dados.data,
                horarioPlanejado: dados.horario,
              }
            : item,
        ),
      );
      setMensagem(data ? "Bloco movido." : "Bloco retirado do calendário.");
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não consegui mover o bloco.");
    } finally {
      setOcupado(null);
    }
  }

  async function distribuir(acao: "distribuir" | "reagendar") {
    if (ocupado) return;
    if (
      acao === "distribuir" &&
      agendados > 0 &&
      !window.confirm("Redistribuir todos os blocos pendentes substituirá as datas escolhidas manualmente. Continuar?")
    ) return;
    setOcupado(acao);
    setErro(null);
    setMensagem(null);
    try {
      const dados = await chamar({ acao });
      const porId = new Map<
        string,
        { dataPlanejada: string; horarioPlanejado: string }
      >(
        (dados.atualizacoes ?? []).map(
          (item: { id: string; dataPlanejada: string; horarioPlanejado: string }) => [
            item.id,
            item,
          ],
        ),
      );
      setItens((atuais) =>
        atuais.map((item) => {
          const atualizacao = porId.get(item.id);
          return atualizacao ? { ...item, ...atualizacao } : item;
        }),
      );
      setCursor(hoje);
      setMensagem(
        dados.mensagem ??
          (acao === "reagendar"
            ? "Pendências reagendadas a partir de hoje."
            : "Roadmap distribuído no calendário."),
      );
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não consegui distribuir o calendário.");
    } finally {
      setOcupado(null);
    }
  }

  async function salvarPreferencias() {
    if (ocupado) return;
    setOcupado("preferencias");
    setErro(null);
    setMensagem(null);
    try {
      const dados = await chamar({ acao: "preferencias", ...rascunho });
      setPreferencias(dados.preferencias as PreferenciasDoCalendario);
      setRascunho(dados.preferencias as PreferenciasDoCalendario);
      setConfigurando(false);
      setMensagem("Disponibilidade salva.");
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não consegui salvar as preferências.");
    } finally {
      setOcupado(null);
    }
  }

  function navegar(direcao: -1 | 1) {
    setCursor((atual) =>
      visualizacao === "semana"
        ? adicionarDias(atual, direcao * 7)
        : moverMes(atual, direcao),
    );
  }

  const tituloPeriodo =
    visualizacao === "mes"
      ? formatarDia(cursor, { month: "long", year: "numeric" })
      : `${formatarDia(inicio, { day: "2-digit", month: "short" })} — ${formatarDia(fim, { day: "2-digit", month: "short", year: "numeric" })}`;

  return (
    <div className="painel-conteudo flex max-w-[1440px] flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div>
          <span className="rotulo">Agenda de execução</span>
          <h1 className="mt-1 text-[clamp(1.8rem,3vw,2.4rem)] leading-none font-extrabold tracking-[-0.045em] text-ink">
            Calendário de estudos
          </h1>
          <p className="mt-2 max-w-[62ch] text-[0.9rem] text-body">
            O mesmo roadmap, agora em dias reais. Arraste no computador ou selecione um bloco para mudar a data no celular.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setConfigurando((valor) => !valor)} className="rounded-full border border-hairline bg-surface px-4 py-2.5 text-[0.8rem] font-semibold text-ink hover:border-brand-300">
            Disponibilidade
          </button>
          <a href="/api/calendario/ics" className="rounded-full border border-hairline bg-surface px-4 py-2.5 text-[0.8rem] font-semibold text-ink hover:border-brand-300">
            Exportar Google/Apple (.ics)
          </a>
          <button type="button" onClick={() => void distribuir("distribuir")} disabled={Boolean(ocupado)} className="rounded-full bg-brand-600 px-4 py-2.5 text-[0.8rem] font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
            {ocupado === "distribuir" ? "Distribuindo…" : agendados ? "Redistribuir automaticamente" : "Montar calendário"}
          </button>
        </div>
      </header>

      {(vencidos.length > 0 || semData.length > 0) && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-ouro-200 bg-ouro-50 px-4 py-3.5 sm:px-5">
          <div>
            <strong className="text-[0.86rem] text-ink">
              {vencidos.length > 0
                ? `${vencidos.length} ${vencidos.length === 1 ? "atividade está atrasada" : "atividades estão atrasadas"}`
                : `${semData.length} ${semData.length === 1 ? "atividade ainda está sem data" : "atividades ainda estão sem data"}`}
            </strong>
            <p className="mt-0.5 text-[0.76rem] text-ouro-700">O reagendamento mantém estado, semana, conteúdo e anotações.</p>
          </div>
          <button type="button" onClick={() => void distribuir("reagendar")} disabled={Boolean(ocupado)} className="rounded-full bg-noite px-4 py-2 text-[0.78rem] font-semibold text-white disabled:opacity-50">
            {ocupado === "reagendar" ? "Reagendando…" : "Reagendar pendências"}
          </button>
        </section>
      )}

      {configurando && (
        <section className="superficie grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_220px_1fr_auto] lg:items-end">
          <div>
            <span className="rotulo">Dias em que você não estuda</span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {DIAS.map((dia) => {
                const marcado = rascunho.diasIndisponiveis.includes(dia.valor);
                return (
                  <button key={dia.valor} type="button" aria-pressed={marcado} title={dia.longo} onClick={() => setRascunho((atual) => ({ ...atual, diasIndisponiveis: marcado ? atual.diasIndisponiveis.filter((valor) => valor !== dia.valor) : atual.diasIndisponiveis.length < 6 ? [...atual.diasIndisponiveis, dia.valor] : atual.diasIndisponiveis }))} className={`rounded-full px-3 py-2 text-[0.76rem] font-semibold ${marcado ? "bg-noite text-white" : "bg-paper text-muted hover:text-ink"}`}>
                    {dia.curto}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="flex flex-col gap-1 text-[0.74rem] font-semibold text-muted">
            Horário preferido
            <input type="time" value={rascunho.horarioPreferido} onChange={(evento) => setRascunho((atual) => ({ ...atual, horarioPreferido: evento.target.value }))} className="h-10 rounded-[10px] border border-hairline px-3 text-[0.84rem] font-normal text-ink outline-none focus:border-brand-300" />
          </label>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-[0.8rem] font-semibold text-ink">
              <input type="checkbox" checked={rascunho.lembreteEmail} onChange={(evento) => setRascunho((atual) => ({ ...atual, lembreteEmail: evento.target.checked }))} className="h-4 w-4 accent-brand-600" />
              Lembrete por e-mail no dia
            </label>
            <div className="flex gap-2">
              <input type="date" value={novaExcecao} onChange={(evento) => setNovaExcecao(evento.target.value)} aria-label="Adicionar data indisponível" className="h-9 min-w-0 rounded-[9px] border border-hairline px-2 text-[0.74rem] text-ink" />
              <button type="button" disabled={!novaExcecao} onClick={() => { if (!novaExcecao) return; setRascunho((atual) => ({ ...atual, datasIndisponiveis: [...new Set([...atual.datasIndisponiveis, novaExcecao])].sort() })); setNovaExcecao(""); }} className="rounded-full bg-paper px-3 text-[0.72rem] font-semibold text-brand-700 disabled:opacity-40">Bloquear data</button>
            </div>
          </div>
          <button type="button" onClick={() => void salvarPreferencias()} disabled={Boolean(ocupado)} className="rounded-full bg-brand-600 px-5 py-2.5 text-[0.8rem] font-semibold text-white disabled:opacity-50">
            {ocupado === "preferencias" ? "Salvando…" : "Salvar"}
          </button>
          {rascunho.datasIndisponiveis.length > 0 && (
            <div className="flex flex-wrap gap-1.5 lg:col-span-4">
              {rascunho.datasIndisponiveis.map((data) => (
                <button key={data} type="button" onClick={() => setRascunho((atual) => ({ ...atual, datasIndisponiveis: atual.datasIndisponiveis.filter((item) => item !== data) }))} className="rounded-full bg-vinho-50 px-2.5 py-1 text-[0.7rem] text-vinho-700" title="Remover bloqueio">
                  {formatarDia(data, { day: "2-digit", month: "short" })} ×
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {(erro || mensagem) && (
        <p role={erro ? "alert" : "status"} className={`rounded-[12px] px-4 py-3 text-[0.8rem] ${erro ? "bg-vinho-50 text-vinho-700" : "bg-brand-50 text-brand-700"}`}>
          {erro ?? mensagem}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-full border border-hairline bg-surface p-1">
          {(["semana", "mes"] as Visualizacao[]).map((modo) => (
            <button key={modo} type="button" onClick={() => setVisualizacao(modo)} className={`rounded-full px-3.5 py-1.5 text-[0.76rem] font-semibold capitalize ${visualizacao === modo ? "bg-noite text-white" : "text-muted hover:text-ink"}`}>
              {modo === "mes" ? "Mês" : "Semana"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => navegar(-1)} aria-label="Período anterior" className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-surface text-body hover:text-ink">←</button>
          <button type="button" onClick={() => setCursor(hoje)} className="rounded-full border border-hairline bg-surface px-3 py-2 text-[0.74rem] font-semibold text-body">Hoje</button>
          <button type="button" onClick={() => navegar(1)} aria-label="Próximo período" className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-surface text-body hover:text-ink">→</button>
        </div>
        <h2 className="min-w-[210px] text-right text-[0.95rem] font-bold text-ink capitalize">{tituloPeriodo}</h2>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <main className="min-w-0 overflow-x-auto rounded-[18px] border border-line bg-surface">
          <div className="grid min-w-[760px] grid-cols-7 border-b border-line bg-paper">
            {DIAS.map((dia) => <div key={dia.valor} className="px-2 py-2.5 text-center text-[0.7rem] font-bold tracking-[0.05em] text-muted uppercase">{dia.longo}</div>)}
          </div>
          <div className="grid min-w-[760px] grid-cols-7">
            {datas.map((data) => {
              const doDia = itens.filter((item) => item.dataPlanejada === data);
              const indisponivel = diaIndisponivel(data, preferencias);
              const foraDoMes = visualizacao === "mes" && data.slice(0, 7) !== cursor.slice(0, 7);
              const carga = doDia.filter((item) => item.estado !== "concluido").reduce((total, item) => total + item.horas, 0);
              return (
                <section key={data} onDragOver={(evento) => { if (!indisponivel) evento.preventDefault(); }} onDrop={(evento) => { evento.preventDefault(); if (indisponivel) return; const id = evento.dataTransfer.getData("text/plain"); if (id) void mover(id, data); }} className={`min-h-[150px] border-r border-b border-line p-2 last:border-r-0 ${indisponivel ? "bg-sunk/70" : foraDoMes ? "bg-paper/45" : "bg-surface"}`}>
                  <div className="mb-2 flex items-center justify-between gap-1">
                    <time dateTime={data} className={`flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-[0.72rem] font-bold ${data === hoje ? "bg-brand-600 text-white" : foraDoMes ? "text-muted/60" : "text-body"}`}>{Number(data.slice(-2))}</time>
                    {indisponivel ? <span className="text-[0.62rem] font-semibold text-muted">indisponível</span> : carga > 0 ? <span className="text-[0.62rem] text-muted">{Math.round(carga * 10) / 10}h</span> : null}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {doDia.map((item) => (
                      <button key={item.id} type="button" draggable onDragStart={(evento) => { evento.dataTransfer.effectAllowed = "move"; evento.dataTransfer.setData("text/plain", item.id); }} onClick={() => setSelecionadoId(item.id)} className={`w-full rounded-[9px] border px-2 py-2 text-left shadow-[0_1px_0_rgba(18,35,29,.04)] transition hover:-translate-y-px ${classesDoEstado(item)} ${selecionadoId === item.id ? "ring-2 ring-brand-300" : ""}`}>
                        <span className="block truncate text-[0.68rem] font-bold">{item.disciplina}</span>
                        <span className="mt-0.5 line-clamp-2 text-[0.63rem] leading-snug opacity-75">{item.objetivo}</span>
                        <span className="mt-1 block text-[0.61rem] opacity-65">{item.horarioPlanejado ?? preferencias.horarioPreferido} · {item.horas}h</span>
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </main>

        <div className="flex min-w-0 flex-col gap-4">
          {selecionado ? (
            <EditorDoItem key={`${selecionado.id}-${selecionado.dataPlanejada}-${selecionado.horarioPlanejado}`} item={selecionado} horarioPadrao={preferencias.horarioPreferido} salvando={ocupado === selecionado.id} onSalvar={(data, horario) => void mover(selecionado.id, data, horario)} onRemover={() => void mover(selecionado.id, null)} />
          ) : (
            <aside className="superficie p-5">
              <span className="rotulo">Resumo</span>
              <dl className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-[11px] bg-paper p-3"><dd className="text-[1.05rem] font-extrabold text-brand-700">{agendados}</dd><dt className="text-[0.68rem] text-muted">agendados</dt></div>
                <div className="rounded-[11px] bg-paper p-3"><dd className="text-[1.05rem] font-extrabold text-ouro-700">{vencidos.length}</dd><dt className="text-[0.68rem] text-muted">atrasados</dt></div>
              </dl>
              <p className="mt-3 text-[0.76rem] leading-relaxed text-muted">Selecione uma atividade para editar data e horário.</p>
            </aside>
          )}

          {semData.length > 0 && (
            <aside className="superficie overflow-hidden">
              <div className="border-b border-line px-4 py-3">
                <span className="rotulo">Sem data · {semData.length}</span>
              </div>
              <div className="rolagem-fina flex max-h-80 flex-col gap-1.5 overflow-y-auto p-2">
                {semData.map((item) => (
                  <button key={item.id} type="button" draggable onDragStart={(evento) => evento.dataTransfer.setData("text/plain", item.id)} onClick={() => setSelecionadoId(item.id)} className="rounded-[10px] border border-line bg-paper px-3 py-2.5 text-left hover:border-brand-200">
                    <strong className="block text-[0.75rem] text-ink">{item.disciplina}</strong>
                    <span className="mt-0.5 line-clamp-2 text-[0.68rem] leading-snug text-muted">{item.objetivo}</span>
                  </button>
                ))}
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
