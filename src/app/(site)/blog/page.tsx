import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/container";
import { PageHeader } from "@/components/page-header";
import { formatarData } from "@/lib/format";
import { getPosts } from "@/lib/content/queries";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Blog: o que os dados do Exame de Ordem mostram",
  description:
    "Textos sobre como estudar para a 1ª fase, escritos a partir do acervo: 3.460 questões reais de 43 exames e a incidência medida de cada dispositivo.",
  alternates: { canonical: "/blog" },
};

/**
 * Índice do blog.
 *
 * A pauta sai da medição, não do calendário editorial: o que o acervo mostra
 * e mais ninguém tem para mostrar. Texto de blog jurídico genérico existe aos
 * milhares e não posiciona nada; "os dispositivos mais cobrados em 43 provas,
 * contados um a um" existe aqui porque as 43 provas estão no banco.
 */
export default async function BlogIndex() {
  const posts = await getPosts();

  return (
    <>
      <PageHeader
        crumbs={[
          { href: "/", label: "Início" },
          { href: "/blog", label: "Blog" },
        ]}
        eyebrow="Conteúdo aberto"
        titulo={
          <>
            O que os <span className="text-ouro-500">dados</span> mostram
          </>
        }
        descricao="Textos sobre como estudar para a 1ª fase, escritos a partir do próprio acervo — provas anteriores, gabaritos oficiais e a incidência medida de cada dispositivo."
      />

      <Container className="py-16">
        {posts.length === 0 ? (
          <p className="rounded-2xl bg-paper p-8 text-body">
            Nenhum texto publicado ainda.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {posts.map((post) => (
              <li key={post.slug}>
                <Link
                  href={`/blog/${post.slug}`}
                  className="group flex flex-col gap-2 p-7 transition-colors hover:bg-paper"
                >
                  <span className="text-[0.8rem] text-muted tabular-nums">
                    {formatarData(post.publicadoEm)}
                  </span>
                  <h2 className="text-[1.45rem] leading-snug font-bold tracking-[-0.02em] text-ink group-hover:text-brand-600">
                    {post.titulo}
                  </h2>
                  <p className="max-w-[68ch] text-[0.96rem] text-body">
                    {post.resumo}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </>
  );
}
