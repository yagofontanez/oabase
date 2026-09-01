import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/container";
import { IndiceDeArtigos } from "@/components/indice-de-artigos";
import { PageHeader } from "@/components/page-header";
import { PaywallCta } from "@/components/paywall-cta";
import { daLei, formatarNumeroDeArtigo } from "@/lib/format";
import { getArtigosDaLei, getLei, getLeis } from "@/lib/content/queries";
export const revalidate = 3600;
export const dynamicParams = true;
type Props = { params: Promise<{ codigo: string }> };
export async function generateStaticParams() {
  const leis = await getLeis();
  return leis.map((lei) => ({ codigo: lei.slug }));
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { codigo } = await params;
  const lei = await getLei(codigo);
  if (!lei) return {};
  // "Código Civil comentada" não existe: o particípio concorda com o nome.
  const titulo = `${lei.nome} (${lei.sigla}) ${
    daLei(lei.nome) === "do" ? "comentado" : "comentada"
  }`;
  return {
    title: titulo,
    description: lei.resumo,
    alternates: { canonical: `/legislacao/${lei.slug}` },
    openGraph: {
      type: "article",
      title: titulo,
      description: lei.resumo,
      url: `/legislacao/${lei.slug}`,
    },
  };
}
export default async function LeiPage({ params }: Props) {
  const { codigo } = await params;
  const lei = await getLei(codigo);
  if (!lei) notFound();
  const artigos = await getArtigosDaLei(lei.slug);

  // Duas leituras da mesma lei: o que a banca já cobrou, para quem estuda por
  // prioridade, e a lei inteira em ordem, para quem veio consultar um artigo.
  const cobrados = artigos
    .filter((a) => a.incidencia > 0)
    .sort((a, b) => b.incidencia - a.incidencia)
    .slice(0, 12);
  const maior = cobrados[0]?.incidencia ?? 1;

  return (
    <>
      <PageHeader
        crumbs={[
          { href: "/", label: "Início" },
          { href: "/legislacao", label: "Legislação" },
          { href: `/legislacao/${lei.slug}`, label: lei.nome },
        ]}
        eyebrow={`${lei.sigla} · ${lei.ano}`}
        titulo={lei.nome}
        descricao={lei.resumo}
      />

      <Container className="py-16">
        {cobrados.length > 0 && (
          <section className="mb-16">
            <h2 className="text-[0.86rem] font-semibold text-muted">
              Os mais cobrados no exame
            </h2>

            <ul className="mt-5 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {cobrados.map((artigo) => (
                <li key={artigo.slug}>
                  <Link
                    href={`/legislacao/${lei.slug}/${artigo.slug}`}
                    className="group grid gap-x-6 gap-y-2 p-6 transition-colors hover:bg-paper sm:grid-cols-[7rem_1fr_9rem] sm:items-center"
                  >
                    <span className="text-[0.9rem] text-brand-600">
                      Art. {formatarNumeroDeArtigo(artigo.numero)}
                    </span>

                    <span className="text-[0.94rem] text-body group-hover:text-ink">
                      {artigo.caput.slice(0, 120)}…
                    </span>

                    {/* A barra transforma a contagem em comparação: qual artigo pesa mais se lê antes de ler o número. */}
                    <span className="flex items-center gap-3">
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunk">
                        <span
                          className="block h-full rounded-full bg-brand-400"
                          style={{
                            width: `${(artigo.incidencia / maior) * 100}%`,
                          }}
                        />
                      </span>
                      <span className="shrink-0 text-[0.78rem] tabular-nums text-muted">
                        {artigo.incidencia}×
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <h2 className="text-[1.3rem] font-bold text-ink">
              A lei inteira, em ordem
            </h2>
            <p className="flex items-center gap-2 text-[0.82rem] text-muted">
              <span
                aria-hidden="true"
                className="block h-1.5 w-1.5 rounded-full bg-ouro-500"
              />
              já tem comentário publicado
            </p>
          </div>

          <IndiceDeArtigos
            leiSlug={lei.slug}
            itens={artigos.map((a) => ({
              slug: a.slug,
              numero: a.numero,
              comentado: a.comentario.length > 0,
            }))}
          />
        </section>

        <PaywallCta />
      </Container>
    </>
  );
}
