"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type {
  ContextoSalvoDoPlano,
  Mensagem,
  ModoDoPlano,
  Plano,
} from "@/lib/ia/plano";
import {
  type EstadoDoRoadmap,
  type ItemRoadmap,
} from "@/lib/roadmap";
import { supabaseNavegador } from "@/lib/supabase/browser";

export type PortaDeEntrada = { href: string; rotulo: string };

const SUGESTOES = [
  {
    titulo: "Tenho 2 horas por dia",
    texto: "Tenho 2 horas por dia, incluindo fim de semana.",
    icone: "relogio",
  },
  {
    titulo: "Só à noite e no sábado",
    texto: "Trabalho o dia todo, só consigo estudar à noite e no sábado.",
    icone: "lua",
  },
  {
    titulo: "É a segunda tentativa",
    texto: "É minha segunda tentativa. Fui mal em Tributário e Empresarial.",
    icone: "alvo",
  },
  {
    titulo: "Falta pouco tempo",
    texto:
      "Falta pouco tempo e quero concentrar no que mais cai, mesmo deixando matéria de fora.",
    icone: "raio",
  },
] as const;

const CAMINHOS: Record<string, string> = {
  relogio: "M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z",
  lua: "M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z",
  alvo: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  raio: "M13 3L5 14h5l-1 7 8-11h-5z",
};

const CHAVE_LARGURA = "oabase:plano-largura";
const LARGURA_PADRAO = 46;
const LARGURA_MINIMA = 26;
const LARGURA_MAXIMA = 64;

function limitar(valor: number) {
  return Math.min(LARGURA_MAXIMA, Math.max(LARGURA_MINIMA, valor));
}

/* A largura guardada é lida por `useSyncExternalStore`, e não por um efeito
   que chama `setState`: o servidor não conhece `localStorage`, então ele
   entrega o padrão e o cliente entrega o valor salvo — sem divergência de
   hidratação e sem uma renderização em cascata na montagem.
   O valor nunca muda por conta própria, então a inscrição é vazia. */
function assinarNada() {
  return () => {};
}
function lerLarguraSalva() {
  try {
    return window.localStorage.getItem(CHAVE_LARGURA) ?? "";
  } catch {
    return "";
  }
}
function larguraNoServidor() {
  return "";
}

function horas(h: number) {
  if (h % 1 === 0) return `${h}h`;
  return `${Math.floor(h)}h${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;
}

/** Marca da superfície de IA. Nunca aparece em texto de lei ou do acervo. */
function Gema({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="oab-gema" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--color-brand-600)" />
          <stop offset="55%" stopColor="var(--color-brand-400)" />
          <stop offset="100%" stopColor="var(--color-ouro-500)" />
        </linearGradient>
      </defs>
      <path
        fill="url(#oab-gema)"
        d="M12 1.6c.5 3.9 1.6 6.4 3.4 8.1 1.7 1.6 4.2 2.6 7 2.3-3.9.5-6.4 1.6-8.1 3.4-1.6 1.7-2.6 4.2-2.3 7-.5-3.9-1.6-6.4-3.4-8.1-1.7-1.6-4.2-2.6-7-2.3 3.9-.5 6.4-1.6 8.1-3.4C11.3 6.9 12.3 4.4 12 1.6z"
      />
    </svg>
  );
}

function Icone({ nome }: { nome: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
      aria-hidden="true"
    >
      <path d={CAMINHOS[nome]} />
    </svg>
  );
}

/**
 * Plano de estudos em conversa.
 *
 * Duas superfícies, não duas colunas de formulário: à esquerda a conversa,
 * à direita o plano que ela produz. A separação é o que deixa claro quem
 * escreveu o quê — a máquina fala na conversa, e o cronograma resultante é
 * um documento, com semanas, horas e links que saem do acervo.
 *
 * Em telas estreitas as duas viram abas, porque empilhar um chat com rolagem
 * própria embaixo de um documento com rolagem própria não funciona no
 * polegar de ninguém.
 */
export function PlanoConversa({
  planoInicial,
  conversaInicial,
  roadmapInicial,
  contextoInicial,
  disciplinasDisponiveis,
  portas,
  nome,
  diasRestantes,
  edicao,
}: {
  planoInicial: Plano | null;
  conversaInicial: Mensagem[];
  roadmapInicial: ItemRoadmap[];
  contextoInicial: ContextoSalvoDoPlano;
  disciplinasDisponiveis: string[];
  portas: Record<string, PortaDeEntrada>;
  nome: string;
  diasRestantes: number;
  edicao: number;
}) {
  const [plano, setPlano] = useState<Plano | null>(planoInicial);
  const [conversa, setConversa] = useState<Mensagem[]>(conversaInicial);
  const [roadmap, setRoadmap] = useState<ItemRoadmap[]>(roadmapInicial);
  const [modo, setModo] = useState<ModoDoPlano>(contextoInicial.modo);
  const [selecionadas, setSelecionadas] = useState<string[]>(
    contextoInicial.disciplinas,
  );
  const [prazoLivre, setPrazoLivre] = useState(contextoInicial.prazo ?? "");
  const [criandoRoadmap, setCriandoRoadmap] = useState(false);
  const [itemAtualizando, setItemAtualizando] = useState<string | null>(null);
  const [filtroRoadmap, setFiltroRoadmap] = useState<
    "todos" | EstadoDoRoadmap
  >("todos");
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<"conversa" | "plano">(
    planoInicial ? "plano" : "conversa",
  );
  const [confirmandoLimpeza, setConfirmandoLimpeza] = useState(false);
  const [limpando, setLimpando] = useState(false);

  /* Largura do painel do cronograma, em % da área útil. Preferência de quem
     usa — quem lê o plano num monitor largo quer mais documento; quem está
     conversando quer mais conversa. Fica em `localStorage`, e a leitura
     acontece depois da montagem para não divergir na hidratação. */
  const larguraSalva = useSyncExternalStore(
    assinarNada,
    lerLarguraSalva,
    larguraNoServidor,
  );
  const [larguraEscolhida, setLargura] = useState<number | null>(null);
  const largura =
    larguraEscolhida ??
    (Number(larguraSalva) > 0 ? limitar(Number(larguraSalva)) : LARGURA_PADRAO);

  const [arrastando, setArrastando] = useState(false);
  const area = useRef<HTMLDivElement>(null);

  const rolagem = useRef<HTMLDivElement>(null);
  const caixa = useRef<HTMLTextAreaElement>(null);

  function gravarLargura(valor: number) {
    try {
      window.localStorage.setItem(CHAVE_LARGURA, String(Math.round(valor)));
    } catch {
      // Preferência não persiste, mas a sessão atual funciona.
    }
  }

  function aoPressionarDivisor(evento: React.PointerEvent<HTMLDivElement>) {
    evento.currentTarget.setPointerCapture(evento.pointerId);
    setArrastando(true);
  }

  function aoMoverDivisor(evento: React.PointerEvent<HTMLDivElement>) {
    if (!arrastando) return;
    const retangulo = area.current?.getBoundingClientRect();
    if (!retangulo) return;
    // A largura é medida da borda direita para dentro: é o painel do
    // cronograma que está sendo redimensionado, não a conversa.
    setLargura(
      limitar(((retangulo.right - evento.clientX) / retangulo.width) * 100),
    );
  }

  function aoSoltarDivisor(evento: React.PointerEvent<HTMLDivElement>) {
    if (!arrastando) return;
    setArrastando(false);
    gravarLargura(largura);
    try {
      evento.currentTarget.releasePointerCapture(evento.pointerId);
    } catch {
      /* ponteiro já liberado */
    }
  }

  /** Teclado: separador sem seta é separador que exclui quem não usa mouse. */
  function aoTeclarNoDivisor(evento: React.KeyboardEvent<HTMLDivElement>) {
    const passo =
      evento.key === "ArrowLeft" ? 2 : evento.key === "ArrowRight" ? -2 : 0;
    if (passo === 0) return;
    evento.preventDefault();
    const proxima = limitar(largura + passo);
    setLargura(proxima);
    gravarLargura(proxima);
  }

  // A conversa cresce por baixo: sem isto, a resposta nova nasce fora da tela.
  useEffect(() => {
    const alvo = rolagem.current;
    if (alvo) alvo.scrollTo({ top: alvo.scrollHeight, behavior: "smooth" });
  }, [conversa.length, enviando]);

  function ajustarAltura() {
    const el = caixa.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 190)}px`;
  }

  async function enviar(mensagem: string) {
    const limpo = mensagem.trim();
    if (!limpo || enviando) return;
    if (modo === "livre" && selecionadas.length === 0) {
      setErro("Escolha ao menos uma matéria para montar o plano livre.");
      return;
    }

    setErro(null);
    setEnviando(true);
    setTexto("");
    setAba("conversa");
    setConversa((c) => [...c, { papel: "pessoa", texto: limpo }]);
    requestAnimationFrame(ajustarAltura);

    try {
      const resposta = await fetch("/api/plano", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mensagem: limpo,
          modo,
          disciplinas: selecionadas,
          prazo: prazoLivre,
        }),
      });
      const dados = await resposta.json();

      if (!resposta.ok) {
        setErro(dados.erro ?? "Não consegui montar o plano agora.");
        // Devolve o texto para a caixa: perder o que a pessoa escreveu por
        // causa de uma falha de rede é inaceitável.
        setTexto(limpo);
        setConversa((c) => c.slice(0, -1));
        return;
      }

      setPlano(dados.plano as Plano);
      setConversa(dados.conversa as Mensagem[]);
      setRoadmap((dados.roadmap as ItemRoadmap[]) ?? []);
    } catch {
      setErro("Sem conexão com o servidor. Tente de novo.");
      setTexto(limpo);
      setConversa((c) => c.slice(0, -1));
    } finally {
      setEnviando(false);
      requestAnimationFrame(ajustarAltura);
    }
  }

  /**
   * Apaga plano e conversa.
   *
   * Confirmação em dois toques em vez de `confirm()`: o histórico some junto,
   * e é ele que faz o próximo cronograma nascer melhor que o primeiro.
   */
  async function limpar() {
    if (limpando) return;
    setLimpando(true);
    setErro(null);
    try {
      const resposta = await fetch("/api/plano", { method: "DELETE" });
      if (!resposta.ok) {
        const dados = await resposta.json().catch(() => ({}));
        setErro(dados.erro ?? "Não consegui apagar o plano agora.");
        return;
      }
      setPlano(null);
      setConversa([]);
      setRoadmap([]);
      setAba("conversa");
      setConfirmandoLimpeza(false);
    } catch {
      setErro("Sem conexão com o servidor. Tente de novo.");
    } finally {
      setLimpando(false);
    }
  }

  const vazia = conversa.length === 0;
  const totalDeHoras = plano
    ? plano.semanas.reduce(
        (s, semana) => s + semana.blocos.reduce((t, b) => t + b.horas, 0),
        0,
      )
    : 0;
  const concluidos = roadmap.filter((item) => item.estado === "concluido").length;
  const proximoItem = roadmap.find((item) => item.estado !== "concluido");
  const emAndamento = roadmap.filter(
    (item) => item.estado === "em_andamento",
  ).length;
  const horasConcluidas = roadmap
    .filter((item) => item.estado === "concluido")
    .reduce((total, item) => total + item.horas, 0);
  const semanaAtual = proximoItem?.semana ?? roadmap.at(-1)?.semana;
  const progressoPorDisciplina = [...roadmap
    .reduce((mapa, item) => {
      const atual = mapa.get(item.disciplina) ?? { total: 0, concluidos: 0 };
      atual.total += 1;
      if (item.estado === "concluido") atual.concluidos += 1;
      mapa.set(item.disciplina, atual);
      return mapa;
    }, new Map<string, { total: number; concluidos: number }>())]
    .sort(([, a], [, b]) => a.concluidos / a.total - b.concluidos / b.total)
    .slice(0, 6);

  async function criarRoadmap() {
    if (criandoRoadmap) return;
    setCriandoRoadmap(true);
    setErro(null);
    try {
      const resposta = await fetch("/api/roadmap", { method: "POST" });
      const dados = await resposta.json();
      if (!resposta.ok) {
        setErro(dados.erro ?? "Não consegui criar o roadmap agora.");
        return;
      }
      setRoadmap((dados.roadmap as ItemRoadmap[]) ?? []);
    } catch {
      setErro("Sem conexão com o servidor. Tente de novo.");
    } finally {
      setCriandoRoadmap(false);
    }
  }

  async function mudarEstado(item: ItemRoadmap, estado: EstadoDoRoadmap) {
    if (item.estado === estado || itemAtualizando) return;
    const anterior = roadmap;
    const agora = new Date().toISOString();
    setItemAtualizando(item.id);
    setRoadmap((itens) =>
      itens.map((outro) =>
        outro.id === item.id ? { ...outro, estado } : outro,
      ),
    );
    const alteracao =
      estado === "concluido"
        ? { estado, concluido_em: agora, iniciado_em: agora }
        : estado === "em_andamento"
          ? { estado, iniciado_em: agora, concluido_em: null }
          : { estado, iniciado_em: null, concluido_em: null };
    const { error } = await supabaseNavegador()
      .from("roadmap_itens")
      .update(alteracao)
      .eq("id", item.id);
    if (error) {
      setRoadmap(anterior);
      setErro("Não consegui atualizar este bloco. Tente de novo.");
    }
    setItemAtualizando(null);
  }

  /* ---------------- Conversa ---------------- */

  const colunaConversa = (
    <div
      className={`flex min-h-0 flex-1 flex-col ${
        aba === "conversa" ? "flex" : "hidden xl:flex"
      }`}
    >
      <div ref={rolagem} className="rolagem-fina min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[720px] flex-col gap-7 px-5 py-8 sm:px-8">
          {vazia ? (
            <div className="flex flex-col gap-8 pt-6 sm:pt-14">
              <div className="flex flex-col gap-2">
                {/* `w-fit`: com `background-clip: text` num bloco de largura
                    cheia, o gradiente se estica pela caixa e o texto curto
                    só mostra o primeiro terço dele. */}
                <h1 className="texto-aurora w-fit text-[clamp(2rem,4.2vw,2.9rem)] leading-[1.05] font-extrabold tracking-[-0.04em]">
                  Olá, {nome}
                </h1>
                <p className="max-w-[50ch] text-[1.05rem] text-body">
                  {modo === "oab" ? (
                    <>
                      Diga quanto tempo você tem por dia e o que já sabe sobre si.
                      Saio com um cronograma até o {edicao}º Exame — faltam{" "}
                      <strong className="font-semibold text-ink">
                        {diasRestantes} {diasRestantes === 1 ? "dia" : "dias"}
                      </strong>
                      .
                    </>
                  ) : (
                    "Escolha as matérias que quer estudar e diga quanto tempo você tem. O plano organiza sua rotina, sem presumir que você está se preparando para a OAB."
                  )}
                </p>
              </div>

              <div className="flex w-fit rounded-full bg-sunk p-1">
                {(
                  [
                    ["oab", "Preparar para a OAB"],
                    ["livre", "Estudo livre de Direito"],
                  ] as const
                ).map(([chave, rotulo]) => (
                  <button
                    key={chave}
                    type="button"
                    disabled={enviando}
                    onClick={() => setModo(chave)}
                    aria-pressed={modo === chave}
                    className={`rounded-full px-4 py-2 text-[0.86rem] font-semibold transition-colors disabled:opacity-50 ${
                      modo === chave
                        ? "bg-surface text-ink shadow-[var(--shadow-baixa)]"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    {rotulo}
                  </button>
                ))}
              </div>

              {modo === "oab" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {SUGESTOES.map((s) => (
                    <button
                      key={s.titulo}
                      type="button"
                      disabled={enviando}
                      onClick={() => enviar(s.texto)}
                      className="superficie group flex flex-col gap-3 p-4 text-left transition-colors hover:border-brand-200 disabled:opacity-50"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-100">
                        <Icone nome={s.icone} />
                      </span>
                      <span className="text-[0.94rem] font-semibold text-ink">
                        {s.titulo}
                      </span>
                      <span className="text-[0.86rem] leading-snug text-muted">
                        {s.texto}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="superficie flex flex-col gap-4 p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <h2 className="font-bold text-ink">Quais matérias entram no roteiro?</h2>
                      <p className="mt-0.5 text-[0.86rem] text-muted">
                        Selecione só o que você quer estudar agora.
                      </p>
                    </div>
                    <span className="text-[0.82rem] font-semibold text-brand-700">
                      {selecionadas.length} selecionada{selecionadas.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {disciplinasDisponiveis.map((disciplina) => {
                      const marcada = selecionadas.includes(disciplina);
                      return (
                        <label
                          key={disciplina}
                          className={`flex cursor-pointer items-center gap-2.5 rounded-[10px] border px-3 py-2 text-[0.86rem] transition-colors ${marcada ? "border-brand-300 bg-brand-50 text-brand-800" : "border-line text-body hover:border-brand-200"}`}
                        >
                          <input
                            type="checkbox"
                            checked={marcada}
                            onChange={() =>
                              setSelecionadas((atuais) =>
                                marcada
                                  ? atuais.filter((nome) => nome !== disciplina)
                                  : [...atuais, disciplina],
                              )
                            }
                            className="h-4 w-4 accent-[var(--color-brand-600)]"
                          />
                          {disciplina}
                        </label>
                      );
                    })}
                  </div>
                  <label className="flex max-w-xs flex-col gap-1 text-[0.84rem] font-semibold text-body">
                    Data da prova ou avaliação <span className="font-normal text-muted">(opcional)</span>
                    <input
                      type="date"
                      value={prazoLivre}
                      onChange={(evento) => setPrazoLivre(evento.target.value)}
                      className="rounded-[10px] border border-hairline bg-surface px-3 py-2 text-[0.9rem] font-normal text-ink"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={enviando || selecionadas.length === 0}
                    onClick={() => enviar("Quero montar meu plano de estudo livre com as matérias selecionadas.")}
                    className="self-start rounded-full bg-brand-600 px-4 py-2.5 text-[0.88rem] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
                  >
                    Montar plano livre
                  </button>
                </div>
              )}
            </div>
          ) : (
            conversa.map((m, i) =>
              m.papel === "pessoa" ? (
                <div key={i} className="flex justify-end">
                  <p className="max-w-[85%] rounded-[20px] rounded-br-[7px] bg-sunk px-4 py-3 text-[0.98rem] text-ink">
                    {m.texto}
                  </p>
                </div>
              ) : (
                <div key={i} className="flex gap-3.5">
                  <Gema className="mt-0.5 h-6 w-6 shrink-0" />
                  <div className="flex min-w-0 flex-col gap-3">
                    <p className="text-[1rem] leading-relaxed text-body">
                      {m.texto}
                    </p>
                    {/* O cartão do plano só acompanha a última resposta: ele
                        aponta para o documento atual, não para versões que já
                        foram substituídas. */}
                    {plano && i === conversa.length - 1 && (
                      <div className="superficie flex flex-wrap items-center justify-between gap-3 p-4">
                        <span className="flex flex-col">
                          <span className="text-[0.94rem] font-semibold text-ink">
                            Cronograma de {plano.semanas.length}{" "}
                            {plano.semanas.length === 1 ? "semana" : "semanas"}
                          </span>
                          <span className="text-[0.86rem] text-muted">
                            {horas(plano.horasPorSemana)} por semana ·{" "}
                            {horas(totalDeHoras)} no total
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setAba("plano")}
                          className="rounded-full border border-hairline px-4 py-2 text-[0.88rem] font-semibold text-ink transition-colors hover:border-brand-300 hover:text-brand-700 xl:hidden"
                        >
                          Abrir plano
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ),
            )
          )}

          {enviando && (
            <div className="flex gap-3.5">
              <Gema className="mt-0.5 h-6 w-6 shrink-0" />
              <span className="flex items-center gap-2">
                <span className="oab-shimmer text-[1rem] font-medium">
                  {plano ? "Reorganizando o cronograma" : "Montando seu cronograma"}
                </span>
                <span className="flex gap-1" aria-hidden="true">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="oab-ponto h-1.5 w-1.5 rounded-full bg-brand-400"
                      style={{ animationDelay: `${i * 0.16}s` }}
                    />
                  ))}
                </span>
              </span>
            </div>
          )}

          {erro && (
            <p
              role="alert"
              className="rounded-[14px] bg-vinho-50 px-4 py-3 text-[0.92rem] text-vinho-700"
            >
              {erro}
            </p>
          )}
        </div>
      </div>

      {/* ---- Caixa de envio ---- */}
      <div className="shrink-0 bg-gradient-to-t from-paper via-paper to-transparent pb-5">
        <div className="mx-auto w-full max-w-[720px] px-5 sm:px-8">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void enviar(texto);
            }}
            className="superficie flex items-end gap-2 rounded-[24px] p-2 pl-4 focus-within:border-brand-300 focus-within:shadow-[var(--shadow-media)]"
          >
            <textarea
              ref={caixa}
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value);
                ajustarAltura();
              }}
              onKeyDown={(e) => {
                // Enter envia porque isto é uma conversa, não um formulário.
                // Quebra de linha continua acessível no Shift.
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void enviar(texto);
                }
              }}
              rows={1}
              placeholder={
                plano
                  ? "Peça um ajuste: menos horas, trocar a ordem, focar numa disciplina…"
                  : "Ex.: só tenho 1 hora por dia durante a semana"
              }
              className="max-h-[190px] min-h-[42px] w-full resize-none bg-transparent py-2.5 text-[1rem] text-ink outline-none placeholder:text-muted"
            />
            <button
              type="submit"
              disabled={enviando || texto.trim().length === 0}
              title="Enviar"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:bg-sunk disabled:text-muted"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-[18px] w-[18px]"
                aria-hidden="true"
              >
                <path d="M12 19V5M6 11l6-6 6 6" />
              </svg>
              <span className="sr-only">Enviar</span>
            </button>
          </form>

          <p className="mt-2.5 px-1 text-center text-[0.79rem] text-muted">
            Enter envia · Shift+Enter quebra linha. O plano organiza o seu tempo
            e não ensina matéria — todo conteúdo jurídico do OABase vem do
            acervo, não do modelo.
          </p>
        </div>
      </div>
    </div>
  );

  /* ---------------- O documento ---------------- */

  const colunaPlano = (
    <aside
      className={`min-h-0 flex-col border-line bg-surface xl:flex xl:w-[var(--largura-plano)] xl:flex-none ${
        aba === "plano" ? "flex flex-1" : "hidden"
      }`}
    >
      {plano ? (
        <>
          <div className="nao-imprimir flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
            <div className="flex flex-col">
              <span className="rotulo">Seu roadmap</span>
              <span className="text-[1.05rem] font-bold text-ink">
                {plano.semanas.length}{" "}
                {plano.semanas.length === 1 ? "semana" : "semanas"} ·{" "}
                {horas(plano.horasPorSemana)} por semana
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-3 py-1.5 text-[0.84rem] font-semibold ${
                  enviando
                    ? "bg-ouro-50 text-ouro-700"
                    : "bg-brand-50 text-brand-700"
                }`}
              >
                {enviando ? "atualizando…" : `${horas(totalDeHoras)} no total`}
              </span>

              <button
                type="button"
                onClick={() => window.print()}
                title="Abre a impressão do navegador; escolha Salvar como PDF"
                className="rounded-full border border-hairline px-3 py-1.5 text-[0.84rem] font-semibold text-ink transition-colors hover:border-brand-300 hover:text-brand-700"
              >
                Exportar PDF
              </button>

              {confirmandoLimpeza ? (
                <span className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={limpar}
                    disabled={limpando}
                    className="rounded-full bg-vinho-500 px-3 py-1.5 text-[0.84rem] font-semibold text-white transition-colors hover:bg-vinho-600 disabled:opacity-60"
                  >
                    {limpando ? "Apagando…" : "Apagar tudo"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmandoLimpeza(false)}
                    disabled={limpando}
                    className="rounded-full px-2.5 py-1.5 text-[0.84rem] font-medium text-muted transition-colors hover:text-ink"
                  >
                    Cancelar
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmandoLimpeza(true)}
                  disabled={enviando}
                  title="Apagar o plano e a conversa"
                  className="rounded-full p-2 text-muted transition-colors hover:bg-vinho-50 hover:text-vinho-600 disabled:opacity-40"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-[17px] w-[17px]"
                    aria-hidden="true"
                  >
                    <path d="M4 7h16M9.5 7V5h5v2M6.5 7l.8 12.1A1.5 1.5 0 0 0 8.8 20.5h6.4a1.5 1.5 0 0 0 1.5-1.4L17.5 7M10.5 11v5.5M13.5 11v5.5" />
                  </svg>
                  <span className="sr-only">Limpar plano</span>
                </button>
              )}
            </div>
          </div>

          {confirmandoLimpeza && (
            <p className="shrink-0 border-b border-line bg-vinho-50 px-6 py-3 text-[0.88rem] text-vinho-700">
              Isto apaga o cronograma <strong>e</strong> o histórico da
              conversa. O próximo plano começa de uma folha em branco.
            </p>
          )}

          <div
            id="roadmap-document"
            className="roadmap-impressao flex min-h-0 flex-1 flex-col"
          >
            <div className={`rolagem-fina min-h-0 flex-1 overflow-y-auto px-6 py-6 transition-opacity ${
              enviando ? "opacity-45" : ""
            }`}>
            {roadmap.length === 0 ? (
              <div className="mb-6 rounded-[18px] border border-brand-100 bg-brand-50 p-5">
                <span className="rotulo text-brand-700">Transforme em ação</span>
                <p className="mt-1 text-[1rem] font-bold text-ink">
                  Seu cronograma já tem direção. Agora dê estado a cada bloco.
                </p>
                <p className="mt-1.5 max-w-[54ch] text-[0.9rem] leading-relaxed text-body">
                  Marque o que ainda vai estudar, o que está em andamento e o
                  que foi concluído. Ao ajustar o plano, o roteiro novo começa
                  limpo sem apagar o histórico anterior.
                </p>
                <button
                  type="button"
                  onClick={criarRoadmap}
                  disabled={criandoRoadmap || enviando}
                  className="mt-4 rounded-full bg-brand-600 px-4 py-2.5 text-[0.88rem] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
                >
                  {criandoRoadmap ? "Criando roadmap…" : "Criar roadmap interativo"}
                </button>
              </div>
            ) : (
              <>
              <div className="mb-4 rounded-[18px] bg-brand-800 p-5 text-white">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span className="text-[0.72rem] font-bold tracking-[0.12em] text-brand-200 uppercase">
                      Seu próximo passo
                    </span>
                    {proximoItem ? (
                      <p className="mt-1 text-[1.05rem] font-bold">
                        {proximoItem.disciplina}
                        <span className="font-normal text-brand-100"> · {proximoItem.objetivo}</span>
                      </p>
                    ) : (
                      <p className="mt-1 text-[1.05rem] font-bold text-ouro-200">
                        Roadmap concluído. Excelente trabalho.
                      </p>
                    )}
                  </div>
                  <span className="rounded-full bg-white/12 px-3 py-1.5 text-[0.82rem] font-semibold text-brand-100 tabular-nums">
                    {concluidos}/{roadmap.length} concluídos
                  </span>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
                  <span
                    className="block h-full rounded-full bg-ouro-400 transition-[width] duration-500"
                    style={{ width: `${(concluidos / roadmap.length) * 100}%` }}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[0.8rem] text-brand-100">
                  <span>{horas(horasConcluidas)} concluídas</span>
                  <span>{emAndamento} em andamento</span>
                  {semanaAtual && <span>etapa atual: semana {semanaAtual}</span>}
                </div>
              </div>
              <div className="nao-imprimir mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
                <span className="rotulo">Filtrar blocos</span>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      ["todos", "Todos"],
                      ["a_estudar", "A estudar"],
                      ["em_andamento", "Estudando"],
                      ["concluido", "Concluídos"],
                    ] as const
                  ).map(([chave, rotulo]) => (
                    <button
                      key={chave}
                      type="button"
                      onClick={() => setFiltroRoadmap(chave)}
                      aria-pressed={filtroRoadmap === chave}
                      className={`rounded-full px-2.5 py-1 text-[0.76rem] font-semibold transition-colors ${filtroRoadmap === chave ? "bg-brand-700 text-white" : "bg-sunk text-muted hover:text-ink"}`}
                    >
                      {rotulo}
                    </button>
                  ))}
                </div>
              </div>
              <section className="mb-6">
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <h3 className="rotulo">Termômetro por matéria</h3>
                  <span className="text-[0.78rem] text-muted">blocos concluídos</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {progressoPorDisciplina.map(([disciplina, progresso]) => {
                    const percentual = (progresso.concluidos / progresso.total) * 100;
                    return (
                      <div key={disciplina} className="rounded-[12px] bg-paper px-3 py-2.5">
                        <div className="flex items-baseline justify-between gap-2 text-[0.82rem]">
                          <span className="truncate font-semibold text-ink">{disciplina}</span>
                          <span className="shrink-0 text-muted tabular-nums">{progresso.concluidos}/{progresso.total}</span>
                        </div>
                        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-sunk">
                          <span className="block h-full rounded-full bg-brand-400" style={{ width: `${percentual}%` }} />
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
              </>
            )}

            {plano.avisos.length > 0 && (
              <ul className="mb-6 flex flex-col gap-2 rounded-[14px] bg-ouro-50 p-4">
                {plano.avisos.map((a) => (
                  <li
                    key={a}
                    className="flex gap-2.5 text-[0.9rem] text-ouro-700"
                  >
                    <span aria-hidden="true">·</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            )}

            {/* Trilho numerado: aqui a numeração não é enfeite — as semanas
                são uma sequência, e a ordem carrega informação. */}
            <ol className="flex flex-col">
              {plano.semanas.map((semana, indice) => {
                const total = semana.blocos.reduce((s, b) => s + b.horas, 0);
                const ultima = indice === plano.semanas.length - 1;
                return (
                  <li key={semana.numero} className="relative flex gap-4 pb-7">
                    <div className="flex shrink-0 flex-col items-center">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 text-[0.82rem] font-bold text-white tabular-nums">
                        {semana.numero}
                      </span>
                      {!ultima && (
                        <span className="mt-1 w-px flex-1 bg-line" />
                      )}
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col gap-3 pt-0.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="font-bold text-ink">{semana.foco}</h3>
                        <span className="text-[0.86rem] text-muted tabular-nums">
                          {horas(total)}
                        </span>
                      </div>

                      <ul className="flex flex-col gap-3">
                        {semana.blocos.map((bloco, i) => {
                          const porta = portas[bloco.disciplina];
                          const item = roadmap.find(
                            (atual) =>
                              atual.semana === semana.numero && atual.ordem === i,
                          );
                          const estado = item?.estado ?? "a_estudar";
                          if (filtroRoadmap !== "todos" && estado !== filtroRoadmap) {
                            return null;
                          }
                          return (
                            <li
                              key={`${bloco.disciplina}-${i}`}
                              className={`flex gap-3 rounded-[14px] border p-3.5 transition-colors ${
                                estado === "concluido"
                                  ? "border-brand-100 bg-brand-50/60"
                                  : estado === "em_andamento"
                                    ? "border-ouro-200 bg-ouro-50"
                                    : "border-transparent bg-paper"
                              }`}
                            >
                              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <span className={`text-[0.94rem] font-semibold ${estado === "concluido" ? "text-brand-700 line-through decoration-brand-300" : "text-ink"}`}>
                                  {bloco.disciplina}
                                </span>
                                <span className="text-[0.88rem] leading-snug text-muted">
                                  {bloco.objetivo}
                                </span>
                                {/* O link sai do acervo, não do modelo:
                                    conteúdo jurídico nunca vem da IA. */}
                                {porta && (
                                  <Link
                                    href={porta.href}
                                    className="mt-1 self-start text-[0.86rem] font-semibold text-brand-600 underline decoration-brand-200 underline-offset-4 transition-colors hover:decoration-brand-500"
                                  >
                                    {porta.rotulo}
                                  </Link>
                                )}
                                {item && (
                                  <div className="mt-3 flex flex-wrap gap-1.5">
                                    {(
                                      [
                                        ["a_estudar", "A estudar"],
                                        ["em_andamento", "Estudando"],
                                        ["concluido", "Concluído"],
                                      ] as const
                                    ).map(([chave, rotulo]) => (
                                      <button
                                        key={chave}
                                        type="button"
                                        onClick={() => mudarEstado(item, chave)}
                                        disabled={itemAtualizando === item.id}
                                        aria-pressed={estado === chave}
                                        className={`rounded-full px-2.5 py-1 text-[0.76rem] font-semibold transition-colors disabled:opacity-50 ${
                                          estado === chave
                                            ? chave === "concluido"
                                              ? "bg-brand-600 text-white"
                                              : chave === "em_andamento"
                                                ? "bg-ouro-400 text-noite"
                                                : "bg-body text-white"
                                            : "bg-white text-muted hover:bg-sunk hover:text-ink"
                                        }`}
                                      >
                                        {rotulo}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <span className="h-fit shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-[0.82rem] font-semibold text-brand-700 tabular-nums">
                                {horas(bloco.horas)}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </li>
                );
              })}
            </ol>
            </div>
          </div>
        </>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-paper">
            <Gema className="h-6 w-6 opacity-40" />
          </span>
          <p className="text-[1rem] font-semibold text-ink">
            O cronograma aparece aqui
          </p>
          <p className="max-w-[34ch] text-[0.9rem] text-muted">
            Semana a semana, com as horas de cada disciplina e o artigo
            comentado por onde começar em cada bloco.
          </p>
        </div>
      )}
    </aside>
  );

  return (
    <div
      ref={area}
      style={
        { "--largura-plano": `${largura}%` } as React.CSSProperties
      }
      className={`flex min-h-0 flex-1 flex-col xl:flex-row ${
        arrastando ? "cursor-col-resize select-none" : ""
      }`}
    >
      {/* Abas só existem abaixo do xl: acima, as duas superfícies convivem. */}
      {plano && (
        <div className="shrink-0 border-b border-line px-5 py-3 sm:px-8 xl:hidden">
          <div className="flex w-fit gap-1 rounded-full bg-sunk p-1">
            {(
              [
                ["conversa", "Conversa"],
                ["plano", "Plano"],
              ] as const
            ).map(([chave, rotulo]) => (
              <button
                key={chave}
                type="button"
                onClick={() => setAba(chave)}
                aria-pressed={aba === chave}
                className={`rounded-full px-4 py-1.5 text-[0.88rem] font-semibold transition-colors ${
                  aba === chave
                    ? "bg-surface text-ink shadow-[var(--shadow-baixa)]"
                    : "text-muted hover:text-ink"
                }`}
              >
                {rotulo}
              </button>
            ))}
          </div>
        </div>
      )}

      {colunaConversa}

      {/* Divisor. Só existe onde existem duas colunas — abaixo do xl elas
          são abas, e não há nada para redimensionar. */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Largura do painel do cronograma"
        aria-valuenow={Math.round(largura)}
        aria-valuemin={LARGURA_MINIMA}
        aria-valuemax={LARGURA_MAXIMA}
        tabIndex={0}
        onPointerDown={aoPressionarDivisor}
        onPointerMove={aoMoverDivisor}
        onPointerUp={aoSoltarDivisor}
        onPointerCancel={aoSoltarDivisor}
        onKeyDown={aoTeclarNoDivisor}
        onDoubleClick={() => {
          setLargura(LARGURA_PADRAO);
          gravarLargura(LARGURA_PADRAO);
        }}
        title="Arraste para redimensionar · duplo clique volta ao padrão"
        className="group relative hidden w-1.5 shrink-0 cursor-col-resize touch-none xl:block"
      >
        <span
          className={`absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors ${
            arrastando ? "bg-brand-400" : "bg-line group-hover:bg-brand-300"
          }`}
        />
        {/* Alça visível só no hover: um puxador permanente no meio da tela
            competiria com o conteúdo das duas colunas. */}
        <span
          className={`absolute top-1/2 left-1/2 h-9 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity ${
            arrastando
              ? "bg-brand-500 opacity-100"
              : "bg-hairline opacity-0 group-hover:opacity-100"
          }`}
        />
      </div>

      {colunaPlano}
    </div>
  );
}
