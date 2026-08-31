"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Campo } from "@/components/auth/campo";
import { mensagemDeErro } from "@/lib/auth-erros";
import { supabaseNavegador } from "@/lib/supabase/browser";
export function FormularioEntrar() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);
    const { error } = await supabaseNavegador().auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });
    if (error) {
      setErro(mensagemDeErro(error));
      setEnviando(false);
      return;
    }

    // O destino é lido só agora, do próprio endereço. Usar `useSearchParams`
    // obrigaria um limite de Suspense e tiraria o formulário do HTML inicial
    // — numa tela de login, o campo tem que estar lá antes do JS rodar.
    const proximo =
      new URLSearchParams(window.location.search).get("proximo") ?? "/app";

    // `refresh` faz o servidor reler o cookie de sessão antes de navegar.
    router.refresh();
    router.push(proximo);
  }
  return (
    <form onSubmit={enviar} className="flex flex-col gap-5" noValidate>
      {erro && (
        <p
          role="alert"
          className="rounded-xl border border-vinho-200 bg-vinho-50 px-4 py-3 text-[0.9rem] text-vinho-700"
        >
          {erro}
        </p>
      )}

      <Campo
        rotulo="E-mail"
        tipo="email"
        nome="email"
        valor={email}
        aoMudar={setEmail}
        autoComplete="email"
        autoFocus
      />

      <div className="flex flex-col gap-2">
        <Campo
          rotulo="Senha"
          tipo="password"
          nome="senha"
          valor={senha}
          aoMudar={setSenha}
          autoComplete="current-password"
        />
        <Link
          href="/recuperar-senha"
          className="self-start text-[0.84rem] text-brand-600 underline decoration-brand-200 underline-offset-4 transition-colors hover:decoration-brand-500"
        >
          Esqueci minha senha
        </Link>
      </div>

      <button
        type="submit"
        disabled={enviando}
        className="mt-1 rounded-full bg-brand-600 px-6 py-3.5 font-semibold text-white shadow-[0_10px_28px_-14px_rgba(11,98,80,0.9)] transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-brand-200 disabled:shadow-none"
      >
        {enviando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
