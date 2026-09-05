"use client";
import { useEffect, useState } from "react";
type Restante = {
  dias: number;
  horas: number;
  minutos: number;
  segundos: number;
};
function calcular(alvoISO: string, agora: number): Restante {
  const [ano, mes, dia] = alvoISO.split("-").map(Number);
  // A prova começa às 13h no horário de Brasília (UTC-3).
  const alvo = Date.UTC(ano, mes - 1, dia, 16, 0, 0);
  const restante = Math.max(0, alvo - agora);
  return {
    dias: Math.floor(restante / 86_400_000),
    horas: Math.floor(restante / 3_600_000) % 24,
    minutos: Math.floor(restante / 60_000) % 60,
    segundos: Math.floor(restante / 1_000) % 60,
  };
}
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Contagem regressiva até a prova.
 *
 * Herda a cor do contexto de propósito: o mesmo relógio aparece sobre
 * branco, sobre o plano escuro e dentro da moldura de conta. Cor fixa aqui
 * já custou um número branco sobre fundo branco.
 *
 * O servidor entrega só os dias (número estável, sem risco de divergir na
 * hidratação); o relógio ao vivo entra depois que o componente monta. Para
 * quem tem a data marcada na cabeça, esse número é a informação mais
 * relevante da página inteira.
 */
export function Contagem({ dataISO, dias }: { dataISO: string; dias: number }) {
  // `agora` começa nulo e só o intervalo o atualiza: a regra do React
  // proíbe setState síncrono no corpo do effect, e o primeiro quadro — com
  // `agora === null` — renderiza o mesmo `Xd` que o servidor mandou.
  const [agora, setAgora] = useState<number | null>(null);

  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (agora === null) {
    return (
      <span className="tabular-nums" aria-live="off">
        {dias}
        <span className="opacity-55">d</span>
      </span>
    );
  }
  const restante = calcular(dataISO, agora);
  return (
    <span className="tabular-nums" aria-live="off">
      {restante.dias}
      <span className="opacity-55">d</span> {pad(restante.horas)}
      <span className="opacity-55">h</span> {pad(restante.minutos)}
      <span className="opacity-55">m</span> {pad(restante.segundos)}
      <span className="opacity-55">s</span>
    </span>
  );
}
