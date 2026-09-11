export type AvaliacaoFlashcard = "errei" | "dificil" | "bom" | "facil";

export type FonteDoFlashcard =
  | {
      tipo: "artigo";
      leiSlug: string;
      artigoSlug: string;
      rotulo: string;
      href: string;
    }
  | {
      tipo: "sumula";
      sumulaSlug: string;
      rotulo: string;
      href: string;
    }
  | null;

export type Flashcard = {
  id: string;
  frente: string;
  verso: string;
  trechoFonte: string;
  proximaRevisao: string;
  intervaloDias: number;
  facilidade: number;
  repeticoes: number;
  suspenso: boolean;
  criadoEm: string;
  atualizadoEm: string;
  revisoesTotal: number;
  fonte: FonteDoFlashcard;
};

export type FonteParaNovoFlashcard = Exclude<FonteDoFlashcard, null> & {
  trecho: string;
};

export type ResultadoDaRevisao = {
  proximaRevisao: string;
  intervaloDias: number;
  facilidade: number;
  repeticoes: number;
};

export const AVALIACOES_FLASHCARD: {
  id: AvaliacaoFlashcard;
  rotulo: string;
  detalhe: string;
}[] = [
  { id: "errei", rotulo: "Errei", detalhe: "volta amanhã" },
  { id: "dificil", rotulo: "Difícil", detalhe: "intervalo curto" },
  { id: "bom", rotulo: "Bom", detalhe: "intervalo normal" },
  { id: "facil", rotulo: "Fácil", detalhe: "intervalo maior" },
];
