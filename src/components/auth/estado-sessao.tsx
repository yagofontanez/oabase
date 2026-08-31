"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/browser";

/**
 * Estado de sessão no cabeçalho do site público.
 *
 * O cabeçalho público é estático de propósito — ler cookie no servidor
 * tornaria todas as páginas dinâmicas e derrubaria a geração estática, que é
 * a base da estratégia de busca. A saída é decidir isto no navegador: o HTML
 * sai com "Entrar / Criar conta" (correto para visitante e para robô) e
 * troca depois da hidratação se houver sessão.
 *
 * `getSession` lê do armazenamento local em vez de validar no servidor. Aqui
 * isso basta: o que está em jogo é qual link mostrar, não o que a pessoa pode
 * ler — quem decide acesso é o RLS.
 */
export function EstadoSessao({
  variante = "barra",
}: {
  variante?: "barra" | "linha";
}) {
  const [logado, setLogado] = useState(false);

  useEffect(() => {
    const supabase = supabaseNavegador();
    let vivo = true;

    supabase.auth.getSession().then(({ data }) => {
      if (vivo) setLogado(Boolean(data.session));
    });

    const { data: inscricao } = supabase.auth.onAuthStateChange(
      (_evento, sessao) => setLogado(Boolean(sessao)),
    );

    return () => {
      vivo = false;
      inscricao.subscription.unsubscribe();
    };
  }, []);

  if (variante === "linha") {
    return (
      <Link
        href={logado ? "/app" : "/entrar"}
        className="shrink-0 text-[0.9rem] font-medium whitespace-nowrap text-body transition-colors hover:text-brand-700"
      >
        {logado ? "Meu painel" : "Entrar"}
      </Link>
    );
  }

  if (logado) {
    return (
      <Link
        href="/app"
        className="rounded-full bg-brand-600 px-5 py-2.5 text-[0.92rem] font-semibold text-white shadow-[0_6px_18px_-8px_rgba(11,98,80,0.7)] transition-colors hover:bg-brand-700"
      >
        Meu painel
      </Link>
    );
  }

  return (
    <>
      <Link
        href="/entrar"
        className="hidden rounded-full px-4 py-2 text-[0.94rem] font-medium text-body transition-colors hover:bg-brand-50 hover:text-brand-700 sm:block"
      >
        Entrar
      </Link>
      <Link
        href="/criar-conta"
        className="rounded-full bg-brand-600 px-5 py-2.5 text-[0.92rem] font-semibold text-white shadow-[0_6px_18px_-8px_rgba(11,98,80,0.7)] transition-colors hover:bg-brand-700"
      >
        Criar conta
      </Link>
    </>
  );
}
