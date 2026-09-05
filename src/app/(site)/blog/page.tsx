import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/container";
import { PageHeader } from "@/components/page-header";
import { formatarData } from "@/lib/format";
import { getAcervo, getPosts } from "@/lib/content/queries";

export const revalidate = 3600;

/*
  A descrição conta o acervo em vez de afirmar um número escrito à mão.

  Ela dizia "3.460 questões reais de 43 exames", e a entrada do 35º Exame
  tornou as duas metades falsas no mesmo dia — numa página cujo argumento
  inteiro é que aqui os números são contados. Número de acervo em literal é
  uma data de validade que ninguém anota.
*/
export async function generateMetadata(): Promise<Metadata> {
  const acervo = await getAcervo();
  return {
    title: "Blog: o que os dados do Exame de Ordem mostram",
    description:
      `Textos sobre como estudar para a 1ª fase, escritos a partir do acervo: ` +
      `${acervo.questoes.toLocaleString("pt-BR")} questões reais de ` +
      `${acervo.exames} exames e a incidência medida de cada dispositivo.`,
    alternates: { canonical: "/blog" },
  };
}

/**
 * Índice do blog.
 *
 * A pauta sai da medição, não do calendário editorial: o que o acervo mostra
 * e mais ninguém tem para mostrar. Texto de blog jurídico genérico existe aos
 * milhares e não posiciona nada; "os dispositivos mais cobrados nas provas
 * anteriores, contados um a um" existe aqui porque as provas estão no banco.
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
