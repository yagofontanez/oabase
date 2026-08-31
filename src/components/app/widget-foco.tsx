"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/browser";

type Fase = "foco" | "pausa" | "pausaLonga";
type Duracoes = { foco: number; pausa: number; pausaLonga: number };
type Tamanho = 1 | 2 | 3;

const PADRAO: Duracoes = { foco: 25, pausa: 5, pausaLonga: 15 };
const CICLOS_ATE_PAUSA_LONGA = 4;
const CHAVE = "oabase:foco";
const EVENTO_ABRIR = "oabase:foco:abrir";
const MARGEM = 12;

const ROTULO: Record<Fase, string> = {
  foco: "Foco",
  pausa: "Pausa curta",
  pausaLonga: "Pausa longa",
};

type Estado = {
  fase: Fase;
  ciclo: number;
  fimEm: number | null;
  restante: number;
  disciplina: string;
  duracoes: Duracoes;
  aberto: boolean;
  /** 1 = pílula, 2 = intermediário, 3 = completo. */
  tamanho: Tamanho;
  /** null = ancorado no canto inferior direito; depois de arrastar, vira px. */
  posicao: { x: number; y: number } | null;
};

const INICIAL: Estado = {
  fase: "foco",
  ciclo: 0,
  fimEm: null,
  restante: PADRAO.foco * 60,
  disciplina: "",
  duracoes: PADRAO,
  aberto: false,
  tamanho: 3,
  posicao: null,
};

/** Mantém o widget dentro da janela — inclusive depois de redimensionar. */
function dentroDaTela(x: number, y: number, largura: number, altura: number) {
  return {
    x: Math.min(Math.max(MARGEM, x), window.innerWidth - largura - MARGEM),
    y: Math.min(Math.max(MARGEM, y), window.innerHeight - altura - MARGEM),
  };
}

/** Abre o widget de qualquer lugar — o botão do cabeçalho usa isto. */
export function abrirWidgetFoco() {
  window.dispatchEvent(new Event(EVENTO_ABRIR));
}

function mmss(segundos: number) {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Bipe curto pela Web Audio API — evita depender de um arquivo de som. */
function tocarAviso(agudo: boolean) {
  try {
    const Contexto =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new Contexto();
    const osc = ctx.createOscillator();
    const ganho = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = agudo ? 880 : 520;
    ganho.gain.setValueAtTime(0.0001, ctx.currentTime);
    ganho.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 0.02);
    ganho.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.7);
    osc.connect(ganho).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.72);
    osc.onended = () => ctx.close();
  } catch {
    // Sem áudio disponível: o timer continua em silêncio.
  }
}

const FUNDO = "linear-gradient(160deg, #0B6250 0%, #073B33 55%, #041F1C 100%)";

function IconePlay({ pausado }: { pausado: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-4 w-4"
      aria-hidden="true"
    >
      {pausado ? (
        <path d="M8 5.5v13l11-6.5z" />
      ) : (
        <path d="M8 5.5h3.2v13H8zM12.8 5.5H16v13h-3.2z" />
      )}
    </svg>
  );
}

/**
 * Widget de foco.
 *
 * Fica montado em toda a aplicação e no site, e não numa tela própria: o
 * ponto do modo foco é estudar enquanto o relógio corre — ler a legislação,
 * abrir o plano de estudo — e uma sala de foco vazia impede exatamente isso.
 *
 * Sobreviver à navegação sai de graça porque o tempo restante vem do relógio,
 * não de um contador decrescente: o componente pode desmontar e remontar a
 * cada troca de rota que o cálculo continua exato. O estado vive em
 * `localStorage`, que é também o que o mantém entre abas e recarregamentos.
 */
export function WidgetFoco({
  disciplinas = [],
}: {
  disciplinas?: { id: string; slug: string; nome: string }[];
}) {
  const [estado, setEstado] = useState<Estado>(INICIAL);
  const [montado, setMontado] = useState(false);
  const [telaCheia, setTelaCheia] = useState(false);
  const inicioDoBloco = useRef<number | null>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const arraste = useRef<{ dx: number; dy: number; moveu: boolean } | null>(null);

  const rodando = estado.fimEm !== null;

  const persistir = useCallback((proximo: Estado) => {
    try {
      window.localStorage.setItem(CHAVE, JSON.stringify(proximo));
    } catch {
      /* armazenamento bloqueado: a sessão atual segue funcionando */
    }
  }, []);

  const atualizar = useCallback(
    (mudanca: Partial<Estado>) => {
      setEstado((atual) => {
        const proximo = { ...atual, ...mudanca };
        persistir(proximo);
        return proximo;
      });
    },
    [persistir],
  );

  // Retoma o que estava rodando, inclusive depois de recarregar a página.
  useEffect(() => {
    try {
      const salvo = window.localStorage.getItem(CHAVE);
      if (salvo) {
        const e = { ...INICIAL, ...(JSON.parse(salvo) as Estado) };
        if (e.fimEm && e.fimEm <= Date.now()) {
          e.fimEm = null;
          e.restante = 0;
        } else if (e.fimEm) {
          e.restante = Math.round((e.fimEm - Date.now()) / 1000);
        }
        setEstado(e);
      }
    } catch {
      /* começa limpo */
    }
    setMontado(true);
  }, []);

  useEffect(() => {
    const abrir = () =>
      setEstado((atual) => {
        const proximo: Estado = {
          ...atual,
          aberto: true,
          // Abrir pela primeira vez mostra o widget inteiro; se a pessoa já
          // escolheu um tamanho, respeita a escolha dela.
          tamanho: atual.aberto ? atual.tamanho : 3,
        };
        persistir(proximo);
        return proximo;
      });
    window.addEventListener(EVENTO_ABRIR, abrir);
    const mudouTela = () => setTelaCheia(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", mudouTela);
    return () => {
      window.removeEventListener(EVENTO_ABRIR, abrir);
      document.removeEventListener("fullscreenchange", mudouTela);
    };
  }, [persistir]);

  const registrarBloco = useCallback(
    async (minutos: number, disciplinaSlug: string) => {
      const supabase = supabaseNavegador();
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;

      const escolhida = disciplinas.find((d) => d.slug === disciplinaSlug);
      const inicio = inicioDoBloco.current ?? Date.now() - minutos * 60_000;

      await supabase.from("sessoes_foco").insert({
        user_id: data.user.id,
        disciplina_id: escolhida?.id ?? null,
        minutos,
        iniciado_em: new Date(inicio).toISOString(),
      });
    },
    [disciplinas],
  );

  const avancar = useCallback(() => {
    setEstado((atual) => {
      const eraFoco = atual.fase === "foco";
      if (eraFoco) void registrarBloco(atual.duracoes.foco, atual.disciplina);

      const ciclo = eraFoco ? atual.ciclo + 1 : atual.ciclo;
      const proxima: Fase = eraFoco
        ? ciclo % CICLOS_ATE_PAUSA_LONGA === 0
          ? "pausaLonga"
          : "pausa"
        : "foco";

      tocarAviso(eraFoco);
      const segundos = atual.duracoes[proxima] * 60;

      // Pausa começa sozinha — a pessoa se levanta. Foco não: contar estudo
      // enquanto ela ainda está longe da mesa seria mentira no dado.
      if (proxima === "foco") inicioDoBloco.current = null;

      const proximo: Estado = {
        ...atual,
        fase: proxima,
        ciclo,
        restante: segundos,
        fimEm: proxima === "foco" ? null : Date.now() + segundos * 1000,
      };
      persistir(proximo);
      return proximo;
    });
  }, [persistir, registrarBloco]);

  useEffect(() => {
    if (!rodando) return;
    const id = window.setInterval(() => {
      setEstado((atual) => {
        if (atual.fimEm === null) return atual;
        const falta = Math.round((atual.fimEm - Date.now()) / 1000);
        if (falta <= 0) return atual;
        return { ...atual, restante: falta };
      });
    }, 500);
    return () => window.clearInterval(id);
  }, [rodando]);

  // A virada de fase mora fora do intervalo para não disparar duas vezes se
  // dois tiques caírem antes do estado atualizar.
  useEffect(() => {
    if (rodando && estado.restante <= 0) avancar();
  }, [rodando, estado.restante, avancar]);

  // Redimensionar a janela pode deixar o widget fora da área visível.
  useEffect(() => {
    if (!estado.posicao) return;
    const reposicionar = () => {
      const r = caixa.current?.getBoundingClientRect();
      if (!r) return;
      setEstado((atual) =>
        atual.posicao
          ? {
              ...atual,
              posicao: dentroDaTela(atual.posicao.x, atual.posicao.y, r.width, r.height),
            }
          : atual,
      );
    };
    window.addEventListener("resize", reposicionar);
    return () => window.removeEventListener("resize", reposicionar);
  }, [estado.posicao]);

  useEffect(() => {
    if (!montado) return;
    const base = document.title.replace(/^\d{2}:\d{2} · /, "");
    document.title = rodando ? `${mmss(estado.restante)} · ${base}` : base;
  }, [estado.restante, rodando, montado]);

  /* ---- Ações --------------------------------------------------------- */

  function alternarRelogio() {
    if (rodando) {
      atualizar({ fimEm: null });
      return;
    }
    if (estado.fase === "foco" && inicioDoBloco.current === null) {
      inicioDoBloco.current = Date.now();
    }
    atualizar({ fimEm: Date.now() + estado.restante * 1000 });
  }

  async function alternarTelaCheia() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // Navegador ou permissão negou: o modo foco funciona sem tela cheia.
    }
  }

  function ajustar(campo: keyof Duracoes, valor: number) {
    const limpo = Math.min(120, Math.max(1, valor || 1));
    const duracoes = { ...estado.duracoes, [campo]: limpo };
    atualizar({
      duracoes,
      restante: !rodando && campo === estado.fase ? limpo * 60 : estado.restante,
    });
  }

  function encerrar() {
    inicioDoBloco.current = null;
    const zerado: Estado = {
      ...INICIAL,
      duracoes: estado.duracoes,
      disciplina: estado.disciplina,
      posicao: estado.posicao,
      tamanho: estado.tamanho,
    };
    setEstado(zerado);
    persistir(zerado);
    if (document.fullscreenElement) void document.exitFullscreen();
  }

  /* ---- Arrastar ------------------------------------------------------ */

  function aoPressionar(evento: React.PointerEvent<HTMLElement>) {
    if (evento.button !== 0) return;
    const alvo = evento.target as HTMLElement;
    if (alvo.closest("button, select, input, a")) return;

    const retangulo = caixa.current?.getBoundingClientRect();
    if (!retangulo) return;

    arraste.current = {
      dx: evento.clientX - retangulo.left,
      dy: evento.clientY - retangulo.top,
      moveu: false,
    };
    evento.currentTarget.setPointerCapture(evento.pointerId);
  }

  function aoMover(evento: React.PointerEvent<HTMLElement>) {
    const a = arraste.current;
    const retangulo = caixa.current?.getBoundingClientRect();
    if (!a || !retangulo) return;

    const bruto = { x: evento.clientX - a.dx, y: evento.clientY - a.dy };
    if (!a.moveu) {
      // Só vira arraste depois de alguns pixels: senão um clique com a mão
      // trêmula reposicionaria o widget em vez de acionar o botão.
      const distancia =
        Math.abs(bruto.x - retangulo.left) + Math.abs(bruto.y - retangulo.top);
      if (distancia < 4) return;
      a.moveu = true;
    }

    setEstado((atual) => ({
      ...atual,
      posicao: dentroDaTela(bruto.x, bruto.y, retangulo.width, retangulo.height),
    }));
  }

  function aoSoltar(evento: React.PointerEvent<HTMLElement>) {
    if (arraste.current?.moveu) {
      // Forma funcional de propósito: `estado` aqui é o do render anterior e
      // guardaria a posição de onde o widget estava antes do último passo.
      setEstado((atual) => {
        persistir(atual);
        return atual;
      });
    }
    arraste.current = null;
    try {
      evento.currentTarget.releasePointerCapture(evento.pointerId);
    } catch {
      /* ponteiro já liberado */
    }
  }

  const alca = {
    onPointerDown: aoPressionar,
    onPointerMove: aoMover,
    onPointerUp: aoSoltar,
    onPointerCancel: aoSoltar,
    style: { touchAction: "none" as const },
  };

  // `montado` evita divergência de hidratação: o servidor não conhece o
  // `localStorage`, então o widget só decide se aparece depois de montar.
  // `montado` evita divergência de hidratação: o servidor não conhece o
  // `localStorage`, então o widget só decide se aparece depois de montar.
  if (!montado || (!estado.aberto && !rodando)) return null;

  const total = estado.duracoes[estado.fase] * 60;
  const progresso = total > 0 ? 1 - estado.restante / total : 0;
  const nomeDisciplina = disciplinas.find(
    (d) => d.slug === estado.disciplina,
  )?.nome;
  const relogio = mmss(Math.max(0, estado.restante));

  const posicionamento = estado.posicao
    ? { left: estado.posicao.x, top: estado.posicao.y }
    : undefined;

  const seletorDeTamanho = (
    <div className="flex items-center rounded-full bg-white/10 p-0.5">
      {([1, 2, 3] as Tamanho[]).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => atualizar({ tamanho: t })}
          aria-pressed={estado.tamanho === t}
          title={`Tamanho ${t}×`}
          className={`rounded-full px-2 py-0.5 text-[0.72rem] font-semibold transition-colors ${
            estado.tamanho === t
              ? "bg-white/85 text-brand-800"
              : "text-white/60 hover:text-white"
          }`}
        >
          {t}×
        </button>
      ))}
    </div>
  );

  return (
    <div
      ref={caixa}
      className={`fixed z-[70] ${
        estado.posicao ? "" : "right-4 bottom-4 sm:right-6 sm:bottom-6"
      }`}
      style={posicionamento}
    >
      {estado.tamanho === 1 ? (
        /* ---------------- 1× — pílula ---------------- */
        <div
          {...alca}
          className="flex cursor-grab items-center gap-2.5 rounded-full py-2 pr-2 pl-4 text-white shadow-[0_16px_40px_-16px_rgba(4,31,28,0.7)] select-none active:cursor-grabbing"
          style={{ ...alca.style, background: FUNDO }}
        >
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
              rodando ? "bg-ouro-400" : "bg-white/40"
            }`}
          />
          <span className="text-[1rem] font-bold tabular-nums">{relogio}</span>
          <button
            type="button"
            onClick={alternarRelogio}
            title={rodando ? "Pausar" : "Começar"}
            className="rounded-full p-1.5 text-white/75 transition-colors hover:bg-white/10 hover:text-white"
          >
            <IconePlay pausado={!rodando} />
          </button>
          <button
            type="button"
            onClick={() => atualizar({ tamanho: 2 })}
            title="Aumentar"
            className="rounded-full p-1.5 text-white/55 transition-colors hover:bg-white/10 hover:text-white"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              className="h-3.5 w-3.5"
              aria-hidden="true"
            >
              <path d="M4 10V4h6M20 14v6h-6" />
            </svg>
          </button>
        </div>
      ) : (
        /* ---------------- 2× e 3× — cartão ---------------- */
        <div
          className={`overflow-hidden rounded-[18px] text-white shadow-[0_24px_60px_-20px_rgba(4,31,28,0.65)] ${
            estado.tamanho === 3
              ? "w-[min(92vw,340px)]"
              : "w-[min(88vw,268px)]"
          }`}
          style={{ background: FUNDO }}
        >
          {/* A barra do topo é a alça: `touch-action: none` impede o navegador
              de interpretar o gesto como rolagem no celular. */}
          <div
            {...alca}
            className="flex cursor-grab items-center justify-between gap-2 border-b border-white/12 px-3.5 py-2.5 select-none active:cursor-grabbing"
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-3.5 w-3.5 shrink-0 text-white/35"
              aria-hidden="true"
            >
              <circle cx="9" cy="6" r="1.4" />
              <circle cx="15" cy="6" r="1.4" />
              <circle cx="9" cy="12" r="1.4" />
              <circle cx="15" cy="12" r="1.4" />
              <circle cx="9" cy="18" r="1.4" />
              <circle cx="15" cy="18" r="1.4" />
            </svg>

            {seletorDeTamanho}

            <button
              type="button"
              onClick={alternarTelaCheia}
              title={telaCheia ? "Sair da tela cheia" : "Tela cheia"}
              className="rounded-full p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                className="h-4 w-4"
                aria-hidden="true"
              >
                {telaCheia ? (
                  <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
                ) : (
                  <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
                )}
              </svg>
            </button>
          </div>

          <div
            className={`flex flex-col items-center ${
              estado.tamanho === 3 ? "gap-4 px-5 py-6" : "gap-3 px-4 py-4"
            }`}
          >
            {estado.tamanho === 3 && (
              <div className="flex items-center gap-2">
                {Array.from({ length: CICLOS_ATE_PAUSA_LONGA }, (_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 w-1.5 rounded-full ${
                      i < estado.ciclo % CICLOS_ATE_PAUSA_LONGA ||
                      (estado.ciclo > 0 &&
                        estado.ciclo % CICLOS_ATE_PAUSA_LONGA === 0)
                        ? "bg-ouro-400"
                        : "bg-white/25"
                    }`}
                  />
                ))}
              </div>
            )}

            <span className="text-[0.84rem] font-semibold text-brand-200">
              {ROTULO[estado.fase]}
              {nomeDisciplina && estado.fase === "foco" && estado.tamanho === 3
                ? ` · ${nomeDisciplina}`
                : ""}
            </span>

            <span
              className={`leading-none font-extrabold tracking-[-0.05em] tabular-nums ${
                estado.tamanho === 3 ? "text-[3.2rem]" : "text-[2.3rem]"
              }`}
            >
              {relogio}
            </span>

            <div className="h-1 w-full overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-ouro-400"
                style={{
                  width: `${progresso * 100}%`,
                  transition: "width 0.4s linear",
                }}
              />
            </div>

            <div className="flex w-full items-center gap-2">
              <button
                type="button"
                onClick={alternarRelogio}
                className="flex-1 rounded-full bg-ouro-400 py-2 text-[0.9rem] font-semibold text-brand-900 transition-colors hover:bg-ouro-500"
              >
                {rodando
                  ? "Pausar"
                  : estado.restante === total
                    ? "Começar"
                    : "Continuar"}
              </button>
              <button
                type="button"
                onClick={avancar}
                title="Pular etapa"
                className="rounded-full border border-white/20 px-3.5 py-2 text-[0.86rem] font-medium text-white transition-colors hover:border-white/45"
              >
                Pular
              </button>
            </div>

            {/* Seletor de disciplina e ajuste de tempos só no tamanho maior:
                no 2× eles fariam o cartão crescer até deixar de ser o meio
                termo que ele existe para ser. */}
            {estado.tamanho === 3 && (
              <>
                {disciplinas.length > 0 && (
                  <select
                    value={estado.disciplina}
                    onChange={(e) => atualizar({ disciplina: e.target.value })}
                    className="w-full rounded-[10px] border border-white/20 bg-white/[0.07] px-3 py-2 text-[0.88rem] text-white outline-none focus:border-white/50"
                  >
                    <option value="" className="text-ink">
                      sem disciplina
                    </option>
                    {disciplinas.map((d) => (
                      <option key={d.slug} value={d.slug} className="text-ink">
                        {d.nome}
                      </option>
                    ))}
                  </select>
                )}

                <div className="grid w-full grid-cols-3 gap-2">
                  {(
                    [
                      ["foco", "Foco"],
                      ["pausa", "Pausa"],
                      ["pausaLonga", "Longa"],
                    ] as [keyof Duracoes, string][]
                  ).map(([campo, rotulo]) => (
                    <label key={campo} className="flex flex-col gap-1">
                      <span className="text-[0.76rem] text-brand-200">
                        {rotulo}
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={estado.duracoes[campo]}
                        onChange={(e) => ajustar(campo, Number(e.target.value))}
                        className="w-full rounded-[8px] border border-white/20 bg-white/[0.07] px-2 py-1.5 text-[0.88rem] text-white tabular-nums outline-none focus:border-white/50"
                      />
                    </label>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={encerrar}
                  className="text-[0.84rem] text-brand-200 underline decoration-white/25 underline-offset-4 transition-colors hover:text-white"
                >
                  Encerrar sessão
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
