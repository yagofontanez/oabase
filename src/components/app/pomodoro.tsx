"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/browser";

type Fase = "foco" | "pausa" | "pausaLonga";

type Duracoes = { foco: number; pausa: number; pausaLonga: number };

const PADRAO: Duracoes = { foco: 25, pausa: 5, pausaLonga: 15 };
const CICLOS_ATE_PAUSA_LONGA = 4;
const CHAVE_DURACOES = "oabase:foco:duracoes";
const CHAVE_ESTADO = "oabase:foco:estado";

const ROTULO: Record<Fase, string> = {
  foco: "Foco",
  pausa: "Pausa curta",
  pausaLonga: "Pausa longa",
};

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
    // Sem áudio disponível: o timer continua funcionando em silêncio.
  }
}

export function Pomodoro({
  userId,
  disciplinas,
  focoHojeInicial,
}: {
  userId: string;
  disciplinas: { slug: string; nome: string; id?: string }[];
  focoHojeInicial: number;
}) {
  const [duracoes, setDuracoes] = useState<Duracoes>(PADRAO);
  const [fase, setFase] = useState<Fase>("foco");
  const [ciclo, setCiclo] = useState(0);
  const [rodando, setRodando] = useState(false);
  const [restante, setRestante] = useState(PADRAO.foco * 60);
  const [disciplina, setDisciplina] = useState("");
  const [focoHoje, setFocoHoje] = useState(focoHojeInicial);
  const [ajustando, setAjustando] = useState(false);
  const [montado, setMontado] = useState(false);

  const fimEm = useRef<number | null>(null);
  const inicioDoBloco = useRef<number | null>(null);

  const duracaoDaFase = useCallback(
    (f: Fase) => duracoes[f] * 60,
    [duracoes],
  );

  // Preferências e sessão em andamento sobrevivem ao recarregamento.
  useEffect(() => {
    try {
      const salvas = window.localStorage.getItem(CHAVE_DURACOES);
      if (salvas) {
        const d = JSON.parse(salvas) as Duracoes;
        setDuracoes(d);
        setRestante(d.foco * 60);
      }
      const estado = window.localStorage.getItem(CHAVE_ESTADO);
      if (estado) {
        const e = JSON.parse(estado) as {
          fase: Fase;
          ciclo: number;
          fimEm: number | null;
          restante: number;
          disciplina: string;
        };
        setFase(e.fase);
        setCiclo(e.ciclo);
        setDisciplina(e.disciplina ?? "");
        if (e.fimEm && e.fimEm > Date.now()) {
          fimEm.current = e.fimEm;
          setRestante(Math.round((e.fimEm - Date.now()) / 1000));
          setRodando(true);
        } else {
          setRestante(e.restante);
        }
      }
    } catch {
      // Armazenamento bloqueado: começa do zero, sem quebrar.
    }
    setMontado(true);
  }, []);

  const salvarEstado = useCallback(
    (extra: Partial<{ fase: Fase; ciclo: number; restante: number }> = {}) => {
      try {
        window.localStorage.setItem(
          CHAVE_ESTADO,
          JSON.stringify({
            fase: extra.fase ?? fase,
            ciclo: extra.ciclo ?? ciclo,
            fimEm: fimEm.current,
            restante: extra.restante ?? restante,
            disciplina,
          }),
        );
      } catch {
        /* preferência não persiste, sessão atual segue */
      }
    },
    [fase, ciclo, restante, disciplina],
  );

  const registrarBloco = useCallback(async () => {
    const inicio = inicioDoBloco.current ?? Date.now() - duracoes.foco * 60_000;
    const escolhida = disciplinas.find((d) => d.slug === disciplina);

    setFocoHoje((m) => m + duracoes.foco);

    const { error } = await supabaseNavegador()
      .from("sessoes_foco")
      .insert({
        user_id: userId,
        disciplina_id: escolhida?.id ?? null,
        minutos: duracoes.foco,
        iniciado_em: new Date(inicio).toISOString(),
      });

    // Falha de rede não pode derrubar o timer: o bloco já foi cumprido,
    // o que se perde é só o registro.
    if (error) setFocoHoje((m) => m - duracoes.foco);
  }, [disciplina, disciplinas, duracoes.foco, userId]);

  const avancarFase = useCallback(() => {
    const eraFoco = fase === "foco";
    if (eraFoco) void registrarBloco();

    const proximoCiclo = eraFoco ? ciclo + 1 : ciclo;
    const proxima: Fase = eraFoco
      ? proximoCiclo % CICLOS_ATE_PAUSA_LONGA === 0
        ? "pausaLonga"
        : "pausa"
      : "foco";

    tocarAviso(eraFoco);

    const segundos = duracoes[proxima] * 60;
    setFase(proxima);
    setCiclo(proximoCiclo);
    setRestante(segundos);

    // Pausa começa sozinha — a pessoa se levanta. Foco não: começar a
    // contar estudo enquanto ela ainda está longe seria mentira no dado.
    if (proxima === "foco") {
      fimEm.current = null;
      inicioDoBloco.current = null;
      setRodando(false);
    } else {
      fimEm.current = Date.now() + segundos * 1000;
      setRodando(true);
    }
    salvarEstado({ fase: proxima, ciclo: proximoCiclo, restante: segundos });
  }, [ciclo, duracoes, fase, registrarBloco, salvarEstado]);

  // O tempo restante vem do relógio, não de um contador decrescente: aba em
  // segundo plano é estrangulada pelo navegador e um `setInterval` que
  // subtrai 1s por tique atrasaria minutos numa sessão longa.
  useEffect(() => {
    if (!rodando) return;
    const id = window.setInterval(() => {
      if (fimEm.current === null) return;
      const falta = Math.round((fimEm.current - Date.now()) / 1000);
      if (falta <= 0) {
        avancarFase();
      } else {
        setRestante(falta);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [rodando, avancarFase]);

  useEffect(() => {
    if (!montado) return;
    document.title = rodando
      ? `${mmss(restante)} · ${ROTULO[fase]} — OABase`
      : "Modo foco — OABase";
    return () => {
      document.title = "Modo foco — OABase";
    };
  }, [restante, rodando, fase, montado]);

  function alternar() {
    if (rodando) {
      fimEm.current = null;
      setRodando(false);
      salvarEstado();
      return;
    }
    if (fase === "foco" && inicioDoBloco.current === null) {
      inicioDoBloco.current = Date.now();
    }
    fimEm.current = Date.now() + restante * 1000;
    setRodando(true);
    salvarEstado();
  }

  function reiniciar() {
    const segundos = duracaoDaFase(fase);
    fimEm.current = null;
    inicioDoBloco.current = null;
    setRodando(false);
    setRestante(segundos);
    salvarEstado({ restante: segundos });
  }

  function ajustar(campo: keyof Duracoes, valor: number) {
    const limpo = Math.min(120, Math.max(1, valor || 1));
    const novas = { ...duracoes, [campo]: limpo };
    setDuracoes(novas);
    try {
      window.localStorage.setItem(CHAVE_DURACOES, JSON.stringify(novas));
    } catch {
      /* segue sem persistir */
    }
    if (!rodando && campo === fase) setRestante(limpo * 60);
  }

  const total = duracaoDaFase(fase);
  const progresso = total > 0 ? 1 - restante / total : 0;
  const raio = 130;
  const circunferencia = 2 * Math.PI * raio;

  return (
    <div className="flex w-full max-w-[560px] flex-col items-center gap-9">
      <div className="flex items-center gap-2.5">
        {Array.from({ length: CICLOS_ATE_PAUSA_LONGA }, (_, i) => (
          <span
            key={i}
            title={`Bloco ${i + 1} de ${CICLOS_ATE_PAUSA_LONGA}`}
            className={`h-2 w-2 rounded-full transition-colors ${
              i < ciclo % CICLOS_ATE_PAUSA_LONGA ||
              (ciclo > 0 && ciclo % CICLOS_ATE_PAUSA_LONGA === 0)
                ? "bg-ouro-400"
                : "bg-white/25"
            }`}
          />
        ))}
      </div>

      <div className="relative flex items-center justify-center">
        <svg width="300" height="300" viewBox="0 0 300 300" aria-hidden="true">
          <circle
            cx="150"
            cy="150"
            r={raio}
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="6"
          />
          <circle
            cx="150"
            cy="150"
            r={raio}
            fill="none"
            stroke={fase === "foco" ? "#E9A23B" : "#62B39C"}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circunferencia}
            strokeDashoffset={circunferencia * (1 - progresso)}
            transform="rotate(-90 150 150)"
            style={{ transition: "stroke-dashoffset 0.3s linear" }}
          />
        </svg>

        <div className="absolute flex flex-col items-center gap-1">
          <span className="text-[0.95rem] font-semibold text-brand-200">
            {ROTULO[fase]}
          </span>
          <span
            className="text-[4.2rem] leading-none font-extrabold tracking-[-0.05em] text-white tabular-nums"
            role="timer"
            aria-live="off"
          >
            {mmss(restante)}
          </span>
          {fase === "foco" && disciplina && (
            <span className="max-w-[16ch] text-center text-[0.86rem] text-brand-200">
              {disciplinas.find((d) => d.slug === disciplina)?.nome}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={alternar}
          className="rounded-full bg-ouro-400 px-9 py-3.5 text-[1rem] font-semibold text-brand-900 transition-colors hover:bg-ouro-500"
        >
          {rodando ? "Pausar" : restante === total ? "Começar" : "Continuar"}
        </button>
        <button
          type="button"
          onClick={reiniciar}
          className="rounded-full border border-white/20 px-6 py-3.5 text-[0.95rem] font-semibold text-white transition-colors hover:border-white/45 hover:bg-white/5"
        >
          Reiniciar
        </button>
        <button
          type="button"
          onClick={avancarFase}
          title="Pular para a próxima etapa"
          className="rounded-full border border-white/20 px-6 py-3.5 text-[0.95rem] font-semibold text-white transition-colors hover:border-white/45 hover:bg-white/5"
        >
          Pular
        </button>
      </div>

      <div className="flex w-full flex-col gap-4 border-t border-white/12 pt-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <label className="flex items-center gap-3 text-[0.92rem] text-brand-100">
            Estudando
            <select
              value={disciplina}
              onChange={(e) => {
                setDisciplina(e.target.value);
                salvarEstado();
              }}
              className="rounded-[10px] border border-white/20 bg-white/[0.07] px-3 py-2 text-[0.9rem] text-white outline-none focus:border-white/50"
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
          </label>

          <button
            type="button"
            onClick={() => setAjustando((v) => !v)}
            aria-expanded={ajustando}
            className="text-[0.9rem] font-medium text-brand-200 underline decoration-white/25 underline-offset-4 transition-colors hover:text-white"
          >
            {ajustando ? "Ocultar tempos" : "Ajustar tempos"}
          </button>
        </div>

        {ajustando && (
          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                ["foco", "Foco"],
                ["pausa", "Pausa curta"],
                ["pausaLonga", "Pausa longa"],
              ] as [keyof Duracoes, string][]
            ).map(([campo, rotulo]) => (
              <label key={campo} className="flex flex-col gap-1.5">
                <span className="text-[0.86rem] text-brand-200">{rotulo}</span>
                <span className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={duracoes[campo]}
                    onChange={(e) => ajustar(campo, Number(e.target.value))}
                    className="w-20 rounded-[10px] border border-white/20 bg-white/[0.07] px-3 py-2 text-[0.95rem] text-white tabular-nums outline-none focus:border-white/50"
                  />
                  <span className="text-[0.86rem] text-brand-200">min</span>
                </span>
              </label>
            ))}
          </div>
        )}

        <p className="text-[0.9rem] text-brand-200">
          <strong className="font-semibold text-white tabular-nums">
            {Math.floor(focoHoje / 60)}h {focoHoje % 60}min
          </strong>{" "}
          de foco registrados hoje.{" "}
          <Link
            href="/app"
            className="underline decoration-white/25 underline-offset-4 transition-colors hover:text-white"
          >
            Voltar ao painel
          </Link>
        </p>
      </div>
    </div>
  );
}
