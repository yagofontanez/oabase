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
  const vinculantes = sumulas.filter((s) => s.vinculante);
  const comuns = sumulas.filter((s) => !s.vinculante);

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
        descricao={`${vinculantes.length} Súmulas Vinculantes e ${comuns.length.toLocaleString("pt-BR")} súmulas do STF em vigor, com o texto oficial de cada enunciado. As canceladas ficam de fora — enunciado revogado em material de estudo é armadilha, não acervo.`}
      />

      <Container className="flex flex-col gap-14 py-16">
        {sumulas.length === 0 && (
          <p className="rounded-2xl bg-paper p-8 text-body">
            As súmulas ainda não foram carregadas nesta instalação.
          </p>
        )}

        {/* As vinculantes primeiro, e com o enunciado inteiro: são 62, todas
            de observância obrigatória, e é a lista que se lê de ponta a
            ponta na véspera. As comuns são mais de setecentas — ali o
            enunciado inteiro viraria meio megabyte de HTML numa página de
            índice, então cada uma leva ao seu próprio endereço. */}
        {vinculantes.length > 0 && (
          <section className="flex flex-col gap-5">
            <h2 className="text-[1.9rem] leading-[1.08] font-semibold tracking-[-0.02em] sm:text-[2.3rem]">
              Súmulas Vinculantes
            </h2>
            <p className="max-w-[62ch] text-[0.98rem] text-body">
              Vinculam todo o Judiciário e a administração pública direta e
              indireta. São as que mais aparecem na prova.
            </p>
            <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {vinculantes.map((sumula) => (
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
          </section>
        )}

        {comuns.length > 0 && (
          <section className="flex flex-col gap-5">
            <h2 className="text-[1.9rem] leading-[1.08] font-semibold tracking-[-0.02em] sm:text-[2.3rem]">
              Súmulas do STF
            </h2>
            <p className="max-w-[62ch] text-[0.98rem] text-body">
              Não vinculam formalmente, mas consolidam a jurisprudência do
              tribunal e continuam sendo cobradas — sobretudo em Constitucional,
              Penal e Tributário.
            </p>
            {/* Grade de números, e não cartão com enunciado — o mesmo que o
                índice de uma lei faz com os 2.081 artigos do Código Civil.
                Com o texto de cada uma das 717, esta página passava de 950 KB
                (o enunciado viaja duas vezes: no HTML e no payload do React).
                A grade dá a visão do todo, e o enunciado é o conteúdo da
                página de cada súmula, que é onde ele deve estar. */}
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
              {comuns.map((sumula) => (
                <li key={sumula.slug}>
                  <Link
                    href={`/sumulas/${sumula.slug}`}
                    title={sumula.texto.slice(0, 120)}
                    className="flex items-center justify-center rounded-lg border border-line bg-surface px-2 py-2.5 text-[0.85rem] font-medium text-body tabular-nums transition-colors hover:border-brand-300 hover:text-brand-700"
                  >
                    {sumula.numero}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <PaywallCta
          titulo="Súmula cai em prova, não em teoria"
          texto="No plano você treina com as questões reais que cobraram cada uma delas, com correção na hora e revisão espaçada do que errar."
        />
      </Container>
    </>
  );
}
