import type { Artigo } from "./types";

/**
 * Ordem do código: 1, 2, 5, 5-A, 10, 121, 1.337.
 *
 * Ordenar `numero` como texto colocaria o art. 10 antes do art. 2 e o 1.337
 * antes do 927 — quem folheia um código espera a ordem do papel. A ordenação
 * por incidência continua fazendo sentido em vitrine ("mais cobrados"), mas
 * não para percorrer a lei inteira, onde 5.751 artigos empatam em zero.
 */
function chave(numero: string): [number, string] {
  const casa = /^(\d+)(?:-([A-Z]+))?/i.exec(numero);
  if (!casa) return [Number.MAX_SAFE_INTEGER, numero];
  return [Number.parseInt(casa[1], 10), casa[2]?.toUpperCase() ?? ""];
}

export function naOrdemDoCodigo<T extends Pick<Artigo, "numero">>(
  artigos: T[],
): T[] {
  return [...artigos].sort((a, b) => {
    const [na, sa] = chave(a.numero);
    const [nb, sb] = chave(b.numero);
    return na - nb || sa.localeCompare(sb);
  });
}
