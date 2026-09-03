import Link from "next/link";
import { Container } from "./container";
import { Wordmark } from "./wordmark";
import { EstadoSessao } from "./auth/estado-sessao";

/* Só rotas que existem. Link interno para 404 gasta orçamento de rastreamento e quebra a confiança de quem clica.
   Pendente da camada aberta: nenhuma — /blog e /glossario estão no ar. */
const nav = [
  { href: "/legislacao", label: "Legislação" },
  { href: "/sumulas", label: "Súmulas" },
  { href: "/glossario", label: "Glossário" },
  { href: "/exames", label: "Exames" },
  { href: "/estatisticas", label: "O que mais cai" },
];
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-line/70 bg-paper/80 backdrop-blur-xl">
      <Container className="flex h-[70px] items-center justify-between gap-6">
        <Link href="/" className="shrink-0" aria-label="OABase, página inicial">
          <Wordmark />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Seções">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-4 py-2 text-[0.94rem] font-medium text-body transition-colors hover:bg-brand-50 hover:text-brand-700"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <EstadoSessao />
        </div>
      </Container>

      {/* Abaixo de md o menu principal desaparece. Em vez de escondê-lo
          atrás de um botão, as seções ficam à vista numa faixa rolável. */}
      <div className="border-t border-line/70 md:hidden">
        <Container>
          <nav
            aria-label="Seções"
            className="flex gap-5 overflow-x-auto py-2.5"
          >
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 text-[0.9rem] font-medium whitespace-nowrap text-body transition-colors hover:text-brand-700"
              >
                {item.label}
              </Link>
            ))}
            <EstadoSessao variante="linha" />
          </nav>
        </Container>
      </div>
    </header>
  );
}
