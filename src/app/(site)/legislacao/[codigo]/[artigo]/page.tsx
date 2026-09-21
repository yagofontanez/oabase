import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CadernoDoArtigo } from "@/components/caderno-artigo";
import { Container } from "@/components/container";
import { PageHeader } from "@/components/page-header";
import { PaywallCta } from "@/components/paywall-cta";
import { JsonLd } from "@/lib/jsonld";
import { daLei, formatarData, formatarNumeroDeArtigo } from "@/lib/format";
import { abs, site } from "@/lib/site";
import {
  getLinksEditoriaisDoArtigo,
  metadadosDoArtigo,
} from "@/lib/content/metadados-artigo";
import {
  getArtigo,
  getRotasDeArtigosMaisBuscados,
  getArtigosRelacionados,
  getIncidenciaDoArtigo,
  getDisciplina,
  getLei,
  getVizinhos,
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
  try {
    const populares = await getRotasDeArtigosMaisBuscados(500);
    return populares.map((rota) => ({
      codigo: rota.leiSlug,
      artigo: rota.artigoSlug,
    }));
  } catch (erro) {
    // Esta lista é uma otimização, não a fonte de verdade: com
    // `dynamicParams`, qualquer artigo continua sendo gerado na primeira
    // visita. Uma oscilação do banco não deve derrubar o deploy inteiro.
    console.warn(
      "Não foi possível pré-renderizar os artigos populares; as páginas serão geradas sob demanda.",
      erro,
    );
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { codigo, artigo: artigoSlug } = await params;
  const [lei, artigo] = await Promise.all([
    getLei(codigo),
    getArtigo(codigo, artigoSlug),
  ]);
  if (!lei || !artigo) return {};
  const url = `/legislacao/${lei.slug}/${artigo.slug}`;
  const { titulo, descricao } = metadadosDoArtigo(lei, artigo);
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
  const [disciplina, relacionados, vizinhos, incidencia] = await Promise.all([
    getDisciplina(artigo.disciplinaSlug),
    getArtigosRelacionados(artigo),
    getVizinhos(lei.slug, artigo.slug),
    getIncidenciaDoArtigo(lei.slug, artigo.slug),
  ]);
  const url = abs(`/legislacao/${lei.slug}/${artigo.slug}`);
  const titulo = `Art. ${formatarNumeroDeArtigo(artigo.numero)} ${daLei(lei.nome)} ${lei.nome}`;
  const metadata = metadadosDoArtigo(lei, artigo);
  const linksEditoriais = getLinksEditoriaisDoArtigo(lei.slug, artigo.slug);
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: metadata.titulo,
          description: metadata.descricao,
          inLanguage: "pt-BR",
          dateModified: artigo.atualizadoEm,
          mainEntityOfPage: { "@type": "WebPage", "@id": url },
          author: { "@id": abs("/#organization") },
          publisher: { "@id": abs("/#organization") },
          isAccessibleForFree: true,
          about: {
            "@type": "Legislation",
            name: `${lei.nome}, art. ${formatarNumeroDeArtigo(artigo.numero)}`,
            legislationIdentifier: `${lei.sigla} art. ${formatarNumeroDeArtigo(artigo.numero)}`,
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
            label: `Art. ${formatarNumeroDeArtigo(artigo.numero)}`,
          },
        ]}
        eyebrow={disciplina?.nome}
        titulo={titulo}
      >
        <dl className="mt-2 flex flex-wrap items-baseline gap-x-8 gap-y-2 text-[0.76rem] text-brand-300">
          {/* "Cobrado 0×" não é informação, é ruído: a esmagadora maioria dos
              artigos de um código nunca caiu, e dizer isso em cada página só
              tira o peso do número quando ele existe de verdade. */}
          {artigo.incidencia > 0 && (
            <div className="flex items-baseline gap-2">
              <dt>Cobrado</dt>
              <dd className="text-[0.95rem] tabular-nums text-ouro-500">
                {artigo.incidencia}×
              </dd>
            </div>
          )}
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
              <CadernoDoArtigo
                leiSlug={lei.slug}
                artigoSlug={artigo.slug}
                partes={[artigo.caput, ...artigo.paragrafos]}
              />
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

              {linksEditoriais.length > 0 && (
                <nav
                  aria-label="Comparações relacionadas"
                  className="mt-7 rounded-xl border border-brand-100 bg-brand-50 p-5"
                >
                  <p className="text-[0.78rem] font-semibold tracking-wide text-brand-700 uppercase">
                    Compare os dispositivos
                  </p>
                  <ul className="mt-2 flex flex-col gap-2">
                    {linksEditoriais.map((link) => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          className="text-[0.94rem] font-semibold text-brand-800 underline decoration-brand-200 underline-offset-4"
                        >
                          {link.rotulo} →
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              )}
            </section>

            {/* Onde já caiu. Contagem por exame, com link para a página do
                exame — o enunciado continua atrás da assinatura, mas o fato
                de o dispositivo ter sido cobrado é conteúdo aberto, e é
                justamente o que diferencia esta página de qualquer cópia do
                texto legal. */}
            {incidencia.length > 0 && (
              <section className="mt-14">
                <h2 className="text-[1.9rem] leading-[1.08] font-semibold tracking-[-0.02em] sm:text-[2.3rem]">
                  Onde já caiu
                </h2>
                <p className="mt-3 max-w-[62ch] text-[0.98rem] text-body">
                  Este dispositivo aparece em {artigo.incidencia}{" "}
                  {artigo.incidencia === 1 ? "questão" : "questões"} do acervo,
                  distribuídas assim:
                </p>
                <ul className="mt-6 flex flex-wrap gap-3">
                  {incidencia.map((e) => (
                    <li key={e.exameSlug}>
                      <Link
                        href={`/exames/${e.exameSlug}`}
                        className="flex flex-col gap-0.5 rounded-xl border border-line bg-surface px-5 py-3 transition-colors hover:border-brand-300"
                      >
                        <span className="font-semibold text-ink">
                          {e.edicao}º Exame
                        </span>
                        <span className="text-[0.8rem] text-muted tabular-nums">
                          {e.questoes}{" "}
                          {e.questoes === 1 ? "questão" : "questões"} ·{" "}
                          {formatarData(e.data)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Ler um código é ler em sequência. Estes dois links também são
                o que dá ao buscador um caminho contínuo por todos os artigos
                da lei, sem depender só do índice. */}
            {(vizinhos.anterior || vizinhos.proximo) && (
              <nav
                aria-label="Navegação pela lei"
                className="mt-12 flex flex-wrap items-stretch gap-3"
              >
                {[
                  {
                    v: vizinhos.anterior,
                    rotulo: "Artigo anterior",
                    seta: "←",
                  },
                  { v: vizinhos.proximo, rotulo: "Próximo artigo", seta: "→" },
                ].map(({ v, rotulo, seta }) =>
                  v ? (
                    <Link
                      key={rotulo}
                      href={`/legislacao/${lei.slug}/${v.slug}`}
                      className="group flex flex-1 basis-52 flex-col gap-1 rounded-xl border border-line bg-surface p-4 transition-colors hover:border-brand-300"
                    >
                      <span className="text-[0.75rem] text-muted">
                        {rotulo}
                      </span>
                      <span className="font-semibold text-ink group-hover:text-brand-700">
                        {seta === "←" ? `${seta} ` : ""}Art.{" "}
                        {formatarNumeroDeArtigo(v.numero)}
                        {seta === "→" ? ` ${seta}` : ""}
                      </span>
                    </Link>
                  ) : (
                    <span key={rotulo} className="flex-1 basis-52" />
                  ),
                )}
              </nav>
            )}

            <PaywallCta
              titulo={`Treine ${disciplina?.nome} no banco de questões`}
              texto={
                artigo.incidencia > 0
                  ? `Este artigo já foi cobrado ${artigo.incidencia} vezes no exame. Todas essas questões, comentadas uma a uma, estão no plano — junto com simulados e caderno de erros.`
                  : `As questões de ${disciplina?.nome} de todas as edições do exame estão no plano, comentadas uma a uma, junto com simulados e caderno de erros.`
              }
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
                      Art. {formatarNumeroDeArtigo(rel.numero)}
                      {rel.incidencia > 0 && (
                        <span className="tabular-nums text-muted">
                          {rel.incidencia}×
                        </span>
                      )}
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
