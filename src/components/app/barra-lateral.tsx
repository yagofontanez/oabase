"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { BotaoSair } from "@/components/auth/botao-sair";
import { Wordmark } from "@/components/wordmark";
import { NavegacaoApp } from "./navegacao";
import { abrirWidgetFoco } from "./widget-foco";

const CHAVE = "oabase:barra-recolhida";

export type ResumoDoPlano = {
  /** Nome de exibição do plano, já resolvido no servidor. */
  nome: string | null;
  validoAte: string | null;
};

/**
 * Trilho lateral do painel.
 *
 * Escuro de propósito. A área logada é a mesa de trabalho e o site aberto é a
 * biblioteca: quem tem plano precisa saber, de relance, em qual das duas
 * está. O trilho é o único elemento que carrega essa distinção — a paleta,
 * a tipografia e os cartões continuam os mesmos dos dois lados.
 *
 * O estado de recolhido vive aqui e não no layout do servidor: recolher é
 * preferência de quem usa, não dado de sessão. Fica em `localStorage` para
 * sobreviver à navegação — e a leitura acontece depois da montagem, porque
 * ler no servidor daria divergência de hidratação.
 */
export function BarraLateral({
  nome,
  email,
  inicial,
  plano,
  admin = false,
  editor = false,
}: {
  nome: string;
  email: string;
  inicial: string;
  plano: ResumoDoPlano;
  /** Quem opera o produto vê as abas de operação. Ver `navegacao.tsx`. */
  admin?: boolean;
  editor?: boolean;
}) {
  const [pronta, setPronta] = useState(false);

  /* `recolhida` é uma leitura do `localStorage`, e estado que espelha
     armazenamento externo pede `useSyncExternalStore`: o snapshot do servidor
     é sempre `false` (o trilho começa expandido no HTML), e depois da
     hidratação a inscrição aplica a preferência salva sem divergir. O
     `setItem` de `alternar` re-renderiza pela mesma via — o evento `storage`
     propagado no mesmo documento. */
  const recolhida = useSyncExternalStore(
    (aoMudar) => {
      window.addEventListener("storage", aoMudar);
      return () => window.removeEventListener("storage", aoMudar);
    },
    () => {
      try {
        return window.localStorage.getItem(CHAVE) === "1";
      } catch {
        return false;
      }
    },
    () => false,
  );

  /* `pronta` liga a transição de largura só depois do primeiro quadro — é o
     que impede o trilho de animar de 248px para 78px na montagem quando a
     preferência salva é recolhida. Escrever `true` na montagem é o caso que
     `react-hooks/set-state-in-effect` não aceita; bloqueio só neste bloco. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setPronta(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  function alternar() {
    const proxima = !recolhida;
    try {
      window.localStorage.setItem(CHAVE, proxima ? "1" : "0");
    } catch {
      // Preferência não persiste, mas a sessão atual funciona.
    }
    window.dispatchEvent(new StorageEvent("storage", { key: CHAVE }));
  }

  return (
    <aside
      className={`trilho-fundo hidden h-full shrink-0 flex-col gap-6 py-5 text-white lg:flex ${
        recolhida ? "w-[78px] px-4" : "w-[248px] px-5"
      } ${pronta ? "transition-[width] duration-200" : ""}`}
    >
      <div
        className={`flex items-center ${
          recolhida ? "justify-center" : "justify-between"
        }`}
      >
        {!recolhida && (
          <Link href="/app" aria-label="OABase, painel">
            <Wordmark tom="claro" />
          </Link>
        )}
        <button
          type="button"
          onClick={alternar}
          aria-expanded={!recolhida}
          title={recolhida ? "Expandir menu" : "Recolher menu"}
          className="rounded-[10px] p-1.5 text-white/45 transition-colors hover:bg-white/10 hover:text-white"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-[18px] w-[18px]"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="16" rx="2.5" />
            <path d="M9 4v16" />
            <path d={recolhida ? "M14 9l2.5 3-2.5 3" : "M17 9l-2.5 3 2.5 3"} />
          </svg>
          <span className="sr-only">
            {recolhida ? "Expandir menu" : "Recolher menu"}
          </span>
        </button>
      </div>

      {/* Modo foco fica acima da navegação porque não é uma tela: é o que a
          pessoa vem fazer. Âmbar, o único botão cheio do trilho. */}
      <button
        type="button"
        onClick={() => abrirWidgetFoco()}
        title="Modo foco"
        className={`flex items-center rounded-full bg-ouro-400 font-semibold text-brand-900 transition-colors hover:bg-ouro-200 ${
          recolhida
            ? "justify-center px-0 py-2.5"
            : "gap-2 px-4 py-2.5 text-[0.94rem]"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-[17px] w-[17px] shrink-0"
          aria-hidden="true"
        >
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9.5V13l2.2 1.6" />
          <path d="M9 2h6" />
        </svg>
        <span className={recolhida ? "sr-only" : undefined}>Modo foco</span>
      </button>

      {/* A lista rola dentro do trilho; o cabeçalho, o modo foco e o rodapé
          ficam parados. Sem isso, o trilho cresceu com as abas de operação,
          estourou a altura da janela e o `overflow-hidden` do layout cortou o
          fim da lista **e** o rodapé inteiro — o avatar e o botão de sair
          simplesmente sumiam em tela baixa.

          A folga horizontal existe para a marca âmbar da tela ativa, que fica
          em `-left-3`: sem ela, a rolagem vertical recorta o eixo x junto e
          a marca desaparece. */}
      <div className="rolagem-fina -mx-3 min-h-0 flex-1 overflow-y-auto px-3">
        <NavegacaoApp
          orientacao="trilho"
          recolhida={recolhida}
          admin={admin}
          editor={editor}
        />
      </div>

      <div className="mt-auto flex flex-col gap-3">
        {!recolhida && (
          <Link
            href="/"
            className="flex items-center justify-between gap-2 rounded-[13px] border border-white/10 px-3.5 py-3 transition-colors hover:border-white/25"
          >
            <span className="flex flex-col">
              <span className="text-[0.86rem] font-semibold text-white">
                Conteúdo aberto
              </span>
              <span className="text-[0.8rem] text-white/45">
                Legislação e exames, sem plano
              </span>
            </span>
            <span aria-hidden="true" className="text-white/35">
              ↗
            </span>
          </Link>
        )}

        <div
          className={`flex gap-3 border-t border-white/10 pt-4 ${
            recolhida ? "flex-col items-center" : "items-center"
          }`}
        >
          <Link
            href="/app/configuracoes"
            title={`${nome} · ${email}`}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.14] text-[0.86rem] font-bold text-white transition-colors hover:bg-white/25"
          >
            {inicial}
            <span className="sr-only">Configurações da conta</span>
          </Link>
          {!recolhida && (
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[0.88rem] font-semibold text-white">
                {nome}
              </span>
              <span className="truncate text-[0.78rem] text-white/45">
                {plano.nome ? `Plano ${plano.nome}` : "Sem plano ativo"}
              </span>
            </span>
          )}
          <span className={recolhida ? undefined : "ml-auto"}>
            <BotaoSair tom="claro" />
          </span>
        </div>
      </div>
    </aside>
  );
}
