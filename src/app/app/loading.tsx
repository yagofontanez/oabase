import { Esqueleto } from "@/components/esqueleto";

/**
 * Fronteira de carregamento do painel.
 *
 * As telas de `/app` são todas dinâmicas: consultam o Supabase a cada visita,
 * e sem esta fronteira o navegador ficava com a tela anterior parada até a
 * resposta chegar. Nada indicava que o clique tinha funcionado — a queixa
 * exata era "parece que congelou".
 *
 * Basta um arquivo aqui: no App Router, a fronteira de um segmento cobre
 * todos os filhos que não definirem a própria. O trilho e o cabeçalho ficam
 * de pé, porque o layout não é substituído; só o conteúdo troca.
 */
export default function Carregando() {
  return <Esqueleto />;
}
