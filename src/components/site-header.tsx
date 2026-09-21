import Link from "next/link";
import { Container } from "./container";
import { Wordmark } from "./wordmark";
import { EstadoSessao } from "./auth/estado-sessao";

/* Só rotas que existem. Link interno para 404 gasta orçamento de rastreamento e quebra a confiança de quem clica.
   Pendente da camada aberta: nenhuma — /blog e /glossario estão no ar. */
const nav = [
  // Primeiro item porque é o que traz a maior parte de quem chega buscando —
  // "quando é a próxima prova da OAB" — e é a única seção com data de
  // validade: passada a aplicação, ela já aponta para a seguinte sozinha.
  { href: "/proximo-exame", label: "Próximo exame" },
  { href: "/legislacao", label: "Legislação" },
  { href: "/sumulas", label: "Súmulas" },
  { href: "/glossario", label: "Glossário" },
  { href: "/exames", label: "Exames" },
  { href: "/estatisticas", label: "O que mais cai" },
  { href: "/concursos", label: "Concursos" },
];
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-line/70 bg-paper/80 backdrop-blur-xl">
      {/* O conteúdo das páginas para em 6xl; o cabeçalho pode usar mais
          largura no desktop grande porque precisa acomodar marca, busca,
          sessão e as sete portas de entrada sem quebrar nenhum rótulo. */}
      <Container className="flex h-[70px] items-center justify-between gap-6 2xl:max-w-[90rem]">
        <Link href="/" className="shrink-0" aria-label="OABase, página inicial">
          <Wordmark />
        </Link>

        {/* O limite é o espaço útil de 6xl, não só a largura da viewport:
            com sete itens, em 1280px os textos quebrariam contra a sessão.
            Até 1536px a faixa rolável preserva os rótulos inteiros; a partir
            daí o cabeçalho ganha largura própria para a lista horizontal. */}
        <nav className="hidden items-center gap-1 2xl:flex" aria-label="Seções">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-3 py-2 text-[0.9rem] font-medium whitespace-nowrap text-body transition-colors hover:bg-brand-50 hover:text-brand-700"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {/* A busca fica junto da sessão, e não na lista de seções: ela não
              é uma seção, e um sétimo item estouraria o menu horizontal
              antes disso. É também o lugar onde todo mundo já procura. */}
          <Link
            href="/busca"
            aria-label="Buscar no acervo"
            className="flex h-10 w-10 items-center justify-center rounded-full text-body transition-colors hover:bg-brand-50 hover:text-brand-700"
          >
            <svg
              width="19"
              height="19"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.1"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </Link>
          <EstadoSessao />
        </div>
      </Container>

      {/* Abaixo de 2xl o menu principal desaparece. Em vez de escondê-lo
          atrás de um botão, as seções ficam à vista numa faixa rolável. */}
      <div className="border-t border-line/70 2xl:hidden">
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
