"use client";

import { abrirWidgetFoco } from "./widget-foco";

const Relogio = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-[16px] w-[16px] shrink-0"
    aria-hidden="true"
  >
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9.5V13l2.2 1.6" />
    <path d="M9 2h6" />
  </svg>
);

/**
 * Abre o widget de foco.
 *
 * Não é link: o modo foco não leva a lugar nenhum, ele liga em cima do que
 * já está na tela. Levar a pessoa para outra rota seria justamente o que
 * atrapalhava antes.
 */
export function BotaoFoco({
  variante = "cabecalho",
  disciplina,
  minutos,
}: {
  /** `cabecalho` esconde o rótulo no celular; `acao` nunca esconde. */
  variante?: "cabecalho" | "acao" | "cartao";
  disciplina?: string;
  minutos?: number;
}) {
  if (variante === "cartao") {
    return (
      <button
        type="button"
        onClick={() => abrirWidgetFoco({ disciplina, minutos })}
        className="group flex flex-col gap-2 rounded-[18px] border border-brand-200 bg-brand-50 p-6 text-left transition-colors hover:border-brand-300"
      >
        <span className="flex items-center gap-2 font-semibold text-ink">
          Entrar no modo foco
          <span className="text-brand-500 opacity-45 transition-opacity group-hover:opacity-100">
            →
          </span>
        </span>
        <span className="text-[0.92rem] text-muted">
          Pomodoro em widget flutuante. Continua contando enquanto você estuda.
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => abrirWidgetFoco({ disciplina, minutos })}
      className="flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-[0.9rem] font-semibold text-brand-700 transition-colors hover:border-brand-300 hover:bg-brand-100"
    >
      <Relogio />
      <span className={variante === "acao" ? undefined : "hidden sm:inline"}>
        Modo foco
      </span>
    </button>
  );
}
