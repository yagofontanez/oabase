import type { MetricasDaSemana } from "@/lib/revisao-semanal";
import type { EstadoDoRoadmap } from "@/lib/roadmap";

export type OpcaoDeAnotacao = {
  id: string;
  semana: number;
  disciplina: string;
  objetivo: string;
  anotacao: string;
};

export type OpcaoDeRevisao = {
  id: string;
  inicio: string;
  fim: string;
  compromisso: string;
};

export type LinkDoRoadmap = {
  id: string;
  titulo: string;
  versao: number;
  incluirProgresso: boolean;
  anotacoes: number;
  revisoes: number;
  expiraEm: string;
  revogadoEm: string | null;
  acessos: number;
  ultimoAcessoEm: string | null;
  criadoEm: string;
};

export type BlocoCompartilhado = {
  id: string;
  semana: number;
  ordem: number;
  disciplina: string;
  objetivo: string;
  horas: number;
  estado: EstadoDoRoadmap;
  anotacao: string | null;
  minutosFoco: number | null;
  questoesRespondidas: number | null;
  materiaisLidos: number | null;
};

export type RevisaoCompartilhada = {
  id: string;
  inicio: string;
  fim: string;
  metricas: MetricasDaSemana;
  reflexao: string;
  compromisso: string;
  acoes: string[];
  concluidaEm: string;
};

export type RoadmapCompartilhado = {
  titulo: string;
  versao: number;
  prazo: string | null;
  criadoEm: string;
  expiraEm: string;
  incluirProgresso: boolean;
  resumo: {
    blocos: number;
    concluidos: number;
    emAndamento: number;
    horasPlanejadas: number;
    minutosFoco: number | null;
    questoesRespondidas: number | null;
    materiaisLidos: number | null;
  };
  blocos: BlocoCompartilhado[];
  revisoes: RevisaoCompartilhada[];
};

/** Converte os nomes em snake_case devolvidos pela tabela para a tela. */
export function linkDaLinha(linha: Record<string, unknown>): LinkDoRoadmap {
  return {
    id: String(linha.id),
    titulo: String(linha.titulo),
    versao: Number(linha.versao),
    incluirProgresso: Boolean(linha.incluir_progresso),
    anotacoes: Array.isArray(linha.anotacoes_itens)
      ? linha.anotacoes_itens.length
      : 0,
    revisoes: Array.isArray(linha.revisoes_ids) ? linha.revisoes_ids.length : 0,
    expiraEm: String(linha.expira_em),
    revogadoEm: linha.revogado_em ? String(linha.revogado_em) : null,
    acessos: Number(linha.acessos),
    ultimoAcessoEm: linha.ultimo_acesso_em
      ? String(linha.ultimo_acesso_em)
      : null,
    criadoEm: String(linha.criado_em),
  };
}
