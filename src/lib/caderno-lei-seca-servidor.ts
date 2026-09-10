import type { DestaqueLeiSeca } from "@/lib/caderno-lei-seca";
import { supabaseServidor } from "@/lib/supabase/servidor";

export type ReferenciaDeArtigo = {
  leiSlug: string;
  artigoSlug: string;
};

export type MemoriaDeArtigo = {
  nota: string;
  destaques: DestaqueLeiSeca[];
};

type LinhaDoCaderno = {
  nota: string;
  artigos:
    | {
        slug: string;
        leis: { slug: string } | { slug: string }[] | null;
      }
    | {
        slug: string;
        leis: { slug: string } | { slug: string }[] | null;
      }[]
    | null;
  caderno_lei_destaques: DestaqueLeiSeca[] | null;
};

function primeiro<T>(valor: T | T[] | null) {
  return Array.isArray(valor) ? (valor[0] ?? null) : valor;
}

/**
 * Enriquece recomendações sem torná-las dependentes do caderno. Uma falha
 * nesta leitura pessoal não pode impedir a sessão ou a resposta da questão
 * de abrir; ela apenas deixa de exibir a memória adicional naquele pedido.
 */
export async function memoriasDosArtigos(referencias: ReferenciaDeArtigo[]) {
  const unicas = [
    ...new Map(
      referencias.map((referencia) => [
        `${referencia.leiSlug}/${referencia.artigoSlug}`,
        referencia,
      ]),
    ).values(),
  ];
  if (unicas.length === 0) return {} as Record<string, MemoriaDeArtigo>;

  const supabase = await supabaseServidor();
  const { data, error } = await supabase
    .from("caderno_lei_seca")
    .select(
      "nota, artigos!inner(slug, leis!inner(slug)), caderno_lei_destaques(inicio, fim, trecho, cor)",
    )
    .in(
      "artigos.slug",
      unicas.map((referencia) => referencia.artigoSlug),
    );
  if (error) {
    console.error("Falha ao recuperar destaques do caderno:", error);
    return {} as Record<string, MemoriaDeArtigo>;
  }

  const pedidas = new Set(
    unicas.map(
      (referencia) => `${referencia.leiSlug}/${referencia.artigoSlug}`,
    ),
  );
  const memorias: Record<string, MemoriaDeArtigo> = {};
  for (const linha of (data ?? []) as unknown as LinhaDoCaderno[]) {
    const artigo = primeiro(linha.artigos);
    const lei = artigo ? primeiro(artigo.leis) : null;
    if (!artigo || !lei) continue;
    const chave = `${lei.slug}/${artigo.slug}`;
    if (!pedidas.has(chave)) continue;
    memorias[chave] = {
      nota: linha.nota ?? "",
      destaques: (linha.caderno_lei_destaques ?? []).sort(
        (a, b) => a.inicio - b.inicio,
      ),
    };
  }
  return memorias;
}
