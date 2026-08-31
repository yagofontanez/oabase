"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Campo } from "@/components/auth/campo";
import { mensagemDeErro } from "@/lib/auth-erros";
import { supabaseNavegador } from "@/lib/supabase/browser";
const SENHA_MINIMA = 8;
export function FormularioRedefinir() {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [erroSenha, setErroSenha] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    if (senha.length < SENHA_MINIMA) {
      setErroSenha(`Use pelo menos ${SENHA_MINIMA} caracteres.`);
      return;
    }
    setErroSenha(null);
    setEnviando(true);

    // O link do e-mail já trouxe uma sessão de recuperação; por isso o
    // update funciona sem pedir a senha antiga.
    const { error } = await supabaseNavegador().auth.updateUser({
      password: senha,
    });
    if (error) {
      setErro(mensagemDeErro(error));
      setEnviando(false);
      return;
    }
    router.refresh();
    router.push("/app");
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
        rotulo="Nova senha"
        tipo="password"
        nome="senha"
        valor={senha}
        aoMudar={(v) => {
          setSenha(v);
          if (erroSenha && v.length >= SENHA_MINIMA) setErroSenha(null);
        }}
        autoComplete="new-password"
        autoFocus
        erro={erroSenha ?? undefined}
        dica={`Pelo menos ${SENHA_MINIMA} caracteres.`}
      />

      <button
        type="submit"
        disabled={enviando}
        className="rounded-full bg-brand-600 px-6 py-3.5 font-semibold text-white shadow-[0_10px_28px_-14px_rgba(11,98,80,0.9)] transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-brand-200 disabled:shadow-none"
      >
        {enviando ? "Salvando…" : "Salvar nova senha"}
      </button>
    </form>
  );
}
