"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/browser";
import { navegar } from "@/components/barra-de-navegacao";

const Porta = () => (
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
    <path d="M15 4h3.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H15" />
    <path d="M10 8l-4 4 4 4M6 12h9" />
  </svg>
);

/**
 * Sair da conta.
 *
 * `tom="claro"` é a versão do trilho escuro: só ícone, porque ali o rótulo
 * disputaria espaço com o nome de quem está logado e o botão não precisa de
 * peso — quem sai já sabe o que procura.
 */
export function BotaoSair({
  tom = "escuro",
}: {
  /** `claro` = trilho escuro (só ícone); `contorno` = botão de página. */
  tom?: "escuro" | "claro" | "contorno";
}) {
  const router = useRouter();
  const [saindo, setSaindo] = useState(false);

  async function sair() {
    setSaindo(true);
    await supabaseNavegador().auth.signOut();
    // `refresh` derruba o cache do servidor antes de navegar; sem isso a
    // próxima tela ainda renderizaria com a sessão antiga.
    router.refresh();
    navegar();
    router.push("/");
  }

  if (tom === "claro") {
    return (
      <button
        type="button"
        disabled={saindo}
        onClick={sair}
        title="Sair da conta"
        className="rounded-full p-2 text-white/40 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
      >
        <Porta />
        <span className="sr-only">{saindo ? "Saindo…" : "Sair"}</span>
      </button>
    );
  }

  if (tom === "contorno") {
    return (
      <button
        type="button"
        disabled={saindo}
        onClick={sair}
        className="flex items-center gap-2 rounded-full border border-hairline px-5 py-2.5 text-[0.92rem] font-semibold text-ink transition-colors hover:border-vinho-200 hover:bg-vinho-50 hover:text-vinho-600 disabled:opacity-50"
      >
        <Porta />
        {saindo ? "Saindo…" : "Sair da conta"}
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={saindo}
      onClick={sair}
      className="rounded-full px-3 py-1.5 text-[0.9rem] font-medium text-muted transition-colors hover:bg-vinho-50 hover:text-vinho-600 disabled:opacity-50"
    >
      {saindo ? "Saindo…" : "Sair"}
    </button>
  );
}
