"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Campo } from "@/components/auth/campo";
import { mensagemDeErro } from "@/lib/auth-erros";
import { supabaseNavegador } from "@/lib/supabase/browser";
import { navegar } from "@/components/barra-de-navegacao";

const Alerta = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-[18px] w-[18px] shrink-0"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5" />
    <path d="M12 16.2h.01" />
  </svg>
);

const Girando = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    className="h-[18px] w-[18px] shrink-0 animate-spin"
    aria-hidden="true"
  >
    <circle
      cx="12"
      cy="12"
      r="9"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeOpacity="0.3"
    />
    <path
      d="M21 12a9 9 0 0 0-9-9"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
  </svg>
);

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
    const destinoPedido = new URLSearchParams(window.location.search).get("proximo");
    // `proximo` também preserva o pedido OAuth. Só aceitamos caminho interno:
    // sem isso, um link de login poderia virar redirecionamento para phishing.
    const proximo =
      destinoPedido?.startsWith("/") && !destinoPedido.startsWith("//")
        ? destinoPedido
        : "/app";

    // `refresh` faz o servidor reler o cookie de sessão antes de navegar.
    router.refresh();
    navegar();
    router.push(proximo);
  }
  return (
    <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
      {erro && (
        <p
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-vinho-200 bg-vinho-50 px-4 py-3 text-[0.9rem] text-vinho-700"
        >
          <span className="mt-0.5">
            <Alerta />
          </span>
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
        aria-busy={enviando}
        className="mt-1 flex items-center justify-center gap-2.5 rounded-full bg-brand-600 px-6 py-3.5 font-semibold text-white shadow-[0_10px_28px_-14px_rgba(11,98,80,0.9)] transition-[background-color,transform] active:scale-[0.98] hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-brand-200 disabled:shadow-none disabled:active:scale-100"
      >
        {enviando && <Girando />}
        {enviando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
