import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/container";
import { PageHeader } from "@/components/page-header";
import { PaywallCta } from "@/components/paywall-cta";
import { JsonLd } from "@/lib/jsonld";
import { abs } from "@/lib/site";
import { getDisciplinas, getGlossario } from "@/lib/content/queries";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Glossário jurídico: cada termo com o artigo que o define",
  description:
    "Os termos que a prova da OAB cobra, cada um com o dispositivo legal que o define e o texto oficial na íntegra. Sem paráfrase e sem cadastro.",
  alternates: { canonical: "/glossario" },
};

/**
 * Glossário — índice único, sem página por verbete.
 *
 * A decisão de conteúdo é a mesma da migration: **a definição é o artigo**.
 * O verbete não parafraseia a lei; ele exibe o texto do dispositivo, literal,
 * e leva ao artigo completo. O que se acrescenta é curadoria — qual termo
 * merece verbete e onde ele está definido —, e isso é trabalho de índice.
 *
 * Por isso não existe `/glossario/<termo>`: como a definição é o caput, uma
 * página por verbete seria uma cópia de `/legislacao/<lei>/<artigo>` sem uma
 * linha a mais. Seriam 142 páginas rasas competindo com as páginas que têm
 * comentário — duplicata interna, e justamente contra o próprio acervo.
 * O índice é a unidade honesta aqui, como em `/sumulas`.
 */
export default async function Glossario() {
  const [verbetes, disciplinas] = await Promise.all([
    getGlossario(),
    getDisciplinas(),
  ]);

  // A ordem dos blocos é a das disciplinas (incidência na prova), e não a
  // alfabética: quem abre o glossário na véspera quer Ética e Civil primeiro.
  // Disciplina sem verbete nenhum não vira seção vazia.
  const grupos = disciplinas
    .map((d) => ({
      slug: d.slug,
      nome: d.nome,
      verbetes: verbetes.filter((v) => v.disciplinaSlug === d.slug),
    }))
    .filter((g) => g.verbetes.length > 0);

  // Verbete de disciplina que não veio na lista (ou sem disciplina) não pode
  // simplesmente sumir: ele existe no banco e some em silêncio da tela.
  const classificados = new Set(grupos.flatMap((g) => g.slug));
  const restantes = verbetes.filter((v) => !classificados.has(v.disciplinaSlug));
  if (restantes.length > 0) {
    grupos.push({ slug: "outros", nome: "Outros", verbetes: restantes });
  }

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "DefinedTermSet",
          name: "Glossário jurídico do Exame de Ordem",
          inLanguage: "pt-BR",
          isAccessibleForFree: true,
          mainEntityOfPage: { "@type": "WebPage", "@id": abs("/glossario") },
          publisher: { "@id": abs("/#organization") },
          // Cada termo declara a fonte legal. É a marcação que corresponde ao
          // que a página de fato faz: apontar para o dispositivo, não definir
          // por conta própria.
          hasDefinedTerm: verbetes.map((v) => ({
            "@type": "DefinedTerm",
            name: v.termo,
            description: v.caput,
            url: abs(`/legislacao/${v.leiSlug}/${v.artigoSlug}`),
          })),
        }}
      />

      <PageHeader
        crumbs={[
          { href: "/", label: "Início" },
          { href: "/glossario", label: "Glossário" },
        ]}
        eyebrow="Conteúdo aberto"
        titulo={
          <>
            Glossário <span className="text-ouro-500">jurídico</span>
          </>
        }
        descricao={`${verbetes.length.toLocaleString("pt-BR")} termos que a prova cobra, cada um com o artigo que o define e o texto oficial na íntegra. Não parafraseamos a lei: a definição é o dispositivo, e o link leva ao texto completo.`}
      />

      <Container className="flex flex-col gap-14 py-16">
        {verbetes.length === 0 && (
          <p className="rounded-2xl bg-paper p-8 text-body">
            O glossário ainda não foi carregado nesta instalação.
          </p>
        )}

        {verbetes.length > 0 && (
          <p className="max-w-[74ch] text-[0.92rem] leading-relaxed text-muted">
            O número ao lado do termo é a contagem de questões que citaram
            aquele dispositivo de forma expressa, apurada nas 43 provas do
            acervo. Ele mede citação nominal, não incidência do instituto: a
            FGV quase sempre narra o caso sem nomear o artigo, então a ausência
            do número diz que a banca não escreveu o dispositivo — não que ele
            não caia.
          </p>
        )}

        {grupos.length > 1 && (
          <nav aria-label="Disciplinas" className="flex flex-wrap gap-2">
            {grupos.map((grupo) => (
              <a
                key={grupo.slug}
                href={`#${grupo.slug}`}
                className="rounded-full border border-line bg-surface px-4 py-2 text-[0.86rem] font-medium text-body transition-colors hover:bg-brand-50 hover:text-brand-700"
              >
                {grupo.nome}{" "}
                <span className="tabular-nums text-muted">
                  {grupo.verbetes.length}
                </span>
              </a>
            ))}
          </nav>
        )}

        {grupos.map((grupo) => (
          <section
            key={grupo.slug}
            id={grupo.slug}
            className="flex scroll-mt-24 flex-col gap-5"
          >
            <h2 className="text-[1.9rem] leading-[1.08] font-semibold tracking-[-0.02em] sm:text-[2.3rem]">
              {grupo.nome}
            </h2>
            <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {grupo.verbetes.map((verbete) => (
                <li key={verbete.slug} id={verbete.slug} className="scroll-mt-24">
                  <Link
                    href={`/legislacao/${verbete.leiSlug}/${verbete.artigoSlug}`}
                    className="group flex flex-col gap-2 p-6 transition-colors hover:bg-paper"
                  >
                    <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="text-[1.02rem] font-semibold text-ink group-hover:text-brand-700">
                        {verbete.termo}
                      </span>
                      <span className="text-[0.82rem] font-bold text-brand-600 tabular-nums">
                        {verbete.leiSigla}, art. {verbete.numero}
                      </span>
                      {/* A incidência medida — as questões que nomeiam o
                          dispositivo. É o que dá ordem de prioridade a uma
                          lista que, sem ela, é só alfabética: o termo que a
                          banca cita oito vezes não vale o mesmo que o termo
                          que ela nunca citou. Zero não vira rótulo, porque
                          "0 questões" lê como ausência de valor quando é
                          ausência de *citação expressa* — e o instituto pode
                          cair sem que a prova o nomeie. */}
                      {verbete.incidencia > 0 && (
                        <span className="text-[0.78rem] font-semibold text-brand-500 tabular-nums">
                          {verbete.incidencia}{" "}
                          {verbete.incidencia === 1 ? "questão" : "questões"}
                        </span>
                      )}
                      {verbete.temComentario && (
                        <span className="text-[0.78rem] font-semibold text-ouro-600">
                          comentado
                        </span>
                      )}
                    </span>
                    {/* O texto do dispositivo, literal. É a definição — e é o
                        que permite conferir o verbete sem sair da página. */}
                    <span className="max-w-[78ch] text-[0.95rem] leading-relaxed text-body">
                      {verbete.caput}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <PaywallCta
          titulo="Saber o conceito é metade"
          texto="A outra metade é reconhecê-lo no enunciado. No plano você treina com as questões reais que cobraram cada dispositivo, com correção na hora e revisão espaçada do que errar."
        />
      </Container>
    </>
  );
}
