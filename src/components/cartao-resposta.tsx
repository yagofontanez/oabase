"use client";
import { useState } from "react";
export type Grupo = {
  chave: string;
  nome: string;
  questoes: number;
  cor: string;
};

/**
 * O cartão-resposta: as 80 questões da prova, uma célula cada, agrupadas
 * por disciplina e ordenadas por incidência. Brilho é peso — as
 * disciplinas que dominam a prova acendem, a cauda longa recua.
 *
 * Não é ilustração: é a tese do produto. A prova tem uma forma, e a forma
 * se repete. Passar o mouse na legenda acende o bloco correspondente.
 */
export function CartaoResposta({ grupos }: { grupos: Grupo[] }) {
  const [ativo, setAtivo] = useState<string | null>(null);
  const celulas = grupos.flatMap((grupo) =>
    Array.from({ length: grupo.questoes }, () => grupo),
  );
  const total = celulas.length;
  const destaque = grupos
    .slice(0, -1)
    .reduce((soma, grupo) => soma + grupo.questoes, 0);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[0.84rem] font-semibold text-brand-200">
          Distribuição típica · 1ª fase
        </span>
        <span className="text-[0.84rem] tabular-nums text-brand-200/70">
          {total} questões
        </span>
      </div>

      <div
        className="oab-cartao"
        role="img"
        aria-label={`Distribuição das ${total} questões da primeira fase: ${grupos
          .map((g) => `${g.nome}, ${g.questoes}`)
          .join("; ")}.`}
      >
        {celulas.map((celula, i) => {
          const apagada = ativo !== null && ativo !== celula.chave;
          return (
            <span
              key={i}
              aria-hidden="true"
              className="aspect-square rounded-[3px] transition-[background-color,opacity] duration-300"
              style={
                {
                  backgroundColor:
                    ativo === celula.chave ? "#E9A23B" : celula.cor,
                  opacity: apagada ? 0.14 : 1,
                } as React.CSSProperties
              }
            />
          );
        })}
      </div>

      <ul className="mt-1 flex flex-col gap-px">
        {grupos.map((grupo) => {
          const apagado = ativo !== null && ativo !== grupo.chave;
          return (
            <li key={grupo.chave}>
              <button
                type="button"
                onMouseEnter={() => setAtivo(grupo.chave)}
                onMouseLeave={() => setAtivo(null)}
                onFocus={() => setAtivo(grupo.chave)}
                onBlur={() => setAtivo(null)}
                className="flex w-full items-center gap-3 rounded-lg px-2.5 py-[7px] text-left transition-opacity hover:bg-white/[0.05]"
                style={{ opacity: apagado ? 0.35 : 1 } as React.CSSProperties}
              >
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 shrink-0 rounded-[3px] transition-colors duration-300"
                  style={{
                    backgroundColor:
                      ativo === grupo.chave ? "#E9A23B" : grupo.cor,
                  }}
                />
                <span className="flex-1 text-[0.9rem] text-brand-100">
                  {grupo.nome}
                </span>
                <span className="text-[0.84rem] tabular-nums text-brand-200">
                  {grupo.questoes}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="border-t border-white/12 pt-5 text-[0.88rem] text-brand-200">
        Seis disciplinas respondem por{" "}
        <strong className="font-semibold text-ouro-400">
          {Math.round((destaque / total) * 100)}% da prova
        </strong>
        . Essa proporção quase não muda de uma edição para a outra.
      </p>
    </div>
  );
}
