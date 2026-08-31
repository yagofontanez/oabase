"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Navegação da área logada.
 *
 * Cliente por um motivo só: marcar o item ativo depende do caminho atual.
 * Como `/app` é dinâmica de qualquer forma, isso não custa nada em cache.
 */

const ITENS = [
  {
    href: "/app",
    rotulo: "Painel",
    icone: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
  },
  {
    href: "/app/estudar",
    rotulo: "Estudar",
    icone: (
      <>
        <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v15H5.5A1.5 1.5 0 0 0 4 19.5z" />
        <path d="M4 19.5A1.5 1.5 0 0 1 5.5 21H19" />
      </>
    ),
  },
  {
    href: "/app/desempenho",
    rotulo: "Desempenho",
    icone: (
      <>
        <path d="M3 21h18" />
        <rect x="5" y="12" width="4" height="6" rx="1" />
        <rect x="11" y="8" width="4" height="10" rx="1" />
        <rect x="17" y="4" width="4" height="14" rx="1" />
      </>
    ),
  },
  {
    href: "/app/configuracoes",
    rotulo: "Configurações",
    icone: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M2 12h3M19 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2" />
      </>
    ),
  },
];

function Icone({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px] shrink-0"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function NavegacaoApp({
  orientacao,
  recolhida = false,
}: {
  orientacao: "coluna" | "linha";
  recolhida?: boolean;
}) {
  const caminho = usePathname();

  const ativo = (href: string) =>
    href === "/app" ? caminho === "/app" : caminho.startsWith(href);

  if (orientacao === "linha") {
    return (
      <nav aria-label="Seções da conta" className="flex gap-1 overflow-x-auto">
        {ITENS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={ativo(item.href) ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-[0.9rem] font-medium whitespace-nowrap transition-colors ${
              ativo(item.href)
                ? "bg-brand-50 text-brand-700"
                : "text-body hover:bg-sunk"
            }`}
          >
            <Icone>{item.icone}</Icone>
            {item.rotulo}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav aria-label="Seções da conta" className="flex flex-col gap-1">
      {ITENS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={ativo(item.href) ? "page" : undefined}
          // Recolhida, o rótulo sai do fluxo mas continua no HTML: leitor de
          // tela e busca por texto continuam achando o item.
          title={recolhida ? item.rotulo : undefined}
          className={`flex items-center rounded-[12px] py-2.5 text-[0.94rem] font-medium transition-colors ${
            recolhida ? "justify-center px-0" : "gap-3 px-3.5"
          } ${
            ativo(item.href)
              ? "bg-brand-50 text-brand-700"
              : "text-body hover:bg-sunk hover:text-ink"
          }`}
        >
          <Icone>{item.icone}</Icone>
          <span className={recolhida ? "sr-only" : undefined}>
            {item.rotulo}
          </span>
        </Link>
      ))}
    </nav>
  );
}
