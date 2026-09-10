export type DisciplinaDaSemana = {
  nome: string;
  horasPlanejadas: number;
  minutosFoco: number;
  concluidos: number;
  pendentes: number;
};

export type RegistroDaSemana = {
  id: string;
  disciplina: string;
  minutos: number;
  resumo: string;
  pendencias: string;
  concluidoEm: string;
};

export type MetricasDaSemana = {
  inicio: string;
  fim: string;
  planejado: { horas: number; blocos: number };
  executado: { minutos: number; sessoes: number };
  roadmap: { concluidos: number; pendentes: number; emAndamento: number };
  questoes: { respondidas: number; acertos: number; taxa: number | null };
  revisoesVencidas: number;
  materiaisLidos: number;
  disciplinas: DisciplinaDaSemana[];
  registros: RegistroDaSemana[];
};

export type AcaoDaRevisao =
  | "reagendar_pendencias"
  | "reduzir_carga"
  | "priorizar_revisoes"
  | "praticar_questoes"
  | "retomar_materia"
  | "manter_ritmo";

export type SugestaoDaSemana = {
  id: AcaoDaRevisao;
  titulo: string;
  detalhe: string;
  href: string;
  rotuloDoLink: string;
  prioridade: "alta" | "media" | "positiva";
};

export type RevisaoSalva = {
  reflexao: string;
  compromisso: string;
  acoes: AcaoDaRevisao[];
};

export function sugestoesDaSemana(metricas: MetricasDaSemana) {
  const sugestoes: SugestaoDaSemana[] = [];
  const minutosPlanejados = metricas.planejado.horas * 60;
  const aderencia = minutosPlanejados
    ? metricas.executado.minutos / minutosPlanejados
    : 0;
  const negligenciadas = metricas.disciplinas.filter(
    (disciplina) =>
      disciplina.horasPlanejadas > 0 &&
      disciplina.minutosFoco === 0 &&
      disciplina.pendentes > 0,
  );

  if (metricas.roadmap.pendentes > 0) {
    sugestoes.push({
      id: "reagendar_pendencias",
      titulo: `Redistribuir ${metricas.roadmap.pendentes} ${metricas.roadmap.pendentes === 1 ? "bloco pendente" : "blocos pendentes"}`,
      detalhe:
        "Leve o que sobrou para dias reais da próxima semana sem apagar o progresso já registrado.",
      href: "/app/calendario",
      rotuloDoLink: "Abrir calendário",
      prioridade: "alta",
    });
  }

  if (minutosPlanejados > 0 && aderencia < 0.6) {
    sugestoes.push({
      id: "reduzir_carga",
      titulo: "Ajustar a carga para caber na rotina",
      detalhe: `Você executou ${Math.round(aderencia * 100)}% do tempo previsto. Um plano menor e cumprido informa mais do que uma meta grande acumulando atraso.`,
      href: "/app/roadmap",
      rotuloDoLink: "Replanejar roadmap",
      prioridade: "alta",
    });
  }

  if (metricas.revisoesVencidas > 0) {
    sugestoes.push({
      id: "priorizar_revisoes",
      titulo: "Começar pelas revisões vencidas",
      detalhe: `${metricas.revisoesVencidas} ${metricas.revisoesVencidas === 1 ? "questão está" : "questões estão"} no ponto de revisão. Resolva antes de abrir conteúdo novo.`,
      href: "/app/questoes?modo=revisao",
      rotuloDoLink: "Abrir revisões",
      prioridade: "media",
    });
  }

  if (metricas.questoes.respondidas < 5) {
    sugestoes.push({
      id: "praticar_questoes",
      titulo: "Criar uma amostra mínima de prática",
      detalhe:
        "Menos de cinco questões não sustentam uma leitura útil de desempenho. Faça uma fila curta antes de interpretar a taxa de acerto.",
      href: "/app/questoes?modo=novas",
      rotuloDoLink: "Resolver questões",
      prioridade: "media",
    });
  }

  if (negligenciadas.length > 0) {
    const nomes = negligenciadas
      .slice(0, 2)
      .map((disciplina) => disciplina.nome)
      .join(" e ");
    sugestoes.push({
      id: "retomar_materia",
      titulo: `Reservar um bloco para ${nomes}`,
      detalhe:
        "Havia carga prevista, mas nenhum foco foi registrado nessas matérias. Proteja um horário antes de distribuir o restante.",
      href: "/app/calendario",
      rotuloDoLink: "Reservar horário",
      prioridade: "alta",
    });
  }

  if (
    metricas.planejado.blocos > 0 &&
    metricas.roadmap.pendentes === 0 &&
    aderencia >= 0.75
  ) {
    sugestoes.push({
      id: "manter_ritmo",
      titulo: "Manter o desenho que funcionou",
      detalhe:
        "A semana fechou sem bloco pendente e com tempo compatível com o plano. Preserve os mesmos dias antes de aumentar a carga.",
      href: "/app/calendario",
      rotuloDoLink: "Ver próxima semana",
      prioridade: "positiva",
    });
  }

  return sugestoes.slice(0, 5);
}
