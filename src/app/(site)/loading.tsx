import { Esqueleto } from "@/components/esqueleto";

/**
 * Fronteira de carregamento do site aberto.
 *
 * A maior parte destas páginas é estática e troca sem passar por aqui. Quem
 * precisa da fronteira são as rotas com `dynamicParams`: um artigo fora do
 * top-N e uma súmula comum são gerados na primeira visita, e essa primeira
 * visita é justamente a de quem chegou pelo buscador.
 */
export default function Carregando() {
  return (
    <div className="py-16">
      <Esqueleto cartoes={3} />
    </div>
  );
}
