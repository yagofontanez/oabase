import type { ReactNode } from "react";
import { Container } from "./container";
import { Breadcrumbs, type Crumb } from "./breadcrumbs";

/**
 * Abertura das páginas internas.
 *
 * Clara, como o resto do sistema: a cor entra em selo e em acento, não em
 * faixa escura no topo. Páginas de leitura precisam abrir leves — o peso
 * fica reservado aos planos esmeralda, que aparecem no meio e no fim.
 */
export function PageHeader({
  crumbs,
  eyebrow,
  titulo,
  descricao,
  children,
  compacto = false,
}: {
  crumbs: Crumb[];
  eyebrow?: ReactNode;
  titulo: ReactNode;
  descricao?: ReactNode;
  children?: ReactNode;
  /** Para páginas de leitura, onde o título já é longo. */
  compacto?: boolean;
}) {
  return (
    <section className="relative overflow-hidden border-b border-line">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-[55%] right-[-10%] h-[620px] w-[620px] rounded-full opacity-45 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(98,179,156,0.32) 0%, rgba(245,248,246,0) 70%)",
        }}
      />

      <Container
        className={`relative flex flex-col gap-5 ${compacto ? "py-10 sm:py-12" : "py-12 sm:py-16"}`}
      >
        <Breadcrumbs items={crumbs} />

        {eyebrow && <span className="selo self-start">{eyebrow}</span>}

        <h1
          className={`font-extrabold tracking-[-0.035em] text-ink ${
            compacto
              ? "text-[clamp(1.9rem,3.6vw,2.6rem)] leading-[1.08]"
              : "text-[clamp(2.2rem,4.2vw,3.2rem)] leading-[1.05]"
          }`}
        >
          {titulo}
        </h1>

        {descricao && (
          <p className="max-w-[58ch] text-[1.05rem] leading-relaxed text-body">
            {descricao}
          </p>
        )}

        {children}
      </Container>
    </section>
  );
}
