import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/container";
import { PageHeader } from "@/components/page-header";
import { PaywallCta } from "@/components/paywall-cta";
import { formatarData } from "@/lib/format";
import { getExames } from "@/lib/content/queries";
export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Exames de Ordem: fichas, datas e gabaritos",
  description:
    "Todas as edições do Exame de Ordem Unificado com data de aplicação, distribuição de questões por disciplina e gabarito oficial.",
  alternates: { canonical: "/exames" },
};
export default async function ExamesIndex() {
  const exames = await getExames();
  return (
    <>
      <PageHeader
        crumbs={[
          { href: "/", label: "Início" },
          { href: "/exames", label: "Exames" },
        ]}
        eyebrow="Conteúdo aberto"
        titulo={
          <>
            Exames de <span className="text-ouro-500">Ordem</span>
          </>
        }
        descricao="A ficha de cada edição unificada: data de aplicação, quantas questões caíram de cada disciplina e o gabarito oficial."
      />

      <Container className="py-16">
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {exames.map((exame) => (
            <li key={exame.slug}>
              <Link
                href={`/exames/${exame.slug}`}
                className="group flex flex-wrap items-baseline gap-x-8 gap-y-1 p-6 transition-colors hover:bg-paper"
              >
                <span className="text-2xl font-bold tracking-[-0.03em] text-ink group-hover:text-brand-600">
                  {exame.edicao}º Exame
                </span>
                <span className="text-[0.82rem] tabular-nums text-muted">
                  {formatarData(exame.data)}
                </span>
                <span className="ml-auto flex items-baseline gap-4 text-[0.82rem] tabular-nums text-muted">
                  {exame.questoesCarregadas > 0 ? (
                    <>
                      <span className="text-brand-600">
                        {exame.questoesCarregadas} questões
                      </span>
                      {exame.questoesAnuladas > 0 && (
                        <span>{exame.questoesAnuladas} anuladas</span>
                      )}
                    </>
                  ) : (
                    <span>{exame.totalQuestoes} questões</span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <PaywallCta titulo="Refaça qualquer exame como simulado" />
      </Container>
    </>
  );
}
