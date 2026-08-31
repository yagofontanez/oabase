"use client";

import { useState } from "react";

export type DiaDeFoco = { dia: string; rotulo: string; diaDaSemana: string; minutos: number };

function horas(minutos: number) {
  if (minutos === 0) return "sem foco";
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

/**
 * Foco por dia nos últimos 14 dias.
 *
 * Série única, então a cor não carrega identidade — o comprimento da barra já
 * codifica a magnitude. Um só tom da marca, que é o único da paleta com
 * contraste suficiente sobre superfície clara; o âmbar aparece apenas como
 * anotação do dia de hoje, sempre acompanhado de rótulo.
 *
 * A tabela para leitor de tela existe porque barra sem número é inacessível
 * por definição, e o valor só aparece no hover.
 */
export function GraficoFoco({ dias }: { dias: DiaDeFoco[] }) {
  const [ativo, setAtivo] = useState<number | null>(null);

  const maximo = Math.max(30, ...dias.map((d) => d.minutos));
  const total = dias.reduce((s, d) => s + d.minutos, 0);
  const comFoco = dias.filter((d) => d.minutos > 0).length;
  const media = comFoco > 0 ? Math.round(total / comFoco) : 0;
  const hoje = dias.length - 1;

  return (
    <figure className="superficie flex flex-col gap-5 p-6">
      <figcaption className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-[1.15rem] font-bold text-ink">
            Foco nos últimos 14 dias
          </h2>
          <p className="text-[0.88rem] text-muted">
            {comFoco === 0
              ? "Nenhum bloco concluído ainda"
              : `${comFoco} ${comFoco === 1 ? "dia" : "dias"} com estudo · média de ${horas(media)} nos dias ativos`}
          </p>
        </div>
        {total > 0 && (
          <span className="text-[0.9rem] font-semibold text-brand-700 tabular-nums">
            {horas(total)} no total
          </span>
        )}
      </figcaption>

      <div className="relative">
        {/* Régua da média, só quando há base para calcular. */}
        {media > 0 && (
          <div
            className="pointer-events-none absolute inset-x-0 flex items-center"
            style={{ bottom: `${(media / maximo) * 100}%` }}
          >
            <div className="h-px flex-1 border-t border-dashed border-hairline" />
            <span className="ml-2 shrink-0 text-[0.72rem] text-muted">
              média
            </span>
          </div>
        )}

        <div className="flex h-[150px] items-end gap-[2px]">
          {dias.map((d, i) => {
            const altura = maximo > 0 ? (d.minutos / maximo) * 100 : 0;
            const vazio = d.minutos === 0;
            return (
              <div
                key={d.dia}
                className="group relative flex h-full flex-1 items-end"
                onMouseEnter={() => setAtivo(i)}
                onMouseLeave={() => setAtivo(null)}
              >
                {/* Trilho: mantém o dia clicável e legível mesmo em zero. */}
                <div className="absolute inset-x-0 bottom-0 h-full rounded-[4px] bg-sunk/60 transition-colors group-hover:bg-sunk" />
                <div
                  className={`relative w-full rounded-t-[4px] transition-colors ${
                    vazio ? "bg-hairline" : "bg-brand-500 group-hover:bg-brand-600"
                  }`}
                  style={{ height: vazio ? "3px" : `${Math.max(altura, 4)}%` }}
                />

                {ativo === i && (
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 rounded-[10px] bg-ink px-3 py-2 text-center whitespace-nowrap text-white shadow-[var(--shadow-media)]">
                    <span className="block text-[0.75rem] text-white/60">
                      {d.rotulo}
                    </span>
                    <span className="block text-[0.9rem] font-semibold tabular-nums">
                      {horas(d.minutos)}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-2 flex gap-[2px]">
          {dias.map((d, i) => (
            <span
              key={d.dia}
              className={`flex-1 text-center text-[0.7rem] ${
                i === hoje ? "font-semibold text-ouro-700" : "text-muted"
              }`}
            >
              {i === hoje ? "hoje" : i % 2 === 0 ? d.diaDaSemana : ""}
            </span>
          ))}
        </div>
      </div>

      {/* O invólucro importa: `sr-only` aplicado direto na tabela não contém
          o `<caption>`, que escapa do recorte e aparece por cima do título. */}
      <div className="sr-only">
        <table>
          <caption>Minutos de foco por dia nos últimos 14 dias</caption>
          <tbody>
            {dias.map((d) => (
              <tr key={d.dia}>
                <th scope="row">{d.rotulo}</th>
                <td>{d.minutos} minutos</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
