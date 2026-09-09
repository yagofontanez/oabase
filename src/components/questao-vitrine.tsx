"use client";
import { useState } from "react";
import { questaoVitrine as q } from "@/lib/content/vitrine";
const LETRAS = ["A", "B", "C", "D"] as const;

/**
 * O produto, jogável.
 *
 * Superfície branca elevada, com o enunciado na serifa — porque enunciado é
 * texto normativo, e nesta página a serifa só aparece onde há Direito. A
 * resposta muda a alternativa por cor e por elevação, não por moldura
 * grossa: o cartão continua leve depois de respondido.
 */
export function QuestaoVitrine() {
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const respondida = escolhida !== null;
  const acertou = escolhida === q.gabarito;
  return (
    <div className="superficie-alta overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line bg-brand-50/70 px-6 py-3.5">
        <span className="text-[0.86rem] font-semibold text-brand-700">
          {q.exame}º Exame · questão {q.numero}
        </span>
        <span className="text-[0.82rem] text-brand-600/70">{q.disciplina}</span>
      </div>

      <div className="flex flex-col gap-4 p-6 sm:p-7">
        <p className="lei-texto">{q.enunciado}</p>

        <ul className="flex flex-col gap-1.5">
          {LETRAS.map((letra) => {
            const correta = letra === q.gabarito;
            const escolhidaEsta = escolhida === letra;
            let linha =
              "border-line bg-surface hover:border-brand-200 hover:bg-brand-50/50";
            let selo = "bg-sunk text-body";
            if (respondida) {
              if (correta) {
                linha = "border-brand-300 bg-brand-50";
                selo = "bg-brand-500 text-white";
              } else if (escolhidaEsta) {
                linha = "border-vinho-200 bg-vinho-50";
                selo = "bg-vinho-500 text-white";
              } else {
                linha = "border-line bg-surface opacity-45";
              }
            }
            return (
              <li key={letra}>
                <button
                  type="button"
                  disabled={respondida}
                  onClick={() => setEscolhida(letra)}
                  aria-pressed={escolhidaEsta}
                  className={`flex w-full items-start gap-3 rounded-[12px] border px-4 py-3 text-left transition-all duration-300 disabled:cursor-default ${linha}`}
                >
                  <span
                    className={`mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.76rem] font-bold transition-colors duration-300 ${selo}`}
                  >
                    {letra}
                  </span>
                  <span className="text-[0.9rem] leading-relaxed text-body">
                    {q.alternativas[letra]}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {/* O comentário é o produto de verdade — por isso ganha destaque, e não só a marcação de certo ou errado. */}
        <div
          className={`grid transition-all duration-500 ease-out ${
            respondida
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="overflow-hidden">
            <div className="rounded-[16px] border border-brand-100 bg-white p-5 shadow-[0_12px_25px_-22px_rgba(7,59,51,0.5)] sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line pb-3">
                <span className="text-[0.74rem] font-bold tracking-[0.12em] text-brand-700 uppercase">
                  Entenda a resposta
                </span>
                <p className="text-[0.85rem] font-semibold">
                <span className={acertou ? "text-brand-600" : "text-vinho-500"}>
                  {acertou
                    ? "Você acertou."
                    : `Resposta correta: ${q.gabarito}.`}
                </span>{" "}
                <span className="font-normal text-muted">
                  Gabarito definitivo da FGV.
                </span>
                </p>
              </div>
              <div className="mt-4 border-l-2 border-ouro-400 pl-4 sm:pl-5">
              <p
                className="comentario text-[1rem] leading-[1.78] text-ink"
                dangerouslySetInnerHTML={{
                  __html: q.comentario.replace(
                    /\*\*(.+?)\*\*/g,
                    "<strong>$1</strong>",
                  ),
                }}
              />
              </div>
            </div>
          </div>
        </div>

        {!respondida && (
          <p className="text-center text-[0.85rem] text-muted">
            Escolha uma alternativa para ver o gabarito e o comentário
          </p>
        )}
      </div>
    </div>
  );
}
