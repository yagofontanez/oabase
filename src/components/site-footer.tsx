import Link from "next/link";
import { Container } from "./container";
import { Wordmark } from "./wordmark";
import { site } from "@/lib/site";

/* Apenas rotas publicadas. */
const colunas = [
  {
    titulo: "Conteúdo aberto",
    links: [
      { href: "/busca", label: "Buscar no acervo" },
      { href: "/proximo-exame", label: "Próximo exame" },
      { href: "/legislacao", label: "Legislação comentada" },
      { href: "/sumulas", label: "Súmulas Vinculantes" },
      { href: "/glossario", label: "Glossário jurídico" },
      { href: "/exames", label: "Exames e gabaritos" },
      { href: "/estatisticas", label: "O que mais cai" },
      { href: "/blog", label: "Blog" },
    ],
  },
  {
    titulo: "Produto",
    links: [
      { href: "/precos", label: "Planos" },
      { href: "/mcp", label: "MCP de estudos" },
      { href: "/criar-conta", label: "Criar conta" },
      { href: "/entrar", label: "Entrar" },
    ],
  },
  {
    titulo: "Legal",
    links: [
      { href: "/sobre", label: "Sobre e fontes" },
      { href: "/termos", label: "Termos de Uso" },
      { href: "/privacidade", label: "Privacidade" },
    ],
  },
];
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-hairline bg-sunk">
      <Container className="py-16">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="flex flex-col gap-3">
            <Wordmark />
            <p className="max-w-[32ch] text-[0.92rem] text-muted">
              {site.tagline}. Estude pelo que a banca realmente cobra.
            </p>
          </div>

          {colunas.map((coluna) => (
            <div key={coluna.titulo} className="flex flex-col gap-3">
              <h3 className="text-[0.86rem] font-semibold text-ink">
                {coluna.titulo}
              </h3>
              <ul className="flex flex-col gap-2">
                {coluna.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-[0.92rem] text-body transition-colors hover:text-brand-600"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-14 border-t border-hairline pt-6 text-[0.84rem] text-muted">
          © {new Date().getFullYear()} {site.name}. Conteúdo educacional
          independente, sem vínculo com a OAB ou com a banca examinadora.
        </p>
      </Container>
    </footer>
  );
}
