"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trechosParaFalar } from "@/lib/leitura-da-lei";

/**
 * Ouvir a lei em voz alta, com a voz que já vem no navegador.
 *
 * Sem fornecedor de voz: nada sai do aparelho, nada muda na Política de
 * Privacidade, nada entra na conta do mês. O preço é a voz variar de aparelho
 * para aparelho — e é por isso que a tela diz quando não há voz em português,
 * em vez de ler lei com sotaque de outra língua.
 *
 * Três comportamentos do `speechSynthesis` que moldam isto:
 *
 * - O Chrome corta sozinho uma fala longa (~15 s) e não avisa. O texto vai
 *   em pedaços curtos (`trechosParaFalar`), um depois do outro.
 * - `pause()` não funciona no Chrome do Android. Pausar aqui é cancelar e
 *   guardar o pedaço; continuar é falar de novo a partir dele.
 * - `cancel()` dispara o `onend` do pedaço interrompido. Cada rodada de fala
 *   tem um número, e evento de rodada velha é ignorado.
 *
 * Um tocador por vez na página: dar play num para o outro.
 */

const VELOCIDADES = [1, 1.25, 1.5, 2] as const;
const CHAVE_VELOCIDADE = "oab:velocidade-da-leitura";
const EVENTO_DONO = "oab:leitura-comecou";

export type BlocoParaOuvir = {
  /** Identifica o bloco no destaque (id do artigo no caderno). */
  id: string;
  /** Lido antes do texto, sem destaque: "Art. 5º da Constituição". */
  titulo?: string;
  partes: string[];
};

type Pedaco = { fala: string; bloco: number; parte: number | null };

function escolherVoz(): SpeechSynthesisVoice | null {
  const vozes = window.speechSynthesis.getVoices();
  const br = vozes.filter((v) => v.lang.replace("_", "-").toLowerCase() === "pt-br");
  // As vozes de rede do Chrome e as brasileiras nomeadas do macOS/iOS soam
  // bem melhor que a genérica do sistema.
  const preferida = br.find((v) => /google|luciana|felipe|francisca|thalita|antonio/i.test(v.name));
  return preferida ?? br[0] ?? vozes.find((v) => v.lang.toLowerCase().startsWith("pt")) ?? null;
}

function lerVelocidade(): number {
  try {
    const salva = Number(localStorage.getItem(CHAVE_VELOCIDADE));
    return (VELOCIDADES as readonly number[]).includes(salva) ? salva : 1;
  } catch {
    return 1;
  }
}

export function useLeitor(
  blocos: BlocoParaOuvir[],
  aoMudar?: (bloco: string | null, parte: number | null) => void,
) {
  const pedacos = useMemo<Pedaco[]>(
    () =>
      blocos.flatMap((b, indiceBloco) => [
        ...(b.titulo
          ? trechosParaFalar([b.titulo]).map((t) => ({ fala: t.fala, bloco: indiceBloco, parte: null }))
          : []),
        ...trechosParaFalar(b.partes).map((t) => ({ fala: t.fala, bloco: indiceBloco, parte: t.parte })),
      ]),
    [blocos],
  );

  const [suporte, setSuporte] = useState<"verificando" | "sim" | "sem-voz" | "nao">("verificando");
  const [estado, setEstado] = useState<"parado" | "lendo" | "pausado">("parado");
  const [velocidade, setVelocidade] = useState(1);
  const [atual, setAtual] = useState(0);

  const rodada = useRef(0);
  const indice = useRef(0);
  const velocidadeRef = useRef(1);
  const voz = useRef<SpeechSynthesisVoice | null>(null);
  const dono = useRef(Symbol("leitor"));
  const aoMudarRef = useRef(aoMudar);
  useEffect(() => {
    aoMudarRef.current = aoMudar;
  }, [aoMudar]);

  useEffect(() => {
    // Tudo em callback: o servidor não sabe se há voz, e a primeira pintura
    // no cliente tem de ser igual à do servidor ("verificando").
    if (!("speechSynthesis" in window)) {
      queueMicrotask(() => setSuporte("nao"));
      return;
    }
    // A lista de vozes chega depois em alguns navegadores (Chrome).
    const carregar = () => {
      voz.current = escolherVoz();
      const temAlguma = window.speechSynthesis.getVoices().length > 0;
      if (voz.current) setSuporte("sim");
      else if (temAlguma) setSuporte("sem-voz");
    };
    queueMicrotask(() => {
      const v = lerVelocidade();
      velocidadeRef.current = v;
      setVelocidade(v);
      carregar();
    });
    window.speechSynthesis.addEventListener("voiceschanged", carregar);
    // Safari no iOS às vezes nunca dispara o evento: sem lista depois de um
    // tempo, confia no `lang` do enunciado.
    const reserva = window.setTimeout(() => setSuporte((s) => (s === "verificando" ? "sim" : s)), 1500);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", carregar);
      window.clearTimeout(reserva);
    };
  }, []);

  const avisar = useCallback(
    (i: number | null) => {
      const p = i === null ? null : pedacos[i];
      aoMudarRef.current?.(p ? blocos[p.bloco].id : null, p ? p.parte : null);
    },
    [blocos, pedacos],
  );

  const parar = useCallback(() => {
    rodada.current++;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setEstado("parado");
    indice.current = 0;
    setAtual(0);
    avisar(null);
  }, [avisar]);

  const falarDe = useCallback(
    (inicio: number) => {
      const sintese = window.speechSynthesis;
      const minha = ++rodada.current;
      sintese.cancel();
      window.dispatchEvent(new CustomEvent(EVENTO_DONO, { detail: dono.current }));

      const falar = (i: number) => {
        if (minha !== rodada.current) return;
        if (i >= pedacos.length) {
          setEstado("parado");
          indice.current = 0;
          setAtual(0);
          avisar(null);
          return;
        }
        indice.current = i;
        setAtual(i);
        avisar(i);
        const u = new SpeechSynthesisUtterance(pedacos[i].fala);
        u.lang = "pt-BR";
        if (voz.current) u.voice = voz.current;
        u.rate = velocidadeRef.current;
        u.onend = () => falar(i + 1);
        u.onerror = (e) => {
          // Interrompido é o nosso próprio cancel(); o resto pula o pedaço
          // em vez de travar a leitura inteira.
          if (e.error === "interrupted" || e.error === "canceled") return;
          falar(i + 1);
        };
        try {
          sintese.speak(u);
        } catch {
          // Navegador que expõe a API mas recusa falar (visto em modo
          // restrito): sem isto a tela ficava em "Pausar" sem som nenhum.
          rodada.current++;
          setEstado("parado");
          setSuporte("nao");
          avisar(null);
        }
      };

      setEstado("lendo");
      // Um tique de folga: o cancel() do Chrome termina de forma assíncrona e
      // pode engolir a fala que entra logo em seguida.
      window.setTimeout(() => falar(inicio), 60);
    },
    [avisar, pedacos],
  );

  const tocar = useCallback(() => {
    if (estado === "lendo") {
      rodada.current++;
      window.speechSynthesis.cancel();
      setEstado("pausado");
      return;
    }
    falarDe(estado === "pausado" ? indice.current : 0);
  }, [estado, falarDe]);

  const trocarVelocidade = useCallback(() => {
    const proxima = VELOCIDADES[(VELOCIDADES.indexOf(velocidadeRef.current as never) + 1) % VELOCIDADES.length];
    velocidadeRef.current = proxima;
    setVelocidade(proxima);
    try {
      localStorage.setItem(CHAVE_VELOCIDADE, String(proxima));
    } catch {}
    // Vale já: recomeça o pedaço atual na velocidade nova.
    if (estado === "lendo") falarDe(indice.current);
  }, [estado, falarDe]);

  // Outro tocador começou: este para. Sair da página também para.
  useEffect(() => {
    const aoOutro = (e: Event) => {
      if ((e as CustomEvent).detail !== dono.current && estado !== "parado") {
        rodada.current++;
        setEstado("parado");
        avisar(null);
      }
    };
    window.addEventListener(EVENTO_DONO, aoOutro);
    return () => window.removeEventListener(EVENTO_DONO, aoOutro);
  }, [estado, avisar]);

  useEffect(
    () => () => {
      rodada.current++;
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    },
    [],
  );

  return {
    suporte,
    estado,
    velocidade,
    atual,
    total: pedacos.length,
    blocoAtual: pedacos[atual]?.bloco ?? 0,
    tocar,
    parar,
    trocarVelocidade,
  };
}

function Icone({ tipo }: { tipo: "play" | "pausa" | "parar" }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      {tipo === "play" && <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />}
      {tipo === "pausa" && <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />}
      {tipo === "parar" && <rect x="6" y="6" width="12" height="12" rx="2" />}
    </svg>
  );
}

const fmtVelocidade = (v: number) => `${String(v).replace(".", ",")}x`;

/** Os controles. `rotulo` é o texto do botão parado ("Ouvir artigo"). */
export function ControlesDeLeitura({
  leitor,
  rotulo,
}: {
  leitor: ReturnType<typeof useLeitor>;
  rotulo: string;
}) {
  const { suporte, estado, velocidade, tocar, parar, trocarVelocidade } = leitor;

  if (suporte === "nao") return null;
  if (suporte === "sem-voz") {
    return (
      <p className="text-[0.8rem] text-muted">
        Seu navegador não tem voz em português para ler em voz alta.
      </p>
    );
  }

  const botao =
    "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[0.84rem] font-semibold transition-colors disabled:opacity-50";

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Leitura em voz alta">
      <button
        type="button"
        onClick={tocar}
        disabled={suporte === "verificando"}
        className={`${botao} ${
          estado === "parado"
            ? "border-brand-200 bg-brand-50 text-brand-700 hover:border-brand-300"
            : "border-brand-600 bg-brand-600 text-white hover:bg-brand-700"
        }`}
      >
        <Icone tipo={estado === "lendo" ? "pausa" : "play"} />
        {estado === "lendo" ? "Pausar" : estado === "pausado" ? "Continuar" : rotulo}
      </button>
      {estado !== "parado" && (
        <>
          <button
            type="button"
            onClick={parar}
            aria-label="Parar a leitura"
            className={`${botao} border-line bg-surface text-ink hover:border-brand-200`}
          >
            <Icone tipo="parar" />
          </button>
          <button
            type="button"
            onClick={trocarVelocidade}
            aria-label={`Velocidade ${fmtVelocidade(velocidade)}. Tocar para mudar.`}
            className={`${botao} min-w-[3.4rem] justify-center border-line bg-surface text-ink tabular-nums hover:border-brand-200`}
          >
            {fmtVelocidade(velocidade)}
          </button>
        </>
      )}
    </div>
  );
}

/**
 * Tocador da página do artigo. Destaca o parágrafo que está sendo lido
 * marcando `data-lendo` no `<p data-parte>` que `CadernoDoArtigo` já
 * renderiza — atributo que o React não controla, então um re-render do
 * caderno (destacar, anotar) não apaga o destaque.
 */
export function OuvirArtigo({
  titulo,
  partes,
  alvo,
}: {
  titulo: string;
  partes: string[];
  /** id do elemento que contém os `<p data-parte>`. */
  alvo: string;
}) {
  const blocos = useMemo(() => [{ id: alvo, titulo, partes }], [alvo, titulo, partes]);
  const leitor = useLeitor(blocos, (_bloco, parte) => {
    const raiz = document.getElementById(alvo);
    raiz?.querySelectorAll("[data-lendo]").forEach((el) => el.removeAttribute("data-lendo"));
    if (parte === null) return;
    const p = raiz?.querySelector(`[data-parte="${parte}"]`);
    p?.setAttribute("data-lendo", "");
    p?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });
  return <ControlesDeLeitura leitor={leitor} rotulo="Ouvir artigo" />;
}
