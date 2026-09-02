import type { ReactNode } from "react";
import { Container } from "./container";
import { PageHeader } from "./page-header";
import { dadosPendentes } from "@/lib/legal";
import { formatarData } from "@/lib/format";

export type Secao = {
  /** Vira âncora na URL: dá para linkar uma cláusula específica. */
  id: string;
  titulo: string;
  corpo: ReactNode;
};

/**
 * Moldura dos documentos legais.
 *
 * Duas decisões que não são estéticas:
 *
 * 1. **Sumário com âncora.** Documento jurídico é lido por consulta, não do
 *    começo ao fim — e quando alguém reclama de uma cláusula, precisa
 *    conseguir apontar para ela.
 * 2. **Aviso quando faltam dados do operador.** Publicar Termos com razão
 *    social em branco é pior do que não publicar: parece cumprido e não é.
 *    O aviso some sozinho quando `src/lib/legal.ts` estiver preenchido.
 */
export function DocumentoLegal({
  titulo,
  descricao,
  atualizadoEm,
  secoes,
  crumbLabel,
  crumbHref,
}: {
  titulo: string;
  descricao: string;
  atualizadoEm: string;
  secoes: Secao[];
  crumbLabel: string;
  crumbHref: string;
}) {
  return (
    <>
      <PageHeader
        compacto
        crumbs={[
          { href: "/", label: "Início" },
          { href: crumbHref, label: crumbLabel },
        ]}
        eyebrow={`Atualizado em ${formatarData(atualizadoEm)}`}
        titulo={titulo}
        descricao={descricao}
      />

      <Container className="py-14">
        {dadosPendentes.length > 0 && (
          <p className="mb-10 rounded-2xl border border-ouro-200 bg-ouro-50 p-5 text-[0.94rem] text-ouro-700">
            <strong className="font-semibold">Documento incompleto.</strong>{" "}
            Faltam preencher: {dadosPendentes.join(", ")}. Enquanto isso, este
            texto não identifica quem responde pelo serviço — e não deve ser
            usado como base de uma cobrança.
          </p>
        )}

        <div className="grid gap-12 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16">
          <nav
            aria-label="Sumário"
            className="lg:sticky lg:top-8 lg:self-start"
          >
            <h2 className="text-[0.78rem] font-bold tracking-[0.09em] text-muted uppercase">
              Sumário
            </h2>
            <ol className="mt-4 flex flex-col gap-2">
              {secoes.map((secao, i) => (
                <li key={secao.id}>
                  <a
                    href={`#${secao.id}`}
                    className="flex gap-2 text-[0.88rem] text-body transition-colors hover:text-brand-600"
                  >
                    <span className="shrink-0 tabular-nums text-muted">
                      {i + 1}.
                    </span>
                    {secao.titulo}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="flex max-w-[68ch] flex-col gap-10">
            {secoes.map((secao, i) => (
              <section key={secao.id} id={secao.id} className="scroll-mt-24">
                <h2 className="text-[1.35rem] leading-snug font-bold tracking-[-0.02em] text-ink">
                  <span className="text-muted tabular-nums">{i + 1}. </span>
                  {secao.titulo}
                </h2>
                <div className="comentario mt-4 text-[1rem] text-body">
                  {secao.corpo}
                </div>
              </section>
            ))}
          </div>
        </div>
      </Container>
    </>
  );
}
