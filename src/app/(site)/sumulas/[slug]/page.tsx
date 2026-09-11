import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/container";
import { PageHeader } from "@/components/page-header";
import { PaywallCta } from "@/components/paywall-cta";
import { JsonLd } from "@/lib/jsonld";
import { abs } from "@/lib/site";
import { getSumula, getSumulas } from "@/lib/content/queries";

export const revalidate = 3600;
export const dynamicParams = true;

type Props = { params: Promise<{ slug: string }> };

/**
 * Só as vinculantes saem prontas do build: são 62, de observância
 * obrigatória, e as mais procuradas. As mais de setecentas comuns ficam para
 * `dynamicParams`, que gera na primeira visita e guarda — mesmo critério dos
 * artigos de lei, e o que impede o build de crescer com o acervo.
 */
export async function generateStaticParams() {
  const sumulas = await getSumulas();
  return sumulas.filter((s) => s.vinculante).map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const sumula = await getSumula(slug);
  if (!sumula) return {};

  const titulo = sumula.vinculante
    ? `Súmula Vinculante ${sumula.numero} do STF`
    : `Súmula ${sumula.numero} do STF`;
  return {
    title: titulo,
    description: sumula.texto.slice(0, 155),
    alternates: { canonical: `/sumulas/${sumula.slug}` },
    // O portão de qualidade, igual ao dos artigos: o texto oficial existe em
    // centenas de sites, e anunciar cópia sem nada em cima é o que faz um
    // domínio ser avaliado como conteúdo raso quando a base escala.
    robots: sumula.indexavel ? undefined : { index: false, follow: true },
    openGraph: {
      type: "article",
      title: titulo,
      description: sumula.texto.slice(0, 155),
      url: `/sumulas/${sumula.slug}`,
    },
  };
}

export default async function SumulaPage({ params }: Props) {
  const { slug } = await params;
  const sumula = await getSumula(slug);
  if (!sumula) notFound();

  const rotulo = sumula.vinculante
    ? `Súmula Vinculante ${sumula.numero} do STF`
    : `Súmula ${sumula.numero} do ${sumula.tribunal.toUpperCase()}`;

  // São mais de setecentas: gerar todas no build é caro e desnecessário, já
  // que `dynamicParams` faz a primeira visita gerar e guardar a página.
  // As vinculantes, que são 62 e as mais procuradas, saem prontas.

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: rotulo,
          articleBody: sumula.texto,
          inLanguage: "pt-BR",
          isAccessibleForFree: true,
          mainEntityOfPage: {
            "@type": "WebPage",
            "@id": abs(`/sumulas/${sumula.slug}`),
          },
          publisher: { "@id": abs("/#organization") },
        }}
      />

      <PageHeader
        crumbs={[
          { href: "/", label: "Início" },
          { href: "/sumulas", label: "Súmulas" },
          {
            href: `/sumulas/${sumula.slug}`,
            label: sumula.vinculante
              ? `SV ${sumula.numero}`
              : `Súmula ${sumula.numero}`,
          },
        ]}
        eyebrow={
          sumula.vinculante ? "Súmula Vinculante · STF" : "Súmula · STF"
        }
        titulo={
          sumula.vinculante ? (
            <>
              Súmula <span className="text-ouro-500">Vinculante</span>{" "}
              {sumula.numero}
            </>
          ) : (
            <>
              Súmula <span className="text-ouro-500">{sumula.numero}</span> do
              STF
            </>
          )
        }
        descricao="Texto oficial publicado pelo Supremo Tribunal Federal."
      />

      <Container className="flex max-w-[68ch] flex-col gap-10 py-16">
        <blockquote className="lei-texto border-l-2 border-brand-300 pl-6">
          <p>{sumula.texto}</p>
        </blockquote>

        <Link
          href={`/app/flashcards?sumula=${sumula.slug}&trecho=${encodeURIComponent(sumula.texto)}`}
          className="-mt-5 self-start rounded-full border border-brand-200 bg-brand-50 px-4 py-2.5 text-[0.8rem] font-semibold text-brand-700"
        >
          Criar flashcard desta súmula →
        </Link>

        {sumula.comentario.length > 0 ? (
          <section className="flex flex-col gap-3">
            <h2 className="text-[0.86rem] font-semibold text-muted">
              O que isso quer dizer na prova
            </h2>
            <div className="comentario text-[1rem] text-body">
              {sumula.comentario.map((paragrafo, i) => (
                <p key={i}>{paragrafo}</p>
              ))}
            </div>
          </section>
        ) : (
          /* Mesma escolha da tela de questões: dizer que não existe, em vez
             de preencher o espaço. Explicação jurídica gerada por máquina é
             o pior defeito possível num material de estudo. */
          <p className="rounded-2xl border border-line bg-paper p-6 text-[0.93rem] text-muted">
            O comentário desta súmula ainda não foi redigido. O enunciado
            acima é o texto oficial do STF, na íntegra.
          </p>
        )}

        <Link
          href="/sumulas"
          className="text-[0.94rem] font-semibold text-brand-700 underline decoration-brand-200 underline-offset-4"
        >
          ← Todas as Súmulas Vinculantes
        </Link>

        <PaywallCta
          titulo="Onde esta súmula já foi cobrada"
          texto="No plano você responde as questões reais das provas anteriores, com correção na hora e revisão espaçada do que errar."
        />
      </Container>
    </>
  );
}
