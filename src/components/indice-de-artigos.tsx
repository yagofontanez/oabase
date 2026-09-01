"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatarNumeroDeArtigo } from "@/lib/format";

type Item = {
  slug: string;
  numero: string;
  comentado: boolean;
};

/**
 * Índice completo de uma lei.
 *
 * O Código Civil tem 2.081 artigos: uma lista com o caput de cada um seria
 * ilegível e pesada, e uma lista só de números sem busca obrigaria a rolar
 * até o 1.337. A grade dá a visão do todo, o campo leva direto ao artigo —
 * que é como se usa um vade-mécum.
 *
 * O filtro nasce vazio, então o HTML que sai do servidor traz a grade inteira
 * — é por esses links que o buscador chega às páginas de artigo. A filtragem
 * só acontece depois que alguém digita, já no navegador.
 */
export function IndiceDeArtigos({
  itens,
  leiSlug,
}: {
  itens: Item[];
  leiSlug: string;
}) {
  const [busca, setBusca] = useState("");

  const procurado = busca.replace(/[^0-9a-zA-Z-]/g, "").toLowerCase();
  const visiveis = useMemo(
    () =>
      procurado
        ? itens.filter((i) => i.numero.toLowerCase().startsWith(procurado))
        : itens,
    [itens, procurado],
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <label className="flex items-center gap-3">
          <span className="text-[0.86rem] font-semibold text-muted">
            Ir para o artigo
          </span>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            inputMode="numeric"
            placeholder="927"
            aria-label="Filtrar artigos por número"
            className="w-28 rounded-full border border-hairline bg-surface px-4 py-2 text-[0.94rem] tabular-nums text-ink transition-colors outline-none placeholder:text-muted focus-visible:border-brand-400 focus-visible:ring-2 focus-visible:ring-brand-200"
          />
        </label>

        <p
          aria-live="polite"
          className="text-[0.86rem] text-muted tabular-nums"
        >
          {procurado && visiveis.length !== itens.length
            ? `${visiveis.length} de ${itens.length.toLocaleString("pt-BR")} artigos`
            : `${itens.length.toLocaleString("pt-BR")} artigos`}
        </p>
      </div>

      {visiveis.length === 0 ? (
        <p className="rounded-[14px] bg-sunk px-5 py-6 text-[0.94rem] text-body">
          Nenhum artigo começa por “{busca}”. Esta lei vai até o art.{" "}
          {formatarNumeroDeArtigo(itens[itens.length - 1]?.numero ?? "")}.
        </p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(5.4rem,1fr))] gap-2">
          {visiveis.map((item) => (
            <li key={item.slug}>
              <Link
                href={`/legislacao/${leiSlug}/${item.slug}`}
                className="oab-artigo"
              >
                {formatarNumeroDeArtigo(item.numero)}
                {/* Comentário publicado é o que diferencia a página de uma
                    cópia do texto legal — vale sinalizar antes do clique. */}
                {item.comentado && <span aria-hidden="true" />}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
