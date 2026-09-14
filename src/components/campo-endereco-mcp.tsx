"use client";

import { BotaoCopiar } from "@/components/copiar";

/**
 * Campo do endereço MCP com seleção ao focar e botão de copiar.
 *
 * Cliente de propósito: `onFocus` num Server Component não pode ser passado
 * como prop. As duas variantes cobrem o cartão escuro da página pública e os
 * blocos claros da área logada.
 */
export function CampoEnderecoMcp({
  texto,
  variante = "clara",
}: {
  texto: string;
  variante?: "clara" | "escura";
}) {
  const campo =
    variante === "escura"
      ? "border-white/12 bg-white/[0.06] text-white focus:border-ouro-300"
      : "border-hairline bg-paper text-ink focus:border-brand-400";

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input
        readOnly
        value={texto}
        onFocus={(e) => e.currentTarget.select()}
        aria-label="Endereço do servidor MCP do OABase"
        className={`min-w-0 flex-1 rounded-[12px] border px-3.5 py-3 font-mono text-[0.78rem] outline-none ${campo}`}
      />
      <BotaoCopiar
        texto={texto}
        rotulo={variante === "escura" ? "Copiar endereço" : "Copiar"}
        variante={variante}
      />
    </div>
  );
}