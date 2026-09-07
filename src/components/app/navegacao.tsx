"use client";

import Link, { useLinkStatus } from "next/link";
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
    href: "/app/forum",
    rotulo: "Fórum",
    icone: (
      <>
        <path d="M8 4.5h11A1.5 1.5 0 0 1 20.5 6v7A1.5 1.5 0 0 1 19 14.5h-2v3l-3.5-3H8A1.5 1.5 0 0 1 6.5 13V6A1.5 1.5 0 0 1 8 4.5z" />
        <path d="M6.5 8H5a1.5 1.5 0 0 0-1.5 1.5v7A1.5 1.5 0 0 0 5 18h1v2.5l3-2.5" />
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

/**
 * Ponto no item que a pessoa acabou de clicar.
 *
 * `useLinkStatus` só reporta pendência dentro do próprio `<Link>`. Isto cobre
 * a janela em que a fronteira de carregamento ainda não apareceu — rede lenta,
 * prefetch incompleto — e some sozinho quando a rota chega. Em navegação
 * instantânea ninguém chega a ver.
 */
function PontoPendente() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span aria-hidden="true" className="ponto-pendente ml-auto shrink-0" />
  );
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

/**
 * Abas de quem opera o produto.
 *
 * Ficam numa lista separada porque a navegação padrão é de quem estuda: um
 * item que 100% das pessoas não podem abrir é ruído para 100% delas. Mas
 * esconder de quem **pode** é pior — quem administra precisa da aba, não de
 * um link no fundo de Configurações. O layout diz quem é, e só aí elas
 * entram.
 */
const ITENS_ADMIN = [
  {
    href: "/app/admin",
    rotulo: "Administração",
    icone: (
      <>
        <path d="M3 20h18M6 20v-7M11 20V7M16 20v-4M21 20V4" />
      </>
    ),
  },
  {
    href: "/app/admin/suporte",
    rotulo: "Fila de suporte",
    icone: (
      <>
        <rect x="3" y="4.5" width="5" height="15" rx="1.5" />
        <rect x="9.5" y="4.5" width="5" height="10" rx="1.5" />
        <rect x="16" y="4.5" width="5" height="6" rx="1.5" />
      </>
    ),
  },
];

const ITENS_EDITOR = [
  {
    href: "/app/redacao",
    rotulo: "Redação",
    icone: (
      <>
        <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
        <path d="M13.5 6.5l4 4" />
      </>
    ),
  },
  {
    href: "/app/redacao/comentarios",
    rotulo: "Comentários",
    icone: (
      <>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </>
    ),
  },
  {
    href: "/app/revisao",
    rotulo: "Triagem",
    icone: (
      <>
        <path d="M4 7.5h11M4 12h11M4 16.5h7" />
        <path d="M17.5 16l2 2 3.5-4" />
      </>
    ),
  },
  {
    href: "/app/vinculos",
    rotulo: "Vínculos",
    icone: (
      <>
        <path d="M10 13.5a3.5 3.5 0 0 0 5 0l2.5-2.5a3.5 3.5 0 0 0-5-5L11 7.5" />
        <path d="M14 10.5a3.5 3.5 0 0 0-5 0L6.5 13a3.5 3.5 0 0 0 5 5l1.5-1.5" />
      </>
    ),
  },
];

/** Telas que existem sem ficar na navegação — chegam por botão, não por menu. */
const FORA_DO_MENU: Record<string, string> = {
  "/app/assinar": "Assinar",
  "/app/redacao/comentarios": "Comentários",
};

/**
 * Rótulo da tela atual, para o cabeçalho.
 *
 * Procura em todas as listas, inclusive nas de operação: o título não depende
 * de permissão — quem chegou na tela já passou pela porta, e um cabeçalho em
 * branco é pior do que um rótulo a mais.
 */
export function TituloDaSecao() {
  const caminho = usePathname();
  const todos = [...ITENS, ...ITENS_ADMIN, ...ITENS_EDITOR];
  const rotulo =
    FORA_DO_MENU[caminho] ??
    [...todos].reverse().find((i) => estaAtivo(caminho, i.href))?.rotulo;
  if (!rotulo) return null;
  return <span className="text-[0.95rem] font-semibold text-ink">{rotulo}</span>;
}

export function NavegacaoApp({
  orientacao,
  recolhida = false,
  admin = false,
  editor = false,
}: {
  orientacao: "trilho" | "linha";
  recolhida?: boolean;
  admin?: boolean;
  editor?: boolean;
}) {
  const caminho = usePathname();
  const ativo = (href: string) => estaAtivo(caminho, href);

  // As abas de operação vêm depois das de estudo, e nunca no meio: mesmo para
  // quem administra, o produto continua sendo o de cima. E vêm separadas —
  // emendadas na mesma lista, "Redação" lê como se fosse uma tela de estudo.
  const operacao = [
    ...(editor ? ITENS_EDITOR : []),
    ...(admin ? ITENS_ADMIN : []),
  ];

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

        {operacao.length > 0 && (
          <span
            aria-hidden="true"
            className="mx-1.5 my-1.5 w-px shrink-0 bg-hairline"
          />
        )}

        {operacao.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={ativo(item.href) ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-[0.9rem] font-medium whitespace-nowrap transition-colors ${
              ativo(item.href)
                ? "bg-ouro-500 text-white"
                : "text-muted hover:bg-sunk hover:text-ink"
            }`}
          >
            <Icone>{item.icone}</Icone>
            {item.rotulo}
          </Link>
        ))}
      </nav>
    );
  }

  const NoTrilho = ({ item }: { item: (typeof ITENS)[number] }) => (
    <Link
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
      <span className={recolhida ? "sr-only" : undefined}>{item.rotulo}</span>
      {!recolhida && <PontoPendente />}
    </Link>
  );

  return (
    <nav aria-label="Seções da conta" className="flex flex-col gap-0.5">
      {ITENS.map((item) => (
        <NoTrilho key={item.href} item={item} />
      ))}

      {operacao.length > 0 && (
        <>
          {/* Um fio e uma palavra separam as duas naturezas de tela. Sem
              isso, "Redação" entra na lista lendo como mais uma tela de
              estudo — e a pessoa que administra é a mesma que estuda. */}
          <span
            aria-hidden="true"
            className={`my-3 block h-px bg-white/12 ${recolhida ? "" : "mx-1"}`}
          />
          {!recolhida && (
            <span className="px-3 pb-1 text-[0.68rem] font-bold tracking-[0.14em] text-white/35 uppercase">
              Operação
            </span>
          )}
          {operacao.map((item) => (
            <NoTrilho key={item.href} item={item} />
          ))}
        </>
      )}
    </nav>
  );
}
