export type TipoDeMetaDoRoadmap =
  | "leitura"
  | "questoes"
  | "foco"
  | "resumo"
  | "anotacoes"
  | "subtopicos";

export type SubtopicoDaMeta = {
  id: string;
  texto: string;
  concluido: boolean;
};

export type MetaDoRoadmap = {
  id: string;
  tipo: TipoDeMetaDoRoadmap;
  titulo: string;
  alvo: number;
  progresso: number;
  automatico: boolean;
  criadoEm: string;
  subtopicos: SubtopicoDaMeta[];
};

export type ResumoDeMetasDoBloco = {
  total: number;
  concluidas: number;
  percentual: number;
};

export const TIPOS_DE_META: {
  id: TipoDeMetaDoRoadmap;
  titulo: string;
  descricao: string;
  unidade: string;
  alvoPadrao: number;
  automatico: boolean;
}[] = [
  {
    id: "leitura",
    titulo: "Leitura de artigos",
    descricao: "Conta materiais marcados como lidos nas sessões deste bloco.",
    unidade: "artigos",
    alvoPadrao: 4,
    automatico: true,
  },
  {
    id: "questoes",
    titulo: "Questões resolvidas",
    descricao: "Conta somente respostas realmente registradas durante as sessões.",
    unidade: "questões",
    alvoPadrao: 20,
    automatico: true,
  },
  {
    id: "foco",
    titulo: "Tempo de foco",
    descricao: "Soma os minutos cronometrados nas sessões guiadas do bloco.",
    unidade: "minutos",
    alvoPadrao: 90,
    automatico: true,
  },
  {
    id: "resumo",
    titulo: "Resumos de sessão",
    descricao: "Avança quando uma sessão termina com uma síntese escrita.",
    unidade: "resumos",
    alvoPadrao: 1,
    automatico: true,
  },
  {
    id: "anotacoes",
    titulo: "Revisar anotações",
    descricao: "Você registra cada revisão, pois leitura atenta não pode ser inferida.",
    unidade: "revisões",
    alvoPadrao: 1,
    automatico: false,
  },
  {
    id: "subtopicos",
    titulo: "Checklist de subtópicos",
    descricao: "Quebre o objetivo em entregas próprias e marque uma por uma.",
    unidade: "subtópicos",
    alvoPadrao: 1,
    automatico: false,
  },
];

export function configuracaoDaMeta(tipo: TipoDeMetaDoRoadmap) {
  return TIPOS_DE_META.find((item) => item.id === tipo) ?? TIPOS_DE_META[0];
}

export function metaDaLinha(linha: Record<string, unknown>): MetaDoRoadmap {
  const subtopicos = Array.isArray(linha.subtopicos)
    ? linha.subtopicos
        .filter(
          (item): item is Record<string, unknown> =>
            Boolean(item) && typeof item === "object" && !Array.isArray(item),
        )
        .map((item) => ({
          id: String(item.id),
          texto: String(item.texto),
          concluido: Boolean(item.concluido),
        }))
    : [];
  return {
    id: String(linha.id),
    tipo: linha.tipo as TipoDeMetaDoRoadmap,
    titulo: String(linha.titulo),
    alvo: Number(linha.alvo),
    progresso: Number(linha.progresso),
    automatico: Boolean(linha.automatico),
    criadoEm: String(linha.criado_em),
    subtopicos,
  };
}
