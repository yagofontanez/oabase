import type { Plano, SemanaDoPlano } from "@/lib/ia/plano";
import type { EstadoDoRoadmap, ItemRoadmap } from "@/lib/roadmap";

const DIA_EM_MS = 86_400_000;
const MAXIMO_DE_SEMANAS = 52;

export type ItemParaReplanejar = ItemRoadmap & {
  iniciadoEm: string | null;
  concluidoEm: string | null;
};

export type DiagnosticoDoReplanejamento = {
  sugerido: boolean;
  semanaAtual: number;
  atrasados: number;
  emAndamento: number;
  concluidos: number;
  pendentes: number;
  horasPendentes: number;
  horasPlanejadasAteAgora: number;
  minutosDeFocoRegistrados: number;
  horasPorSemana: number;
  prazo: string | null;
  diasAtePrazo: number | null;
};

export type ItemProposto = {
  origemItemId: string | null;
  semana: number;
  ordem: number;
  disciplina: string;
  objetivo: string;
  horas: number;
  estado: EstadoDoRoadmap;
  anotacao: string;
  iniciadoEm: string | null;
  concluidoEm: string | null;
};

export type ResumoDaSemanaReplanejada = {
  numero: number;
  horas: number;
  blocos: number;
  disciplinas: string[];
};

export type PropostaDeReplanejamento = {
  plano: Plano;
  itens: ItemProposto[];
  resumo: {
    blocosRedistribuidos: number;
    blocosPreservados: number;
    horasPendentes: number;
    horasPorSemana: number;
    semanasNecessarias: number;
    conclusaoPrevista: string;
    prazo: string | null;
    semanas: ResumoDaSemanaReplanejada[];
    avisos: string[];
  };
};

function arredondar(valor: number) {
  return Math.round(valor * 100) / 100;
}

function hojeEmBrasilia(agora = new Date()) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(agora);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((parte) => parte.type === tipo)?.value ?? "";
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

function dataUtc(data: string) {
  const [ano, mes, dia] = data.split("-").map(Number);
  return Date.UTC(ano, mes - 1, dia);
}

function diferencaEmDias(inicio: string, fim: string) {
  return Math.floor((dataUtc(fim) - dataUtc(inicio)) / DIA_EM_MS);
}

function adicionarDias(data: string, dias: number) {
  const instante = new Date(dataUtc(data) + dias * DIA_EM_MS);
  return instante.toISOString().slice(0, 10);
}

function dataEmPtBr(data: string) {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

function dataDoInstanteEmBrasilia(instante: string) {
  return hojeEmBrasilia(new Date(instante));
}

export function diagnosticarReplanejamento({
  itens,
  plano,
  atualizadoEm,
  minutosDeFocoRegistrados,
  prazo,
  agora,
}: {
  itens: ItemParaReplanejar[];
  plano: Plano;
  atualizadoEm: string;
  minutosDeFocoRegistrados: number;
  prazo: string | null;
  agora?: Date;
}): DiagnosticoDoReplanejamento {
  const hoje = hojeEmBrasilia(agora);
  const inicio = dataDoInstanteEmBrasilia(atualizadoEm);
  const diasDesdePlano = Math.max(0, diferencaEmDias(inicio, hoje));
  const semanaAtual = Math.floor(diasDesdePlano / 7) + 1;
  const atrasados = itens.filter(
    (item) => item.estado !== "concluido" && item.semana < semanaAtual,
  );
  const concluidos = itens.filter((item) => item.estado === "concluido").length;
  const emAndamento = itens.filter(
    (item) => item.estado === "em_andamento",
  ).length;
  const pendentes = itens.length - concluidos;
  const horasPendentes = itens
    .filter((item) => item.estado !== "concluido")
    .reduce((total, item) => total + Number(item.horas), 0);
  const horasPlanejadasAteAgora = itens
    .filter((item) => item.semana < semanaAtual)
    .reduce((total, item) => total + Number(item.horas), 0);
  const diasAtePrazo = prazo ? diferencaEmDias(hoje, prazo) : null;
  const semanasRestantesNoPlano = itens
    .filter((item) => item.estado !== "concluido")
    .reduce((maior, item) => Math.max(maior, item.semana - semanaAtual + 1), 0);
  const semanasAtePrazo =
    diasAtePrazo === null ? null : Math.max(1, Math.ceil(diasAtePrazo / 7));
  const ultrapassaPrazo =
    semanasAtePrazo !== null && semanasRestantesNoPlano > semanasAtePrazo;

  return {
    sugerido: atrasados.length > 0 || ultrapassaPrazo,
    semanaAtual,
    atrasados: atrasados.length,
    emAndamento,
    concluidos,
    pendentes,
    horasPendentes: arredondar(horasPendentes),
    horasPlanejadasAteAgora: arredondar(horasPlanejadasAteAgora),
    minutosDeFocoRegistrados,
    horasPorSemana: plano.horasPorSemana,
    prazo,
    diasAtePrazo,
  };
}

function focoDaSemana(itens: ItemProposto[], numero: number) {
  const nomes = [
    ...new Set(
      itens
        .filter(
          (item) => item.semana === numero && item.estado !== "concluido",
        )
        .map((item) => item.disciplina),
    ),
  ];
  return (nomes.slice(0, 2).join(" + ") || "Retomada do plano").slice(0, 90);
}

function semanasDoPlano(itens: ItemProposto[]): SemanaDoPlano[] {
  const numeros = [
    ...new Set(
      itens
        .filter((item) => item.estado !== "concluido")
        .map((item) => item.semana),
    ),
  ].sort((a, b) => a - b);
  return numeros.map((numero) => ({
    numero,
    foco: focoDaSemana(itens, numero),
    blocos: itens
      .filter((item) => item.semana === numero && item.estado !== "concluido")
      .sort((a, b) => a.ordem - b.ordem)
      .map((item) => ({
        disciplina: item.disciplina,
        objetivo: item.objetivo,
        horas: item.horas,
      })),
  }));
}

export function montarPropostaDeReplanejamento({
  itens,
  planoAtual,
  horasPorSemana,
  prazo,
  hoje = hojeEmBrasilia(),
}: {
  itens: ItemParaReplanejar[];
  planoAtual: Plano;
  horasPorSemana: number;
  prazo: string | null;
  hoje?: string;
}): PropostaDeReplanejamento {
  const concluidos = itens
    .filter((item) => item.estado === "concluido")
    .sort((a, b) => a.semana - b.semana || a.ordem - b.ordem);
  const pendentes = itens
    .filter((item) => item.estado !== "concluido")
    .sort((a, b) => {
      if (a.estado === "em_andamento" && b.estado !== "em_andamento") return -1;
      if (b.estado === "em_andamento" && a.estado !== "em_andamento") return 1;
      return a.semana - b.semana || a.ordem - b.ordem;
    });
  if (pendentes.length === 0) {
    throw new Error("O roadmap já está concluído.");
  }

  const propostos: ItemProposto[] = [];
  const ordemPorSemana = new Map<number, number>();
  let semana = 1;
  let horasNaSemana = 0;
  let blocosRedistribuidos = 0;

  const proximaOrdem = (numero: number) => {
    const ordem = ordemPorSemana.get(numero) ?? 0;
    ordemPorSemana.set(numero, ordem + 1);
    return ordem;
  };

  for (const item of pendentes) {
    let horasRestantes = arredondar(Number(item.horas));
    const partes: ItemProposto[] = [];
    while (horasRestantes > 0) {
      if (semana > MAXIMO_DE_SEMANAS) {
        throw new Error(
          `Com ${horasPorSemana}h por semana, o plano ultrapassaria um ano. Aumente a disponibilidade.`,
        );
      }
      const capacidade = arredondar(horasPorSemana - horasNaSemana);
      if (capacidade <= 0) {
        semana += 1;
        horasNaSemana = 0;
        continue;
      }
      const horasDaParte = arredondar(Math.min(horasRestantes, capacidade));
      partes.push({
        origemItemId: partes.length === 0 ? item.id : null,
        semana,
        ordem: proximaOrdem(semana),
        disciplina: item.disciplina,
        objetivo: item.objetivo,
        horas: horasDaParte,
        estado: partes.length === 0 ? item.estado : "a_estudar",
        anotacao: partes.length === 0 ? (item.anotacao ?? "") : "",
        iniciadoEm: partes.length === 0 ? item.iniciadoEm : null,
        concluidoEm: null,
      });
      horasNaSemana = arredondar(horasNaSemana + horasDaParte);
      horasRestantes = arredondar(horasRestantes - horasDaParte);
      if (horasNaSemana >= horasPorSemana) {
        semana += 1;
        horasNaSemana = 0;
      }
    }
    if (partes.length > 1) {
      blocosRedistribuidos += partes.length - 1;
      partes.forEach((parte, indice) => {
        parte.objetivo = `${item.objetivo} · parte ${indice + 1}/${partes.length}`.slice(
          0,
          220,
        );
      });
    }
    propostos.push(...partes);
  }

  // Conclusões continuam visíveis na versão vigente, mas não consomem a
  // capacidade futura. A versão anterior também permanece intacta no banco.
  for (const item of concluidos) {
    propostos.push({
      origemItemId: item.id,
      semana: 1,
      ordem: proximaOrdem(1),
      disciplina: item.disciplina,
      objetivo: item.objetivo,
      horas: Number(item.horas),
      estado: "concluido",
      anotacao: item.anotacao ?? "",
      iniciadoEm: item.iniciadoEm,
      concluidoEm: item.concluidoEm,
    });
  }

  propostos.sort((a, b) => a.semana - b.semana || a.ordem - b.ordem);
  const semanas = semanasDoPlano(propostos);
  const semanasNecessarias = Math.max(...semanas.map((item) => item.numero));
  const conclusaoPrevista = adicionarDias(hoje, semanasNecessarias * 7 - 1);
  const avisos: string[] = [];
  if (blocosRedistribuidos > 0) {
    avisos.push(
      `${blocosRedistribuidos} ${blocosRedistribuidos === 1 ? "continuação foi criada" : "continuações foram criadas"} para respeitar o limite semanal.`,
    );
  }
  if (prazo && conclusaoPrevista > prazo) {
    avisos.push(
      `Com essa disponibilidade, a conclusão prevista fica depois do prazo de ${dataEmPtBr(prazo)}.`,
    );
  }
  const plano: Plano = {
    ...planoAtual,
    diagnostico: `O que ainda falta foi redistribuído em ${semanasNecessarias} ${semanasNecessarias === 1 ? "semana" : "semanas"}, com limite de ${horasPorSemana}h semanais. O progresso já registrado foi preservado.`,
    horasPorSemana,
    semanas,
    avisos: [...avisos, ...planoAtual.avisos].slice(0, 4),
  };
  const resumoSemanas = semanas.map((item) => {
    const blocos = propostos.filter(
      (proposto) =>
        proposto.semana === item.numero && proposto.estado !== "concluido",
    );
    return {
      numero: item.numero,
      horas: arredondar(
        blocos.reduce((total, bloco) => total + bloco.horas, 0),
      ),
      blocos: blocos.length,
      disciplinas: [...new Set(blocos.map((bloco) => bloco.disciplina))],
    };
  });

  return {
    plano,
    itens: propostos,
    resumo: {
      blocosRedistribuidos: pendentes.length,
      blocosPreservados: concluidos.length,
      horasPendentes: arredondar(
        pendentes.reduce((total, item) => total + Number(item.horas), 0),
      ),
      horasPorSemana,
      semanasNecessarias,
      conclusaoPrevista,
      prazo,
      semanas: resumoSemanas,
      avisos,
    },
  };
}
