"use client";
import { useState } from "react";
import { Campo } from "@/components/auth/campo";
import { mensagemDeErro } from "@/lib/auth-erros";
import { supabaseNavegador } from "@/lib/supabase/browser";
export function FormularioRecuperar() {
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);
    const { error } = await supabaseNavegador().auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: `${window.location.origin}/redefinir-senha` },
    );
    if (error) {
      setErro(mensagemDeErro(error));
      setEnviando(false);
      return;
    }
    setEnviado(true);
    setEnviando(false);
  }
  if (enviado) {
    return (
      <div
        role="status"
        className="flex flex-col gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-6"
      >
        <p className="font-display text-xl font-semibold text-brand-800">
          Link enviado
        </p>
        <p className="text-[0.93rem] text-body">
          Se existir uma conta com <strong className="text-ink">{email}</strong>
          , o link de redefinição chega em instantes. Ele vale por uma hora.
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
        rotulo="E-mail da conta"
        tipo="email"
        nome="email"
        valor={email}
        aoMudar={setEmail}
        autoComplete="email"
        autoFocus
      />

      <button
        type="submit"
        disabled={enviando}
        className="rounded-full bg-brand-600 px-6 py-3.5 font-semibold text-white shadow-[0_10px_28px_-14px_rgba(11,98,80,0.9)] transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-brand-200 disabled:shadow-none"
      >
        {enviando ? "Enviando…" : "Enviar link de redefinição"}
      </button>
    </form>
  );
}
