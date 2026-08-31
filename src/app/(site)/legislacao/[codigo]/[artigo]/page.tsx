import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/container";
import { PageHeader } from "@/components/page-header";
import { PaywallCta } from "@/components/paywall-cta";
import { JsonLd } from "@/lib/jsonld";
import { formatarData } from "@/lib/format";
import { abs, site } from "@/lib/site";
import {
  getArtigo,
  getArtigosMaisBuscados,
  getArtigosRelacionados,
  getDisciplina,
  getLei,
} from "@/lib/content/queries";
export const revalidate = 3600;

/**
 * Gera sob demanda o que não estiver na lista abaixo. É esta linha que
 * mantém o build viável quando a base passar de dezenas de milhares de
 * artigos: só os campeões de busca entram no build, o resto é criado na
 * primeira visita e fica em cache.
 */
export const dynamicParams = true;
type Props = { params: Promise<{ codigo: string; artigo: string }> };
export async function generateStaticParams() {
  const populares = await getArtigosMaisBuscados(500);
  return populares.map((a) => ({ codigo: a.leiSlug, artigo: a.slug }));
}

/** Texto usado em <title>, meta description e OG — escrito uma vez só. */
function resumoDoArtigo(nomeLei: string, numero: string, caput: string) {
  return `Art. ${numero} da ${nomeLei} comentado para a OAB: ${caput.slice(0, 120)}…`;
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { codigo, artigo: artigoSlug } = await params;
  const [lei, artigo] = await Promise.all([
    getLei(codigo),
    getArtigo(codigo, artigoSlug),
  ]);
  if (!lei || !artigo) return {};
  const url = `/legislacao/${lei.slug}/${artigo.slug}`;
  const titulo = `Art. ${artigo.numero} da ${lei.nome} — comentado`;
  const descricao = resumoDoArtigo(lei.nome, artigo.numero, artigo.caput);
  return {
    title: titulo,
    description: descricao,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: titulo,
      description: descricao,
      url,
      modifiedTime: artigo.atualizadoEm,
    },
    // Portão de qualidade: sem comentário revisado, a página existe e é
    // útil, mas fica fora do índice — é o que protege o domínio inteiro
    // de ser avaliado como conteúdo raso em escala.
    robots: artigo.indexavel ? undefined : { index: false, follow: true },
  };
}
export default async function ArtigoPage({ params }: Props) {
  const { codigo, artigo: artigoSlug } = await params;
  const [lei, artigo] = await Promise.all([
    getLei(codigo),
    getArtigo(codigo, artigoSlug),
  ]);
  if (!lei || !artigo) notFound();
  const [disciplina, relacionados] = await Promise.all([
    getDisciplina(artigo.disciplinaSlug),
    getArtigosRelacionados(artigo),
  ]);
  const url = abs(`/legislacao/${lei.slug}/${artigo.slug}`);
  const titulo = `Art. ${artigo.numero} da ${lei.nome}`;
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: `${titulo} — comentado para a OAB`,
          description: resumoDoArtigo(lei.nome, artigo.numero, artigo.caput),
          inLanguage: "pt-BR",
          dateModified: artigo.atualizadoEm,
          mainEntityOfPage: { "@type": "WebPage", "@id": url },
          author: { "@id": abs("/#organization") },
          publisher: { "@id": abs("/#organization") },
          isAccessibleForFree: true,
          about: {
            "@type": "Legislation",
            name: `${lei.nome}, art. ${artigo.numero}`,
            legislationIdentifier: `${lei.sigla} art. ${artigo.numero}`,
            legislationJurisdiction: "BR",
            inLanguage: "pt-BR",
          },
        }}
      />

      <PageHeader
        compacto
        crumbs={[
          { href: "/", label: "Início" },
          { href: "/legislacao", label: "Legislação" },
          { href: `/legislacao/${lei.slug}`, label: lei.sigla },
          {
            href: `/legislacao/${lei.slug}/${artigo.slug}`,
            label: `Art. ${artigo.numero}`,
          },
        ]}
        eyebrow={disciplina?.nome}
        titulo={titulo}
      >
        <dl className="mt-2 flex flex-wrap items-baseline gap-x-8 gap-y-2 text-[0.76rem] text-brand-300">
          <div className="flex items-baseline gap-2">
            <dt>Cobrado</dt>
            <dd className="text-[0.95rem] tabular-nums text-ouro-500">
              {artigo.incidencia}×
            </dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt>Revisado</dt>
            <dd className="tabular-nums text-brand-100">
              <time dateTime={artigo.atualizadoEm}>
                {formatarData(artigo.atualizadoEm)}
              </time>
            </dd>
          </div>
        </dl>
      </PageHeader>

      <Container className="py-14">
        <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_260px]">
          <article>
            {/* Texto legal — o que o usuário colou no Google precisa estar aqui em HTML puro, nunca em imagem nem atrás de JS. */}
            <section className="rounded-2xl border border-line bg-surface p-7 sm:p-9">
              <h2 className="text-[0.86rem] font-semibold text-muted">
                Texto legal
              </h2>
              <div className="lei-texto mt-5">
                <p>{artigo.caput}</p>
                {artigo.paragrafos.map((p) => (
                  <p key={p} className="text-[1.02rem] text-body">
                    {p}
                  </p>
                ))}
              </div>
            </section>

            <section className="mt-14">
              <h2 className="text-[1.9rem] leading-[1.08] font-semibold tracking-[-0.02em] sm:text-[2.3rem]">
                Como isso cai na prova
              </h2>

              {artigo.comentario.length > 0 ? (
                <div className="comentario mt-6 text-[1.04rem]">
                  {artigo.comentario.map((paragrafo) => (
                    <p
                      key={paragrafo}
                      dangerouslySetInnerHTML={{
                        __html: paragrafo.replace(
                          /\*\*(.+?)\*\*/g,
                          "<strong>$1</strong>",
                        ),
                      }}
                    />
                  ))}
                </div>
              ) : (
                <p className="mt-6 max-w-[62ch] rounded-2xl border border-ouro-200 bg-ouro-100 p-6 text-[0.95rem] text-body">
                  O comentário deste artigo está em revisão editorial e ainda
                  não foi publicado. O texto legal acima está completo e
                  atualizado.
                </p>
              )}
            </section>

            <PaywallCta
              titulo={`Treine ${disciplina?.nome} no banco de questões`}
              texto={`Este artigo já foi cobrado ${artigo.incidencia} vezes no exame. Todas essas questões, comentadas uma a uma, estão no plano — junto com simulados e caderno de erros.`}
            />
          </article>

          {/* Links internos: o que faz o crawler achar as páginas novas e o que segura o aluno no site. */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <h2 className="text-[0.86rem] font-semibold text-muted">
              Leia também
            </h2>
            <ul className="mt-4 flex flex-col gap-3">
              {relacionados.map((rel) => (
                <li key={`${rel.leiSlug}-${rel.slug}`}>
                  <Link
                    href={`/legislacao/${rel.leiSlug}/${rel.slug}`}
                    className="group flex flex-col gap-1.5 rounded-xl border border-line bg-surface p-4 transition-colors hover:border-brand-300"
                  >
                    <span className="flex items-baseline justify-between gap-2 text-[0.75rem] text-brand-600">
                      Art. {rel.numero}
                      <span className="tabular-nums text-muted">
                        {rel.incidencia}×
                      </span>
                    </span>
                    <span className="text-[0.85rem] text-muted group-hover:text-body">
                      {rel.caput.slice(0, 68)}…
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            <p className="mt-6 text-[0.8rem] text-muted">
              Conteúdo de {site.name}, sem vínculo com a banca examinadora.
            </p>
          </aside>
        </div>
      </Container>
    </>
  );
}
