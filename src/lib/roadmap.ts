import type { Plano } from "@/lib/ia/plano";

export type EstadoDoRoadmap = "a_estudar" | "em_andamento" | "concluido";

export type ItemRoadmap = {
  id: string;
  semana: number;
  ordem: number;
  disciplina: string;
  objetivo: string;
  horas: number;
  estado: EstadoDoRoadmap;
};

/**
 * A IA só propõe a sequência; cada bloco vira uma linha própria no banco.
 * Progresso não cabe dentro do JSON do plano: uma revisão do cronograma não
 * pode apagar o que a pessoa marcou como estudado.
 */
export function blocosDoPlano(plano: Plano) {
  return plano.semanas.flatMap((semana) =>
    semana.blocos.map((bloco, ordem) => ({
      semana: semana.numero,
      ordem,
      disciplina: bloco.disciplina,
      objetivo: bloco.objetivo,
      horas: bloco.horas,
    })),
  );
}
