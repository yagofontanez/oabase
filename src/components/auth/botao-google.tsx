"use client";

import { useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/browser";

/**
 * Entrar ou criar conta com o Google (Supabase Auth, fluxo PKCE).
 *
 * O mesmo botão serve às duas telas: o Supabase cria a conta na primeira vez
 * e entra nas seguintes. Conta que já existia com e-mail e senha é ligada à
 * identidade do Google pelo e-mail, que o Google entrega verificado.
 *
 * O destino (`proximo`) é lido do endereço na hora do clique — sem
 * `useSearchParams`, que tiraria o botão do HTML inicial (ver AGENTS.md,
 * Autenticação) — e validado de novo em /auth/callback, que é quem de fato
 * redireciona.
 */
export function BotaoGoogle({ rotulo = "Continuar com o Google" }: { rotulo?: string }) {
  const [indo, setIndo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function entrar() {
    setIndo(true);
    setErro(null);
    const proximo = new URLSearchParams(window.location.search).get("proximo") ?? "/app";
    const volta = new URL("/auth/callback", window.location.origin);
    volta.searchParams.set("proximo", proximo);
    const { error } = await supabaseNavegador().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: volta.toString(),
        // Deixa escolher a conta: quem tem conta pessoal e da faculdade no
        // mesmo navegador não entra com a errada sem perceber.
        queryParams: { prompt: "select_account" },
      },
    });
    // Sem erro, o navegador já está saindo para o Google.
    if (error) {
      setErro("Não consegui abrir o login do Google. Tente de novo.");
      setIndo(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={entrar}
        disabled={indo}
        aria-busy={indo}
        className="flex items-center justify-center gap-3 rounded-full border border-hairline bg-surface px-6 py-3 font-semibold text-ink shadow-[0_6px_18px_-12px_rgba(22,32,29,0.5)] transition-[border-color,transform] hover:border-brand-300 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
      >
        {/* Marca do Google nas cores oficiais, como pede o guia de uso. */}
        <svg viewBox="0 0 48 48" className="h-5 w-5 shrink-0" aria-hidden="true">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
        </svg>
        {indo ? "Abrindo o Google…" : rotulo}
      </button>
      {erro && (
        <p role="alert" className="text-center text-[0.84rem] text-vinho-700">
          {erro}
        </p>
      )}
    </div>
  );
}

/** Divisor entre o botão do Google e o formulário de e-mail. */
export function OuComEmail() {
  return (
    <div className="flex items-center gap-3 text-[0.8rem] font-medium text-muted" aria-hidden="true">
      <span className="h-px flex-1 bg-line" />
      ou com e-mail
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
