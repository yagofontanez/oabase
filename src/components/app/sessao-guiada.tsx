"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Resolvedor, type QuestaoDaFila } from "@/components/app/resolvedor";
import {
  MemoriaDoCaderno,
  TextoLegalDestacado,
} from "@/components/texto-legal-destacado";
import type { DestaqueLeiSeca } from "@/lib/caderno-lei-seca";
import type {
  FaseDaSessao,
  ModoDaSessao,
  ResultadoDaSessao,
  SessaoEmAndamento,
} from "@/lib/sessao-estudo";

export type MaterialDaSessao = {
  id: string;
  rotulo: string;
  caput: string;
  comentario: string[];
  nota: string;
  destaques: DestaqueLeiSeca[];
};

type Bloco = {
  id: string;
  semana: number;
  disciplina: string;
  objetivo: string;
  horas: number;
  anotacao: string;
};

type EstadoDoRelogio = {
  modo: ModoDaSessao;
  fase: FaseDaSessao;
  restante: number;
  segundosFoco: number;
  rodando: boolean;
  ciclos: number;
};

const FOCO_POMODORO = 25 * 60;
const PAUSA_POMODORO = 5 * 60;

function mmss(segundos: number) {
  const minutos = Math.floor(Math.max(0, segundos) / 60);
  const resto = Math.max(0, segundos) % 60;
  return `${String(minutos).padStart(2, "0")}:${String(resto).padStart(2, "0")}`;
}

function minutosLegiveis(segundos: number) {
  const minutos = Math.round(segundos / 60);
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto ? `${horas}h ${resto}min` : `${horas}h`;
}

async function chamar(corpo: Record<string, unknown>) {
  const resposta = await fetch("/api/sessao-estudo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
  const dados = await resposta.json();
  if (!resposta.ok) throw new Error(dados.erro ?? "Não consegui atualizar a sessão.");
  return dados;
}

export function SessaoGuiada({
  bloco,
  materiais,
  questoes,
  minutosIniciais,
  sessaoInicial,
  outraSessaoItemId,
}: {
  bloco: Bloco;
  materiais: MaterialDaSessao[];
  questoes: QuestaoDaFila[];
  minutosIniciais: number;
  sessaoInicial: SessaoEmAndamento | null;
  outraSessaoItemId: string | null;
}) {
  const minutosPlanejados = sessaoInicial?.minutosPlanejados ?? minutosIniciais;
  const [sessaoId, setSessaoId] = useState(sessaoInicial?.id ?? null);
  const [relogio, setRelogio] = useState<EstadoDoRelogio>(() => {
    const modo = sessaoInicial?.modo ?? "pomodoro";
    const segundosFoco = sessaoInicial?.segundosFoco ?? 0;
    return {
      modo,
      fase: "foco",
      restante:
        modo === "continuo"
          ? Math.max(0, minutosPlanejados * 60 - segundosFoco)
          : FOCO_POMODORO,
      segundosFoco,
      rodando: false,
      ciclos: Math.floor(segundosFoco / FOCO_POMODORO),
    };
  });
  const [materiaisLidos, setMateriaisLidos] = useState<string[]>(
    sessaoInicial?.materiaisLidos ?? [],
  );
  const [checklist, setChecklist] = useState<Record<string, boolean>>(
    sessaoInicial?.checklist ?? {},
  );
  const [anotacao, setAnotacao] = useState(
    sessaoInicial?.anotacao || bloco.anotacao || "",
  );
  const [respondidasAoVivo, setRespondidasAoVivo] = useState(0);
  const [acertosAoVivo, setAcertosAoVivo] = useState(0);
  const [fechamento, setFechamento] = useState(false);
  const [resumo, setResumo] = useState("");
  const [pendencias, setPendencias] = useState("");
  const [concluirBloco, setConcluirBloco] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoDaSessao | null>(null);
  const ultimoTique = useRef(0);
  const instantaneo = useRef<Record<string, unknown>>({});

  const idsMateriais = useMemo(
    () => (materiais.length ? materiais.map((material) => material.id) : ["material-externo"]),
    [materiais],
  );
  const progressoTempo = Math.min(
    100,
    Math.round((relogio.segundosFoco / (minutosPlanejados * 60)) * 100),
  );
  const itensFeitos =
    Number(Boolean(checklist.objetivo)) +
    materiaisLidos.length +
    Number(questoes.length > 0 && respondidasAoVivo > 0) +
    Number(anotacao.trim().length > 0);
  const totalChecklist = 2 + idsMateriais.length + Number(questoes.length > 0);

  useEffect(() => {
    if (!relogio.rodando) return;
    ultimoTique.current = Date.now();
    const intervalo = window.setInterval(() => {
      const agora = Date.now();
      const passados = Math.floor((agora - ultimoTique.current) / 1000);
      if (passados <= 0) return;
      ultimoTique.current += passados * 1000;
      setRelogio((atual) => {
        if (!atual.rodando) return atual;
        const consumidos = Math.min(passados, atual.restante);
        const segundosFoco =
          atual.fase === "foco"
            ? atual.segundosFoco + consumidos
            : atual.segundosFoco;
        const restante = Math.max(0, atual.restante - passados);
        if (restante > 0) return { ...atual, restante, segundosFoco };
        if (atual.modo === "continuo") {
          return { ...atual, restante: 0, segundosFoco, rodando: false };
        }
        return atual.fase === "foco"
          ? {
              ...atual,
              fase: "pausa",
              restante: PAUSA_POMODORO,
              segundosFoco,
              rodando: false,
              ciclos: atual.ciclos + 1,
            }
          : {
              ...atual,
              fase: "foco",
              restante: FOCO_POMODORO,
              segundosFoco,
              rodando: false,
            };
      });
    }, 250);
    return () => window.clearInterval(intervalo);
  }, [relogio.rodando]);

  useEffect(() => {
    document.title = relogio.rodando
      ? `${mmss(relogio.restante)} · ${relogio.fase === "foco" ? "Foco" : "Pausa"}`
      : "Sessão de estudo — OABase";
    return () => {
      document.title = "Sessão de estudo — OABase";
    };
  }, [relogio.fase, relogio.restante, relogio.rodando]);

  useEffect(() => {
    instantaneo.current = {
      acao: "salvar",
      sessaoId,
    segundos: relogio.segundosFoco,
    modo: relogio.modo,
    questoes: questoes.map((questao) => questao.id),
      materiaisLidos,
      checklist,
      anotacao,
    };
  }, [anotacao, checklist, materiaisLidos, questoes, relogio.modo, relogio.segundosFoco, sessaoId]);

  useEffect(() => {
    if (!sessaoId) return;
    const salvar = () => {
      void fetch("/api/sessao-estudo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(instantaneo.current),
        keepalive: true,
      });
    };
    const intervalo = window.setInterval(salvar, 30_000);
    window.addEventListener("pagehide", salvar);
    return () => {
      window.clearInterval(intervalo);
      window.removeEventListener("pagehide", salvar);
    };
  }, [sessaoId]);

  async function iniciar() {
    if (outraSessaoItemId || ocupado) return;
    setErro(null);
    if (!sessaoId) {
      setOcupado(true);
      try {
        const dados = await chamar({
          acao: "iniciar",
          itemId: bloco.id,
          minutos: minutosPlanejados,
          modo: relogio.modo,
          questoes: questoes.map((questao) => questao.id),
          materiais: idsMateriais,
        });
        setSessaoId(dados.sessaoId);
      } catch (falha) {
        setErro(falha instanceof Error ? falha.message : "Não consegui iniciar a sessão.");
        setOcupado(false);
        return;
      }
      setOcupado(false);
    }
    ultimoTique.current = Date.now();
    setRelogio((atual) => ({ ...atual, rodando: true }));
  }

  function pausar() {
    setRelogio((atual) => ({ ...atual, rodando: false }));
  }

  function trocarModo(modo: ModoDaSessao) {
    if (relogio.rodando || modo === relogio.modo) return;
    setRelogio((atual) => ({
      ...atual,
      modo,
      fase: "foco",
      restante:
        modo === "continuo"
          ? Math.max(0, minutosPlanejados * 60 - atual.segundosFoco)
          : FOCO_POMODORO,
    }));
  }

  function pularFase() {
    if (relogio.modo !== "pomodoro") return;
    setRelogio((atual) =>
      atual.fase === "foco"
        ? {
            ...atual,
            fase: "pausa",
            restante: PAUSA_POMODORO,
            rodando: false,
          }
        : {
            ...atual,
            fase: "foco",
            restante: FOCO_POMODORO,
            rodando: false,
          },
    );
  }

  async function encerrar() {
    if (!sessaoId || ocupado) return;
    pausar();
    setOcupado(true);
    setErro(null);
    try {
      const dados = await chamar({
        acao: "encerrar",
        sessaoId,
        segundos: relogio.segundosFoco,
        modo: relogio.modo,
        questoes: questoes.map((questao) => questao.id),
        materiaisLidos,
        checklist,
        anotacao,
        resumo,
        pendencias,
        concluirBloco,
      });
      if (!dados.resultado) throw new Error("O fechamento não retornou o resumo.");
      setResultado(dados.resultado as ResultadoDaSessao);
      setFechamento(false);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não consegui encerrar a sessão.");
    } finally {
      setOcupado(false);
    }
  }

  if (resultado) {
    const taxa = resultado.questoesRespondidas
      ? Math.round((resultado.acertos / resultado.questoesRespondidas) * 100)
      : null;
    return (
      <div className="painel-conteudo flex max-w-[980px] flex-col gap-6">
        <section className="relative overflow-hidden rounded-[26px] bg-brand-900 p-7 text-white sm:p-10">
          <div aria-hidden="true" className="absolute -top-24 -right-16 h-64 w-64 rounded-full bg-ouro-400/20 blur-2xl" />
          <div className="relative">
            <span className="text-[0.75rem] font-bold tracking-[0.15em] text-ouro-200 uppercase">Sessão registrada</span>
            <h1 className="mt-3 text-[clamp(1.8rem,4vw,2.7rem)] font-extrabold tracking-[-0.045em]">Você encerrou com um próximo passo claro.</h1>
            <p className="mt-3 max-w-[62ch] text-white/72">O tempo e as respostas vieram dos registros reais desta sessão. Sua síntese e suas pendências ficaram ligadas ao bloco.</p>
          </div>
        </section>
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [minutosLegiveis(resultado.segundosFoco), "de foco"],
            [String(resultado.materiaisLidos), "materiais lidos"],
            [String(resultado.questoesRespondidas), "questões respondidas"],
            [taxa === null ? "—" : `${taxa}%`, "de acerto"],
          ].map(([valor, rotulo]) => (
            <div key={rotulo} className="superficie p-5">
              <strong className="block text-[1.45rem] text-brand-700">{valor}</strong>
              <span className="text-[0.78rem] text-muted">{rotulo}</span>
            </div>
          ))}
        </section>
        <div className="flex flex-wrap gap-3">
          <Link href="/app/hoje" className="rounded-full bg-brand-600 px-5 py-2.5 text-[0.88rem] font-semibold text-white">Voltar para hoje</Link>
          <Link href={`/app/roadmap?item=${bloco.id}`} className="rounded-full border border-hairline px-5 py-2.5 text-[0.88rem] font-semibold text-ink">Abrir o bloco</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="painel-conteudo flex max-w-[1380px] flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div>
          <span className="rotulo">Semana {bloco.semana} · execução guiada</span>
          <h1 className="mt-1 text-[clamp(1.7rem,3vw,2.4rem)] leading-none font-extrabold tracking-[-0.045em] text-ink">{bloco.disciplina}</h1>
          <p className="mt-2 max-w-[72ch] text-[0.92rem] leading-relaxed text-body">{bloco.objetivo}</p>
        </div>
        <Link href={`/app/roadmap?item=${bloco.id}`} className="rounded-full border border-hairline bg-surface px-4 py-2 text-[0.82rem] font-semibold text-ink">Sair para o roadmap</Link>
      </header>

      {outraSessaoItemId && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-[15px] border border-ouro-200 bg-ouro-50 p-4">
          <p className="text-[0.86rem] text-ouro-700">Há outra sessão em andamento. Continue ou encerre aquela sessão antes de começar esta.</p>
          <Link href={`/app/sessao/${outraSessaoItemId}`} className="rounded-full bg-noite px-4 py-2 text-[0.78rem] font-semibold text-white">Continuar sessão aberta</Link>
        </div>
      )}
      {erro && <p role="alert" className="rounded-[12px] bg-vinho-50 px-4 py-3 text-[0.84rem] text-vinho-700">{erro}</p>}

      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="flex h-fit flex-col gap-4 xl:sticky xl:top-5">
          <section className="overflow-hidden rounded-[22px] bg-brand-900 text-white shadow-[0_18px_42px_rgba(8,58,49,.18)]">
            <div className="border-b border-white/10 px-5 py-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[0.72rem] font-bold tracking-[0.12em] text-brand-200 uppercase">{relogio.fase === "foco" ? "Tempo de foco" : "Pausa"}</span>
                <span className="text-[0.72rem] text-white/55">{progressoTempo}% da meta</span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/15"><span className="block h-full rounded-full bg-ouro-400" style={{ width: `${progressoTempo}%` }} /></div>
            </div>
            <div className="flex flex-col items-center p-6">
              <span className="text-[3.7rem] leading-none font-extrabold tracking-[-0.06em] tabular-nums">{mmss(relogio.restante)}</span>
              <span className="mt-2 text-[0.78rem] text-brand-100">{minutosLegiveis(relogio.segundosFoco)} registrados nesta sessão</span>
              <div className="mt-5 flex w-full gap-2">
                <button type="button" onClick={relogio.rodando ? pausar : () => void iniciar()} disabled={ocupado || Boolean(outraSessaoItemId) || (relogio.modo === "continuo" && relogio.restante === 0)} className="flex-1 rounded-full bg-ouro-400 py-2.5 text-[0.88rem] font-bold text-noite disabled:opacity-50">
                  {ocupado ? "Preparando…" : relogio.rodando ? "Pausar" : sessaoId ? "Continuar" : "Começar"}
                </button>
                {relogio.modo === "pomodoro" && <button type="button" onClick={pularFase} className="rounded-full border border-white/20 px-4 text-[0.8rem] font-semibold">Pular</button>}
              </div>
              <div className="mt-4 flex rounded-full bg-white/10 p-1">
                {(["pomodoro", "continuo"] as ModoDaSessao[]).map((modo) => (
                  <button key={modo} type="button" onClick={() => trocarModo(modo)} disabled={relogio.rodando} className={`rounded-full px-3 py-1.5 text-[0.72rem] font-semibold ${relogio.modo === modo ? "bg-white text-brand-900" : "text-white/65"}`}>{modo === "pomodoro" ? "Pomodoro 25/5" : `Contínuo ${minutosPlanejados} min`}</button>
                ))}
              </div>
            </div>
          </section>

          <section className="superficie p-5">
            <div className="flex items-baseline justify-between gap-3"><span className="rotulo">Checklist da sessão</span><strong className="text-[0.8rem] text-brand-700">{itensFeitos}/{totalChecklist}</strong></div>
            <label className="mt-4 flex items-start gap-3 text-[0.82rem] leading-snug text-body"><input type="checkbox" checked={Boolean(checklist.objetivo)} onChange={(evento) => setChecklist((atual) => ({ ...atual, objetivo: evento.target.checked }))} className="mt-0.5 h-4 w-4 accent-brand-600" />Trabalhei o objetivo do bloco</label>
            <div className="mt-3 flex flex-col gap-2">
              {idsMateriais.map((id, indice) => (
                <label key={id} className="flex items-start gap-3 text-[0.82rem] leading-snug text-body"><input type="checkbox" checked={materiaisLidos.includes(id)} onChange={(evento) => setMateriaisLidos((atuais) => evento.target.checked ? [...atuais, id] : atuais.filter((item) => item !== id))} className="mt-0.5 h-4 w-4 accent-brand-600" />{materiais[indice]?.rotulo ?? "Trabalhei o material externo"}</label>
              ))}
              {questoes.length > 0 && <span className={`flex items-start gap-3 text-[0.82rem] ${respondidasAoVivo ? "text-brand-700" : "text-muted"}`}><span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded border border-current text-[0.65rem]">{respondidasAoVivo ? "✓" : ""}</span>Respondi questões ({respondidasAoVivo})</span>}
              <span className={`flex items-start gap-3 text-[0.82rem] ${anotacao.trim() ? "text-brand-700" : "text-muted"}`}><span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded border border-current text-[0.65rem]">{anotacao.trim() ? "✓" : ""}</span>Registrei uma anotação</span>
            </div>
            <button type="button" onClick={() => { pausar(); setFechamento(true); }} disabled={!sessaoId} className="mt-5 w-full rounded-full bg-brand-600 py-2.5 text-[0.84rem] font-semibold text-white disabled:opacity-40">Encerrar e registrar</button>
          </section>
        </aside>

        <main className="flex min-w-0 flex-col gap-5">
          <section className="superficie p-5 sm:p-6">
            <span className="rotulo">1 · Material indicado</span>
            <h2 className="mt-1 text-[1.25rem] font-bold text-ink">Leia sem sair da sessão</h2>
            {materiais.length ? (
              <div className="mt-4 flex flex-col divide-y divide-line">
                {materiais.map((material) => (
                  <article key={material.id} className="py-5 first:pt-0">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="font-bold text-brand-700">{material.rotulo}</h3>
                      <label className="flex items-center gap-2 text-[0.76rem] font-semibold text-muted"><input type="checkbox" checked={materiaisLidos.includes(material.id)} onChange={(evento) => setMateriaisLidos((atuais) => evento.target.checked ? [...atuais, material.id] : atuais.filter((item) => item !== material.id))} className="h-4 w-4 accent-brand-600" />Marcar como lido</label>
                    </div>
                    <p className="lei-texto mt-3 whitespace-pre-line text-[0.97rem]"><TextoLegalDestacado texto={material.caput} destaques={material.destaques} /></p>
                    <MemoriaDoCaderno destaques={material.destaques} nota={material.nota} />
                    {material.comentario.length > 0 && <div className="comentario mt-4 text-[0.88rem] text-body">{material.comentario.map((paragrafo, indice) => <p key={indice}>{paragrafo}</p>)}</div>}
                    <Link href={material.id} target="_blank" className="mt-3 inline-block text-[0.78rem] font-semibold text-brand-700 underline decoration-brand-200 underline-offset-4">Abrir página completa em outra aba →</Link>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-[14px] bg-paper p-4 text-[0.88rem] leading-relaxed text-body">Este tópico veio do seu material ou da ementa e ainda não tem correspondência no acervo. Use aqui o livro, PDF ou material indicado pelo professor e marque no checklist quando terminar.</div>
            )}
          </section>

          <section className="superficie p-5 sm:p-6">
            <label htmlFor="anotacao-sessao" className="rotulo">2 · Caderno da sessão</label>
            <h2 className="mt-1 text-[1.25rem] font-bold text-ink">Capture a dúvida enquanto ela está fresca</h2>
            <textarea id="anotacao-sessao" value={anotacao} onChange={(evento) => setAnotacao(evento.target.value)} maxLength={4000} rows={6} placeholder="Conceito importante, dúvida, exemplo do professor ou ponto para revisar…" className="mt-4 w-full resize-y rounded-[13px] border border-hairline bg-surface px-4 py-3 text-[0.9rem] leading-relaxed text-ink outline-none focus:border-brand-300" />
            <div className="mt-2 flex justify-between gap-3 text-[0.72rem] text-muted"><span>Salvo automaticamente durante a sessão</span><span>{anotacao.length}/4.000</span></div>
          </section>

          <section id="questoes-da-sessao" className="flex flex-col gap-4 scroll-mt-5">
            <div><span className="rotulo">3 · Prática dirigida</span><h2 className="mt-1 text-[1.25rem] font-bold text-ink">Teste o que acabou de estudar</h2><p className="mt-1 text-[0.84rem] text-muted">As respostas são registradas normalmente; o fechamento contará apenas as questões realmente respondidas aqui.</p></div>
            {questoes.length ? (
              <Resolvedor
                fila={questoes}
                onResponder={({ acertou }) => {
                  setRespondidasAoVivo((valor) => valor + 1);
                  if (acertou) setAcertosAoVivo((valor) => valor + 1);
                }}
                rodapeConcluido={
                  <button type="button" onClick={() => { pausar(); setFechamento(true); }} className="rounded-full bg-brand-600 px-5 py-2.5 text-[0.88rem] font-semibold text-white">Fechar esta sessão</button>
                }
              />
            ) : (
              <div className="superficie p-6 text-[0.9rem] text-muted">Não há questões novas desta matéria disponíveis agora. A leitura, o tempo e suas anotações continuam sendo registrados.</div>
            )}
          </section>
        </main>
      </div>

      {fechamento && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-noite/55 p-3 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="titulo-fechamento">
          <section className="max-h-[92vh] w-full max-w-[680px] overflow-y-auto rounded-[22px] bg-surface p-5 shadow-2xl sm:p-7">
            <span className="rotulo">Fechamento da sessão</span>
            <h2 id="titulo-fechamento" className="mt-1 text-[1.45rem] font-extrabold text-ink">Transforme o estudo em próximo passo</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[[minutosLegiveis(relogio.segundosFoco), "de foco"], [String(materiaisLidos.length), "leituras"], [`${respondidasAoVivo}/${questoes.length}`, `${acertosAoVivo} acertos`]].map(([valor, rotulo]) => <div key={rotulo} className="rounded-[12px] bg-paper p-3"><strong className="block text-[1rem] text-brand-700">{valor}</strong><span className="text-[0.7rem] text-muted">{rotulo}</span></div>)}
            </div>
            <label className="mt-5 flex flex-col gap-1.5 text-[0.78rem] font-semibold text-muted">O que ficou claro?<textarea value={resumo} onChange={(evento) => setResumo(evento.target.value)} maxLength={4000} rows={4} placeholder="Escreva com suas palavras o principal aprendizado…" className="rounded-[12px] border border-hairline px-3.5 py-3 text-[0.88rem] font-normal text-ink outline-none focus:border-brand-300" /></label>
            <label className="mt-4 flex flex-col gap-1.5 text-[0.78rem] font-semibold text-muted">O que ficou pendente?<textarea value={pendencias} onChange={(evento) => setPendencias(evento.target.value)} maxLength={4000} rows={3} placeholder="Dúvida, leitura ou exercício que deve voltar depois…" className="rounded-[12px] border border-hairline px-3.5 py-3 text-[0.88rem] font-normal text-ink outline-none focus:border-brand-300" /></label>
            <label className="mt-4 flex items-start gap-3 rounded-[13px] border border-brand-200 bg-brand-50 p-4 text-[0.84rem] font-semibold text-brand-800"><input type="checkbox" checked={concluirBloco} onChange={(evento) => setConcluirBloco(evento.target.checked)} className="mt-0.5 h-4 w-4 accent-brand-600" /><span>Concluir este bloco no roadmap<small className="mt-1 block font-normal text-brand-700">Desmarcado, ele continua “em andamento” com todo o registro preservado.</small></span></label>
            <div className="mt-6 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => setFechamento(false)} disabled={ocupado} className="rounded-full border border-hairline px-5 py-2.5 text-[0.84rem] font-semibold text-muted">Continuar estudando</button><button type="button" onClick={() => void encerrar()} disabled={ocupado} className="rounded-full bg-brand-600 px-5 py-2.5 text-[0.84rem] font-semibold text-white disabled:opacity-50">{ocupado ? "Registrando…" : "Encerrar sessão"}</button></div>
          </section>
        </div>
      )}
    </div>
  );
}
