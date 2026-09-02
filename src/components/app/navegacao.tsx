"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Navegação da área logada.
 *
 * Cliente por um motivo só: marcar o item ativo depende do caminho atual.
 * Como `/app` é dinâmica de qualquer forma, isso não custa nada em cache.
 *
 * Três apresentações da mesma lista: `trilho` (coluna escura no desktop),
 * `linha` (barra rolável no celular) e o título da seção no cabeçalho, que
 * sai daqui para não haver duas listas de rótulos para manter em sincronia.
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
    href: "/app/questoes",
    rotulo: "Questões",
    icone: (
      <>
        <path d="M9.2 9a2.8 2.8 0 1 1 3.8 2.6c-.7.3-1 .9-1 1.6v.4" />
        <path d="M12 17.6h.01" />
        <circle cx="12" cy="12" r="9" />
      </>
    ),
  },
  {
    href: "/app/simulado",
    rotulo: "Simulado",
    icone: (
      <>
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9.5V13l2.4 1.7M9 2h6" />
      </>
    ),
  },
  {
    href: "/app/anotacoes",
    rotulo: "Anotações",
    icone: (
      <>
        <rect x="3" y="3.5" width="7.5" height="7.5" rx="1.6" />
        <rect x="13.5" y="13" width="7.5" height="7.5" rx="1.6" />
        <path d="M10.5 7.2h3.6a2 2 0 0 1 2 2v3.8" />
      </>
    ),
  },
  {
    href: "/app/plano",
    rotulo: "Plano",
    icone: (
      <>
        <path d="M8 3v3M16 3v3" />
        <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" />
        <path d="M3.5 10h17M8 14h3M8 17.5h6" />
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
    href: "/app/suporte",
    rotulo: "Suporte",
    icone: (
      <>
        <path d="M4.5 5.5h15a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H12l-4.5 3v-3H4.5A1.5 1.5 0 0 1 3 15V7a1.5 1.5 0 0 1 1.5-1.5z" />
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

function estaAtivo(caminho: string, href: string) {
  return href === "/app" ? caminho === "/app" : caminho.startsWith(href);
}

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

/** Telas que existem sem ficar na navegação — chegam por botão, não por menu. */
const FORA_DO_MENU: Record<string, string> = {
  "/app/assinar": "Assinar",
  // Ferramentas de editor. Fora do menu porque a navegação é de quem estuda,
  // e um item que 100% das pessoas não podem abrir é ruído para 100% delas.
  // O caminho até elas está em Configurações, e só para quem é editor.
  "/app/revisao": "Triagem de disciplina",
  "/app/redacao": "Redação de comentário",
  "/app/vinculos": "Vincular dispositivo",
  "/app/admin": "Administração",
  "/app/admin/suporte": "Suporte · fila",
};

/** Rótulo da tela atual, para o cabeçalho. Uma lista só, uma verdade só. */
export function TituloDaSecao() {
  const caminho = usePathname();
  const rotulo =
    FORA_DO_MENU[caminho] ??
    [...ITENS].reverse().find((i) => estaAtivo(caminho, i.href))?.rotulo;
  if (!rotulo) return null;
  return <span className="text-[0.95rem] font-semibold text-ink">{rotulo}</span>;
}

export function NavegacaoApp({
  orientacao,
  recolhida = false,
}: {
  orientacao: "trilho" | "linha";
  recolhida?: boolean;
}) {
  const caminho = usePathname();
  const ativo = (href: string) => estaAtivo(caminho, href);

  if (orientacao === "linha") {
    return (
      <nav
        aria-label="Seções da conta"
        className="rolagem-fina flex gap-1 overflow-x-auto"
      >
        {ITENS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={ativo(item.href) ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-[0.9rem] font-medium whitespace-nowrap transition-colors ${
              ativo(item.href)
                ? "bg-brand-700 text-white"
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
    <nav aria-label="Seções da conta" className="flex flex-col gap-0.5">
      {ITENS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={ativo(item.href) ? "page" : undefined}
          // Recolhido, o rótulo sai do fluxo mas continua no HTML: leitor de
          // tela e busca por texto continuam achando o item.
          title={recolhida ? item.rotulo : undefined}
          className={`relative flex items-center rounded-[11px] py-2.5 text-[0.94rem] font-medium transition-colors ${
            recolhida ? "justify-center px-0" : "gap-3 px-3"
          } ${
            ativo(item.href)
              ? "bg-white/[0.13] text-white"
              : "text-white/62 hover:bg-white/[0.07] hover:text-white"
          }`}
        >
          {/* Marca ativa em âmbar: no trilho inteiro é o único traço quente,
              e por isso o olho acha a tela atual sem ler rótulo. */}
          {ativo(item.href) && (
            <span
              aria-hidden="true"
              className="absolute top-1/2 -left-3 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-ouro-400"
            />
          )}
          <Icone>{item.icone}</Icone>
          <span className={recolhida ? "sr-only" : undefined}>
            {item.rotulo}
          </span>
        </Link>
      ))}
    </nav>
  );
}
