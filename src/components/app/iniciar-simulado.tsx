"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/browser";

export type OpcaoDeSimulado = {
  chave: string;
  titulo: string;
  texto: string;
  exame: string | null;
  total: number;
  minutos: number;
};

/**
 * Começa a prova.
 *
 * A criação passa por `criar_simulado`, que é `security invoker` — a RLS de
 * `questoes` continua exigindo assinatura ativa, e um simulado sem questões
 * não chega a nascer. Aqui só se traduz o erro do banco para o português de
 * quem está olhando.
 */
export function IniciarSimulado({ opcoes }: { opcoes: OpcaoDeSimulado[] }) {
  const router = useRouter();
  const [criando, setCriando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function comecar(opcao: OpcaoDeSimulado) {
    if (criando) return;
    setCriando(opcao.chave);
    setErro(null);

    const { data, error } = await supabaseNavegador().rpc("criar_simulado", {
      p_exame: opcao.exame,
      p_total: opcao.total,
      p_minutos: opcao.minutos,
    });

    if (error) {
      setErro(
        error.code === "55006"
          ? "Você já tem um simulado em andamento. Termine ou entregue antes de começar outro."
          : error.code === "42501"
            ? "Seu plano não está ativo."
            : "Não consegui começar o simulado. Tente de novo.",
      );
      setCriando(null);
      return;
    }

    router.push(`/app/simulado/${data as string}`);
  }

  return (
    <div className="flex flex-col gap-4">
      {erro && (
        <p
          role="alert"
          className="rounded-[14px] bg-vinho-50 px-5 py-3 text-[0.9rem] text-vinho-700"
        >
          {erro}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {opcoes.map((opcao) => (
          <button
            key={opcao.chave}
            type="button"
            disabled={criando !== null}
            onClick={() => comecar(opcao)}
            className="superficie group flex flex-col gap-2 p-6 text-left transition-colors hover:border-brand-200 disabled:opacity-60"
          >
            <span className="flex items-center gap-2 font-semibold text-ink">
              {opcao.titulo}
              <span className="text-brand-500 opacity-40 transition-all group-hover:translate-x-0.5 group-hover:opacity-100">
                →
              </span>
            </span>
            <span className="text-[0.92rem] text-muted">{opcao.texto}</span>
            <span className="mt-1 text-[0.84rem] font-semibold text-brand-700 tabular-nums">
              {criando === opcao.chave
                ? "Montando…"
                : `${opcao.total} questões · ${
                    opcao.minutos >= 60
                      ? `${Math.floor(opcao.minutos / 60)}h${
                          opcao.minutos % 60
                            ? String(opcao.minutos % 60).padStart(2, "0")
                            : ""
                        }`
                      : `${opcao.minutos} min`
                  }`}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
