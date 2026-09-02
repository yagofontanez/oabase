import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/container";
import { PageHeader } from "@/components/page-header";
import { PaywallCta } from "@/components/paywall-cta";
import { JsonLd } from "@/lib/jsonld";
import { abs } from "@/lib/site";
import { getSumulas } from "@/lib/content/queries";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Súmulas Vinculantes do STF, uma a uma",
  description:
    "As Súmulas Vinculantes do Supremo Tribunal Federal em vigor, com o texto oficial de cada enunciado. Sem cadastro e sem limite de leitura.",
  alternates: { canonical: "/sumulas" },
};

/**
 * Índice das Súmulas Vinculantes.
 *
 * Entra no sitemap pelo mesmo motivo que `/legislacao/<lei>`: é um índice
 * completo e navegável, não uma cópia de texto solta. As páginas de cada
 * súmula seguem o portão de qualidade — existem, são úteis, e só entram no
 * índice quando tiverem comentário revisado.
 *
 * Súmula cancelada não aparece aqui porque não é carregada: enunciado
 * revogado exibido como direito vigente é o defeito que quem estuda só
 * descobre no dia da prova.
 */
export default async function SumulasIndex() {
  const sumulas = await getSumulas("stf");

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Súmulas Vinculantes do STF",
          inLanguage: "pt-BR",
          isAccessibleForFree: true,
          mainEntityOfPage: { "@type": "WebPage", "@id": abs("/sumulas") },
          publisher: { "@id": abs("/#organization") },
        }}
      />

      <PageHeader
        crumbs={[
          { href: "/", label: "Início" },
          { href: "/sumulas", label: "Súmulas" },
        ]}
        eyebrow="Conteúdo aberto"
        titulo={
          <>
            Súmulas <span className="text-ouro-500">Vinculantes</span>
          </>
        }
        descricao={`As ${sumulas.length} Súmulas Vinculantes do STF em vigor, com o texto oficial de cada enunciado. As canceladas ficam de fora — enunciado revogado em material de estudo é armadilha, não acervo.`}
      />

      <Container className="py-16">
        <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {sumulas.map((sumula) => (
            <li key={sumula.slug}>
              <Link
                href={`/sumulas/${sumula.slug}`}
                className="group flex flex-col gap-2 p-6 transition-colors hover:bg-paper sm:flex-row sm:gap-7"
              >
                <span className="shrink-0 text-[0.86rem] font-bold text-brand-600 tabular-nums sm:w-[5.5rem]">
                  SV {sumula.numero}
                </span>
                <span className="flex flex-col gap-1.5">
                  <span className="text-[0.98rem] leading-relaxed text-ink group-hover:text-brand-700">
                    {sumula.texto}
                  </span>
                  {sumula.comentario.length > 0 && (
                    <span className="text-[0.8rem] font-semibold text-ouro-600">
                      comentada
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        {sumulas.length === 0 && (
          <p className="rounded-2xl bg-paper p-8 text-body">
            As súmulas ainda não foram carregadas nesta instalação.
          </p>
        )}

        <PaywallCta
          titulo="Súmula cai em prova, não em teoria"
          texto="No plano você treina com as questões reais que cobraram cada uma delas, com correção na hora e revisão espaçada do que errar."
        />
      </Container>
    </>
  );
}
