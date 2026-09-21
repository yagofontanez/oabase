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
      <Container className="flex h-[70px] items-center justify-between gap-6">
        <Link href="/" className="shrink-0" aria-label="OABase, página inicial">
          <Wordmark />
        </Link>

        {/* Sete itens já não cabem com folga em 1024px ao lado da marca e da
            sessão. Entre 768 e 1280, a faixa rolável abaixo preserva todos
            visíveis sem reduzir toque, texto ou contraste. */}
        <nav className="hidden items-center gap-1 xl:flex" aria-label="Seções">
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

      {/* Abaixo de xl o menu principal desaparece. Em vez de escondê-lo
          atrás de um botão, as seções ficam à vista numa faixa rolável. */}
      <div className="border-t border-line/70 xl:hidden">
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
