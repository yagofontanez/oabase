import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/container";
import { PageHeader } from "@/components/page-header";
import { PaywallCta } from "@/components/paywall-cta";
import { buscarNoSite, getLeis } from "@/lib/content/queries";

/**
 * Busca do site.
 *
 * O acervo tem 10.168 artigos, 779 súmulas, 142 verbetes e os textos do blog,
 * e até aqui a única forma de achar qualquer coisa era navegar. A
 * infraestrutura já estava paga: `artigos.search_vector` existia desde o
 * schema inicial, mantido por gatilho a cada escrita, com índice GIN — e sem
 * nenhum leitor. `buscar_dispositivos` deu a ele um consumidor; esta página é
 * o segundo.
 *
 * **`noindex`, e fora do sitemap.** Página de resultado de busca interna é
 * conteúdo gerado por quem digita, em quantidade ilimitada de endereços, e
 * pôr isso no índice é a receita conhecida de diluir um domínio — vale ainda
 * mais aqui, onde o portão de qualidade existe justamente para não anunciar
 * página rasa. A busca serve a quem já está no site; quem vem do buscador
 * chega na página do dispositivo.
 *
 * Dinâmica de propósito: o resultado depende do que foi digitado, e não há
 * o que pré-renderizar.
 */
export const metadata: Metadata = {
  title: "Buscar no acervo",
  description:
    "Procure artigo de lei, súmula e texto pelo assunto ou pelo número.",
  alternates: { canonical: "/busca" },
  robots: { index: false, follow: true },
};

const ROTULO: Record<string, string> = {
  artigo: "Artigo",
  sumula: "Súmula",
  post: "Texto",
};

export default async function Busca({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const termo = (q ?? "").trim();
  // Só a contagem de normas, que são 42 linhas. Somar os artigos exigiria
  // trazer os 10.168 para contar, a cada busca digitada.
  const [resultados, leis] = await Promise.all([
    termo ? buscarNoSite(termo, 40) : Promise.resolve([]),
    getLeis(),
  ]);

  const procurou = termo.length > 0;

  return (
    <>
      <PageHeader
        crumbs={[
          { href: "/", label: "Início" },
          { href: "/busca", label: "Buscar" },
        ]}
        eyebrow="Conteúdo aberto"
        titulo={
          <>
            Buscar no <span className="text-ouro-500">acervo</span>
          </>
        }
        descricao={`O texto oficial de ${leis.length} normas, as súmulas do STF e os textos do blog. Procure pelo assunto — “furto”, “algemas”, “honorários de sucumbência” — ou pelo número, se souber. Acento é opcional.`}
      >
        {/*
          Formulário GET, sem JavaScript nenhum.

          O resultado ganha um endereço que dá para compartilhar e voltar, o
          campo existe no HTML antes de qualquer script rodar, e a página
          continua funcionando com a aba pela metade. Uma busca que só existe
          depois da hidratação é uma busca que não existe para quem chegou
          numa conexão ruim — que é boa parte de quem estuda pelo celular.
        */}
        <form action="/busca" method="get" className="flex w-full max-w-[38rem] gap-2">
          <input
            type="search"
            name="q"
            defaultValue={termo}
            autoFocus
            placeholder="furto, art. 155, algemas…"
            aria-label="Buscar no acervo"
            className="min-w-0 flex-1 rounded-full border border-line bg-surface px-5 py-3 text-[0.98rem] text-ink outline-none placeholder:text-muted focus:border-brand-400"
          />
          <button
            type="submit"
            className="rounded-full bg-brand-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Buscar
          </button>
        </form>
      </PageHeader>

      <Container className="py-16">
        {!procurou ? (
          <div className="flex flex-col gap-4">
            <p className="max-w-[68ch] text-[1.02rem] leading-relaxed text-body">
              A busca cobre o texto oficial dos artigos, o enunciado das
              súmulas e os textos do blog. Ela não cobre as questões das
              provas: essas ficam na área de estudo, com filtro por exame e por
              disciplina.
            </p>
            <ul className="flex flex-wrap gap-2">
              {[
                "furto",
                "algemas",
                "honorários de sucumbência",
                "prescrição",
                "art. 5",
                "prisão em flagrante",
              ].map((exemplo) => (
                <li key={exemplo}>
                  <Link
                    href={`/busca?q=${encodeURIComponent(exemplo)}`}
                    className="inline-block rounded-full border border-line bg-surface px-4 py-2 text-[0.88rem] text-body transition-colors hover:bg-brand-50 hover:text-brand-700"
                  >
                    {exemplo}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : resultados.length === 0 ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-8">
            <p className="text-[1.05rem] font-semibold text-ink">
              Nada com “{termo}” no acervo.
            </p>
            <p className="max-w-[62ch] text-[0.96rem] leading-relaxed text-body">
              A busca procura no texto da lei e da súmula. Se você procurou por
              um termo de doutrina, tente a palavra que aparece no próprio
              dispositivo — “subtrair” em vez de “furto qualificado”. O{" "}
              <Link
                href="/glossario"
                className="font-semibold text-brand-700 underline decoration-brand-200 underline-offset-4"
              >
                glossário
              </Link>{" "}
              liga cada termo ao artigo que o define.
            </p>
          </div>
        ) : (
          <>
            <p className="mb-5 text-[0.9rem] text-muted tabular-nums">
              {resultados.length}{" "}
              {resultados.length === 1 ? "resultado" : "resultados"} para “
              {termo}”
            </p>
            <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {resultados.map((r) => (
                <li key={r.href}>
                  <Link
                    href={r.href}
                    className="group flex flex-col gap-1.5 p-6 transition-colors hover:bg-paper"
                  >
                    <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="text-[1.02rem] font-semibold text-ink group-hover:text-brand-700">
                        {r.rotulo}
                      </span>
                      <span className="text-[0.76rem] font-semibold tracking-wide text-muted uppercase">
                        {ROTULO[r.tipo] ?? r.tipo}
                      </span>
                      {r.comentado && (
                        <span className="text-[0.78rem] font-semibold text-ouro-600">
                          comentado
                        </span>
                      )}
                    </span>
                    <span className="max-w-[80ch] text-[0.95rem] leading-relaxed text-body">
                      {r.resumo}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}

        <PaywallCta
          titulo="Achar o artigo é metade"
          texto="A outra metade é reconhecê-lo no enunciado. No plano você treina com as questões reais que cobraram cada dispositivo, com correção na hora e revisão espaçada do que errar."
        />
      </Container>
    </>
  );
}
