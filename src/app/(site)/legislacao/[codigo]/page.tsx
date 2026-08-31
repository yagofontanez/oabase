import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/container";
import { PageHeader } from "@/components/page-header";
import { PaywallCta } from "@/components/paywall-cta";
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
  const titulo = `${lei.nome} (${lei.sigla}) comentada`;
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
  const maior = artigos[0]?.incidencia ?? 1;
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
        <h2 className="text-[0.86rem] font-semibold text-muted">
          Artigos ordenados por incidência
        </h2>

        <ul className="mt-5 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {artigos.map((artigo) => (
            <li key={artigo.slug}>
              <Link
                href={`/legislacao/${lei.slug}/${artigo.slug}`}
                className="group grid gap-x-6 gap-y-2 p-6 transition-colors hover:bg-paper sm:grid-cols-[7rem_1fr_9rem] sm:items-center"
              >
                <span className="text-[0.9rem] text-brand-600">
                  Art. {artigo.numero}
                </span>

                <span className="text-[0.94rem] text-body group-hover:text-ink">
                  {artigo.caput.slice(0, 120)}…
                </span>

                {/* A barra transforma a contagem em comparação: qual artigo pesa mais se lê antes de ler o número. */}
                <span className="flex items-center gap-3">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunk">
                    <span
                      className="block h-full rounded-full bg-brand-400"
                      style={{ width: `${(artigo.incidencia / maior) * 100}%` }}
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

        <PaywallCta />
      </Container>
    </>
  );
}
