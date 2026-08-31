import Link from "next/link";
import { JsonLd } from "@/lib/jsonld";
import { abs } from "@/lib/site";
export type Crumb = { href: string; label: string };

/**
 * Trilha visual + BreadcrumbList em JSON-LD.
 * O breadcrumb aparece no resultado de busca no lugar da URL crua,
 * o que melhora o CTR em páginas profundas como /legislacao/x/artigo-y.
 */
export function Breadcrumbs({
  items,
  tom = "claro",
}: {
  items: Crumb[];
  tom?: "claro" | "escuro";
}) {
  const escuro = tom === "escuro";
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: items.map((item, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: item.label,
            item: abs(item.href),
          })),
        }}
      />
      <nav aria-label="Você está em">
        <ol
          className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.74rem] ${
            escuro ? "text-brand-300" : "text-muted"
          }`}
        >
          {items.map((item, i) => (
            <li key={item.href} className="flex items-center gap-2">
              {i > 0 && (
                <span
                  aria-hidden="true"
                  className={escuro ? "text-white/25" : "text-line"}
                >
                  /
                </span>
              )}
              {i === items.length - 1 ? (
                <span className={escuro ? "text-brand-100" : "text-body"}>
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className={
                    escuro
                      ? "transition-colors hover:text-white"
                      : "transition-colors hover:text-brand-600"
                  }
                >
                  {item.label}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
