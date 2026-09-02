"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Campo } from "@/components/auth/campo";
import { mensagemDeErro } from "@/lib/auth-erros";
import { supabaseNavegador } from "@/lib/supabase/browser";
const SENHA_MINIMA = 8;
export function FormularioCriarConta({
  checkoutAtivo,
}: {
  checkoutAtivo: boolean;
}) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [erroSenha, setErroSenha] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    if (senha.length < SENHA_MINIMA) {
      setErroSenha(`Use pelo menos ${SENHA_MINIMA} caracteres.`);
      return;
    }
    setErroSenha(null);
    setEnviando(true);
    const { data, error } = await supabaseNavegador().auth.signUp({
      email: email.trim(),
      password: senha,
      options: { data: { nome: nome.trim() } },
    });
    if (error) {
      setErro(mensagemDeErro(error));
      setEnviando(false);
      return;
    }

    // Com confirmação de e-mail ligada, o signup não devolve sessão: a conta
    // existe, mas só passa a valer depois do clique no link.
    if (!data.session) {
      setConfirmar(true);
      setEnviando(false);
      return;
    }

    router.refresh();
    router.push("/app");
  }
  if (confirmar) {
    return (
      <div
        role="status"
        className="flex flex-col gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-6"
      >
        <p className="font-display text-xl font-semibold text-brand-800">
          Confirme seu e-mail
        </p>
        <p className="text-[0.93rem] text-body">
          Enviamos um link para <strong className="text-ink">{email}</strong>.
          Clique nele para ativar a conta — se não aparecer em alguns minutos,
          procure na caixa de spam.
        </p>
      </div>
    );
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
        rotulo="Nome"
        nome="nome"
        valor={nome}
        aoMudar={setNome}
        autoComplete="given-name"
        autoFocus
      />

      <Campo
        rotulo="E-mail"
        tipo="email"
        nome="email"
        valor={email}
        aoMudar={setEmail}
        autoComplete="email"
      />

      <Campo
        rotulo="Senha"
        tipo="password"
        nome="senha"
        valor={senha}
        aoMudar={(v) => {
          setSenha(v);
          if (erroSenha && v.length >= SENHA_MINIMA) setErroSenha(null);
        }}
        autoComplete="new-password"
        erro={erroSenha ?? undefined}
        dica={`Pelo menos ${SENHA_MINIMA} caracteres.`}
      />

      <button
        type="submit"
        disabled={enviando}
        className="mt-1 rounded-full bg-brand-600 px-6 py-3.5 font-semibold text-white shadow-[0_10px_28px_-14px_rgba(11,98,80,0.9)] transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-brand-200 disabled:shadow-none"
      >
        {enviando ? "Criando conta…" : "Criar conta"}
      </button>

      <p className="text-[0.82rem] text-muted">
        Criar conta é grátis. A cobrança só existe quando você escolher um plano
        {checkoutAtivo
          ? " — e você tem 7 dias para desistir e receber de volta."
          : " — e hoje o checkout ainda não está ativo."}
      </p>
    </form>
  );
}
