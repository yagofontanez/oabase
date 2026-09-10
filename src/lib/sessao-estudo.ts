export type ModoDaSessao = "continuo" | "pomodoro";
export type FaseDaSessao = "foco" | "pausa";

export type SessaoEmAndamento = {
  id: string;
  roadmapItemId: string;
  modo: ModoDaSessao;
  minutosPlanejados: number;
  segundosFoco: number;
  materiaisLidos: string[];
  checklist: Record<string, boolean>;
  anotacao: string;
  iniciadoEm: string;
};

export type ResultadoDaSessao = {
  segundosFoco: number;
  questoesRespondidas: number;
  acertos: number;
  materiaisLidos: number;
  blocoConcluido: boolean;
};

export function minutosDaSessao(valor: unknown, padrao = 50) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return padrao;
  return Math.min(360, Math.max(5, Math.round(numero)));
}
