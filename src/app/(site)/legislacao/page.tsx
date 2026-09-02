import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/container";
import { PageHeader } from "@/components/page-header";
import { PaywallCta } from "@/components/paywall-cta";
import { contarArtigos, getLeis } from "@/lib/content/queries";
export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Legislação comentada para a OAB",
  description:
    "Constituição, códigos e Estatuto da OAB artigo por artigo, com texto oficial atualizado e a incidência real de cada dispositivo no Exame de Ordem.",
  alternates: { canonical: "/legislacao" },
};
export default async function LegislacaoIndex() {
  const leis = await getLeis();
  const contagens = await Promise.all(
    leis.map((lei) => contarArtigos(lei.slug)),
  );
  return (
    <>
      <PageHeader
        crumbs={[
          { href: "/", label: "Início" },
          { href: "/legislacao", label: "Legislação" },
        ]}
        eyebrow="Conteúdo aberto"
        titulo={
          <>
            Legislação <span className="text-ouro-500">comentada</span>
          </>
        }
        /* "Cada artigo … com comentário" seria falso: são 4 comentados em
           5.756. O que todo artigo tem é texto oficial e incidência medida;
           o comentário é o que o índice marca, artigo a artigo. */
        descricao="Cada artigo com o texto oficial na íntegra e quantas vezes já foi cobrado no exame — e, nos que já foram comentados, a leitura voltada à prova. Sem cadastro, sem limite de leitura."
      />

      <Container className="py-16">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {leis.map((lei, i) => (
            <Link
              key={lei.slug}
              href={`/legislacao/${lei.slug}`}
              className="group flex flex-col gap-3 rounded-2xl border border-line bg-surface p-7 transition-colors hover:border-brand-300"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[0.7rem] font-semibold text-brand-600">
                  {lei.sigla}
                </span>
                <span className="text-[0.72rem] tabular-nums text-muted">
                  {contagens[i].toLocaleString("pt-BR")} artigos
                </span>
              </div>
              <h2 className="text-2xl font-bold tracking-[-0.03em] group-hover:text-brand-600">
                {lei.nome}
              </h2>
              <p className="text-[0.9rem] text-muted">{lei.resumo}</p>
            </Link>
          ))}
        </div>

        <PaywallCta />
      </Container>
    </>
  );
}
