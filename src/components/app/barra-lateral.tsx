"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { NavegacaoApp } from "./navegacao";

const CHAVE = "oabase:barra-recolhida";

/**
 * Trilho lateral do painel, recolhível.
 *
 * O estado vive aqui e não no layout do servidor: recolher é preferência de
 * quem usa, não dado de sessão. Fica em `localStorage` para sobreviver à
 * navegação — e a leitura acontece depois da montagem, porque ler no
 * servidor daria divergência de hidratação.
 */
export function BarraLateral() {
  const [recolhida, setRecolhida] = useState(false);
  const [pronta, setPronta] = useState(false);

  useEffect(() => {
    try {
      setRecolhida(window.localStorage.getItem(CHAVE) === "1");
    } catch {
      // Navegador com armazenamento bloqueado: segue expandida.
    }
    setPronta(true);
  }, []);

  function alternar() {
    setRecolhida((atual) => {
      const proxima = !atual;
      try {
        window.localStorage.setItem(CHAVE, proxima ? "1" : "0");
      } catch {
        // Preferência não persiste, mas a sessão atual funciona.
      }
      return proxima;
    });
  }

  return (
    <aside
      className={`hidden shrink-0 border-r border-line py-6 lg:block ${
        recolhida ? "w-[76px] px-3" : "w-[232px] px-4"
      } ${pronta ? "transition-[width] duration-200" : ""}`}
    >
      <div className="sticky top-[86px] flex flex-col gap-5">
        <button
          type="button"
          onClick={alternar}
          aria-expanded={!recolhida}
          title={recolhida ? "Expandir menu" : "Recolher menu"}
          className={`flex items-center gap-2.5 rounded-[10px] py-2 text-[0.86rem] font-medium text-muted transition-colors hover:bg-sunk hover:text-ink ${
            recolhida ? "justify-center px-0" : "px-2.5"
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-[17px] w-[17px] shrink-0"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M9 4v16" />
            <path d={recolhida ? "M14 9l2.5 3-2.5 3" : "M17 9l-2.5 3 2.5 3"} />
          </svg>
          <span className={recolhida ? "sr-only" : undefined}>Recolher</span>
        </button>

        <NavegacaoApp orientacao="coluna" recolhida={recolhida} />

        {!recolhida && (
          <div className="rounded-[14px] bg-sunk p-4">
            <p className="text-[0.86rem] font-semibold text-ink">
              Conteúdo aberto
            </p>
            <p className="mt-1 text-[0.84rem] text-muted">
              Legislação, exames e estatísticas seguem livres, com ou sem plano.
            </p>
            <Link
              href="/"
              className="mt-3 inline-block text-[0.86rem] font-semibold text-brand-600 underline decoration-brand-200 underline-offset-4 transition-colors hover:decoration-brand-500"
            >
              Ir para o site
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
}
