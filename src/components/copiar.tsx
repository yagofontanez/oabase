"use client";

import { useState } from "react";

/**
 * Botão de copiar para o fundo escolhido.
 *
 * `clara` é para fundo claro (área logada): botão escuro. `escura` é para
 * cartões escuros (página pública): vidro claro. Sem a Clipboard API —
 * contexto incomum — o campo ao lado continua selecionável à mão.
 */
export function BotaoCopiar({
  texto,
  rotulo = "Copiar",
  variante = "clara",
  className = "",
}: {
  texto: string;
  rotulo?: string;
  variante?: "clara" | "escura";
  className?: string;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2200);
    } catch {
      // Sem permissão, o campo de texto continua selecionável e copiável.
    }
  }

  const base =
    "shrink-0 rounded-full px-5 py-2.5 text-[0.84rem] font-bold transition-colors";
  const estilo =
    variante === "escura"
      ? "bg-white/10 text-white hover:bg-white/20"
      : "bg-noite text-white hover:bg-brand-800";

  return (
    <button
      type="button"
      onClick={copiar}
      className={`${base} ${estilo} ${className}`}
    >
      {copiado ? "Copiado!" : rotulo}
    </button>
  );
}