"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/browser";

export function BotaoSair() {
  const router = useRouter();
  const [saindo, setSaindo] = useState(false);

  return (
    <button
      type="button"
      disabled={saindo}
      onClick={async () => {
        setSaindo(true);
        await supabaseNavegador().auth.signOut();
        // `refresh` derruba o cache do servidor antes de navegar; sem isso a
        // próxima tela ainda renderizaria com a sessão antiga.
        router.refresh();
        router.push("/");
      }}
      className="rounded-full px-3 py-1.5 text-[0.9rem] font-medium text-muted transition-colors hover:bg-vinho-50 hover:text-vinho-600 disabled:opacity-50"
    >
      {saindo ? "Saindo…" : "Sair"}
    </button>
  );
}
