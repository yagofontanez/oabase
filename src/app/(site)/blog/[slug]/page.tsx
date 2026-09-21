import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/container";
import { PageHeader } from "@/components/page-header";
import { PaywallCta } from "@/components/paywall-cta";
import { JsonLd } from "@/lib/jsonld";
import { formatarData } from "@/lib/format";
import { abs } from "@/lib/site";
import { getPost, getPosts } from "@/lib/content/queries";

export const revalidate = 3600;
export const dynamicParams = true;

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const posts = await getPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return {};
  return {
    title: post.titulo,
    description: post.resumo,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.titulo,
      description: post.resumo,
      url: `/blog/${post.slug}`,
      publishedTime: post.publicadoEm,
      modifiedTime: post.atualizadoEm,
    },
  };
}

/**
 * O corpo é texto simples com parágrafos separados por linha em branco, e
 * subtítulos marcados com `## `.
 *
 * Não é Markdown completo de propósito: renderizar HTML vindo do banco exigiria
 * sanitização, e um blog de dez textos não justifica essa superfície. Quando o
 * volume pedir mais, o lugar de mudar é aqui — não em cada post.
 */
function Corpo({ texto }: { texto: string }) {
  const blocos = texto
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  return (
    <div className="comentario flex flex-col gap-5 text-[1.05rem] leading-relaxed text-body">
      {blocos.map((bloco, i) =>
        bloco.startsWith("## ") ? (
          <h2
            key={i}
            className="mt-6 text-[1.5rem] leading-snug font-bold tracking-[-0.02em] text-ink"
          >
            {bloco.slice(3)}
          </h2>
        ) : (
          <p key={i}>{bloco}</p>
        ),
      )}
    </div>
  );
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: post.titulo,
          description: post.resumo,
          datePublished: post.publicadoEm,
          dateModified: post.atualizadoEm,
          inLanguage: "pt-BR",
          isAccessibleForFree: true,
          mainEntityOfPage: {
            "@type": "WebPage",
            "@id": abs(`/blog/${post.slug}`),
          },
          author: { "@id": abs("/#organization") },
          publisher: { "@id": abs("/#organization") },
        }}
      />

      <PageHeader
        crumbs={[
          { href: "/", label: "Início" },
          { href: "/blog", label: "Blog" },
          { href: `/blog/${post.slug}`, label: post.titulo },
        ]}
        eyebrow={formatarData(post.publicadoEm, {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })}
        titulo={post.titulo}
        descricao={post.resumo}
      />

      <Container className="flex max-w-[72ch] flex-col gap-10 py-16">
        <Corpo texto={post.corpo} />

        <Link
          href="/blog"
          className="text-[0.94rem] font-semibold text-brand-700 underline decoration-brand-200 underline-offset-4"
        >
          ← Todos os textos
        </Link>

        <PaywallCta />
      </Container>
    </>
  );
}
