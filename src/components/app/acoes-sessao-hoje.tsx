"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { abrirWidgetFoco } from "@/components/app/widget-foco";
import { supabaseNavegador } from "@/lib/supabase/browser";
import type { EstadoDoRoadmap } from "@/lib/roadmap";
import { navegar } from "@/components/barra-de-navegacao";

export function AcoesSessaoHoje({
  itemId,
  estadoInicial,
  disciplinaSlug,
  minutos,
}: {
  itemId: string | null;
  estadoInicial: EstadoDoRoadmap | null;
  disciplinaSlug: string | null;
  minutos: number;
}) {
  const router = useRouter();
  const [estado, setEstado] = useState(estadoInicial);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  async function atualizar(proximo: EstadoDoRoadmap) {
    if (!itemId || salvando) return;
    const anterior = estado;
    const agora = new Date().toISOString();
    setEstado(proximo);
    setSalvando(true);
    setMensagem(null);
    const datas =
      proximo === "concluido"
        ? { ...(estado === "a_estudar" ? { iniciado_em: agora } : {}), concluido_em: agora }
        : proximo === "em_andamento"
          ? { iniciado_em: agora, concluido_em: null }
          : { iniciado_em: null, concluido_em: null };
    const { error } = await supabaseNavegador()
      .from("roadmap_itens")
      .update({ estado: proximo, ...datas, atualizado_em: agora })
      .eq("id", itemId);
    if (error) {
      setEstado(anterior);
      setMensagem("Não consegui atualizar o roadmap.");
    } else if (proximo === "concluido") {
      setMensagem("Bloco concluído. A próxima visita já trará o seguinte.");
    }
    setSalvando(false);
  }

  function iniciar() {
    if (itemId) {
      navegar();
      router.push(`/app/sessao/${itemId}?minutos=${minutos}`);
      return;
    }
    abrirWidgetFoco({ disciplina: disciplinaSlug ?? undefined, minutos });
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={iniciar}
          className="rounded-full bg-ouro-400 px-5 py-2.5 text-[0.9rem] font-bold text-noite transition-colors hover:bg-ouro-200"
        >
          Iniciar sessão de {minutos} min
        </button>
        {itemId && estado !== "concluido" && (
          <button
            type="button"
            onClick={() => void atualizar("concluido")}
            disabled={salvando}
            className="rounded-full border border-white/20 px-5 py-2.5 text-[0.9rem] font-semibold text-white transition-colors hover:border-white/40 hover:bg-white/10 disabled:opacity-50"
          >
            {salvando ? "Salvando…" : "Concluir bloco"}
          </button>
        )}
      </div>
      {mensagem && <p role="status" className="text-[0.78rem] text-white/65">{mensagem}</p>}
    </div>
  );
}
