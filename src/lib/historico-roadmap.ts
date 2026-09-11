export type OrigemDaVersao =
  | "ia"
  | "ementa"
  | "replanejamento"
  | "manual"
  | "legado";

export type VersaoDoRoadmap = {
  versao: number;
  origem: OrigemDaVersao;
  motivo: string;
  diagnostico: string;
  criadoEm: string;
  versaoAnterior: number | null;
  vigente: boolean;
  blocos: number;
  concluidos: number;
  emAndamento: number;
  horasPlanejadas: number;
  minutosFoco: number;
  questoesRespondidas: number;
  materiaisLidos: number;
  metas: number;
  metasConcluidas: number;
};

export function versaoDaLinha(linha: Record<string, unknown>): VersaoDoRoadmap {
  return {
    versao: Number(linha.versao),
    origem: linha.origem as OrigemDaVersao,
    motivo: String(linha.motivo),
    diagnostico: String(linha.diagnostico ?? ""),
    criadoEm: String(linha.criado_em),
    versaoAnterior:
      linha.versao_anterior === null ? null : Number(linha.versao_anterior),
    vigente: Boolean(linha.vigente),
    blocos: Number(linha.blocos),
    concluidos: Number(linha.concluidos),
    emAndamento: Number(linha.em_andamento),
    horasPlanejadas: Number(linha.horas_planejadas),
    minutosFoco: Number(linha.minutos_foco),
    questoesRespondidas: Number(linha.questoes_respondidas),
    materiaisLidos: Number(linha.materiais_lidos),
    metas: Number(linha.metas),
    metasConcluidas: Number(linha.metas_concluidas),
  };
}

export const ROTULOS_DA_ORIGEM: Record<OrigemDaVersao, string> = {
  ia: "Ajuste por conversa",
  ementa: "Importação de ementa",
  replanejamento: "Replanejamento",
  manual: "Criação manual",
  legado: "Versão preservada",
};
