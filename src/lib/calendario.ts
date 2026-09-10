import type { EstadoDoRoadmap } from "@/lib/roadmap";

const DIA_MS = 86_400_000;

export type PreferenciasDoCalendario = {
  diasIndisponiveis: number[];
  datasIndisponiveis: string[];
  horarioPreferido: string;
  lembreteEmail: boolean;
};

export type ItemDoCalendario = {
  id: string;
  semana: number;
  ordem: number;
  disciplina: string;
  objetivo: string;
  horas: number;
  estado: EstadoDoRoadmap;
  dataPlanejada: string | null;
  horarioPlanejado: string | null;
  concluidoEm: string | null;
};

export type AtualizacaoDoCalendario = {
  id: string;
  dataPlanejada: string;
  horarioPlanejado: string;
};

export function hojeEmBrasilia(agora = new Date()) {
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

export function dataUtc(data: string) {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

export function adicionarDias(data: string, quantidade: number) {
  return new Date(dataUtc(data).getTime() + quantidade * DIA_MS)
    .toISOString()
    .slice(0, 10);
}

export function inicioDaSemana(data: string) {
  const dia = dataUtc(data).getUTCDay();
  return adicionarDias(data, dia === 0 ? -6 : 1 - dia);
}

export function fimDaSemana(data: string) {
  return adicionarDias(inicioDaSemana(data), 6);
}

export function inicioDoMes(data: string) {
  return `${data.slice(0, 7)}-01`;
}

export function fimDoMes(data: string) {
  const [ano, mes] = data.split("-").map(Number);
  return new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);
}

export function intervaloDeDatas(inicio: string, fim: string) {
  const datas: string[] = [];
  for (let atual = inicio; atual <= fim; atual = adicionarDias(atual, 1)) {
    datas.push(atual);
  }
  return datas;
}

export function diaIndisponivel(
  data: string,
  preferencias: PreferenciasDoCalendario,
) {
  return (
    preferencias.diasIndisponiveis.includes(dataUtc(data).getUTCDay()) ||
    preferencias.datasIndisponiveis.includes(data)
  );
}

function proximoDiaDisponivel(
  data: string,
  preferencias: PreferenciasDoCalendario,
) {
  let atual = data;
  for (let tentativas = 0; tentativas < 370; tentativas += 1) {
    if (!diaIndisponivel(atual, preferencias)) return atual;
    atual = adicionarDias(atual, 1);
  }
  throw new Error("Não há dias disponíveis no calendário.");
}

function escolherDiaMaisLeve(
  inicio: string,
  fim: string,
  preferencias: PreferenciasDoCalendario,
  carga: Map<string, number>,
) {
  const disponiveis = intervaloDeDatas(inicio, fim).filter(
    (data) => !diaIndisponivel(data, preferencias),
  );
  if (disponiveis.length === 0) {
    return proximoDiaDisponivel(adicionarDias(fim, 1), preferencias);
  }
  return disponiveis.sort((a, b) => {
    const diferenca = (carga.get(a) ?? 0) - (carga.get(b) ?? 0);
    return diferenca || a.localeCompare(b);
  })[0];
}

/**
 * Distribui blocos sem mudar semana, ordem, conteúdo ou estado. O algoritmo
 * apenas escolhe o dia menos carregado dentro da semana correspondente do
 * roadmap; dias explicitamente indisponíveis são pulados.
 */
export function distribuirRoadmapNoCalendario({
  itens,
  preferencias,
  inicio,
  somente,
}: {
  itens: ItemDoCalendario[];
  preferencias: PreferenciasDoCalendario;
  inicio: string;
  somente?: Set<string>;
}): AtualizacaoDoCalendario[] {
  const base = inicioDaSemana(inicio);
  const carga = new Map<string, number>();
  for (const item of itens) {
    if (
      item.estado !== "concluido" &&
      item.dataPlanejada &&
      somente &&
      !somente.has(item.id)
    ) {
      carga.set(
        item.dataPlanejada,
        (carga.get(item.dataPlanejada) ?? 0) + item.horas,
      );
    }
  }

  const candidatos = itens
    .filter((item) => item.estado !== "concluido")
    .filter((item) => !somente || somente.has(item.id))
    .sort((a, b) => a.semana - b.semana || a.ordem - b.ordem);

  return candidatos.map((item) => {
    const inicioDaFaixa = [
      inicio,
      adicionarDias(base, (Math.max(1, item.semana) - 1) * 7),
    ].sort().at(-1)!;
    const fimDaFaixa = adicionarDias(
      base,
      (Math.max(1, item.semana) - 1) * 7 + 6,
    );
    const dataPlanejada = escolherDiaMaisLeve(
      inicioDaFaixa,
      fimDaFaixa < inicioDaFaixa ? inicioDaFaixa : fimDaFaixa,
      preferencias,
      carga,
    );
    carga.set(dataPlanejada, (carga.get(dataPlanejada) ?? 0) + item.horas);
    return {
      id: item.id,
      dataPlanejada,
      horarioPlanejado: preferencias.horarioPreferido,
    };
  });
}

/** Pendências vencidas e itens ainda sem data entram novamente a partir de hoje. */
export function itensParaReagendar(itens: ItemDoCalendario[], hoje: string) {
  return new Set(
    itens
      .filter((item) => item.estado !== "concluido")
      .filter(
        (item) => !item.dataPlanejada || item.dataPlanejada < hoje,
      )
      .map((item) => item.id),
  );
}
