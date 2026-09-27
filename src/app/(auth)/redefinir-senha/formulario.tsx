"use client";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { AvisoEntrada, BotaoEntrada } from "@/components/auth/aviso-entrada";
import { Campo } from "@/components/auth/campo";
import styles from "@/components/auth/entrada.module.css";
import { mensagemDeErro } from "@/lib/auth-erros";
import { supabaseNavegador } from "@/lib/supabase/browser";
import { navegar } from "@/components/barra-de-navegacao";
const SENHA_MINIMA = 8;
export function FormularioRedefinir() {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [erroSenha, setErroSenha] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [salva, setSalva] = useState(false);
  const avisoId = useId();
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
    setSalva(true);
    router.refresh();
    navegar();
    router.push("/app");
  }
  return (
    <form onSubmit={enviar} className={styles.form} noValidate aria-label="Definir nova senha">
      <div className={styles.fields}>
        <div className={styles.password}>
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
            placeholder="Crie sua nova senha"
            autoFocus
            disabled={enviando}
            invalido={Boolean(erroSenha)}
            descritoPor={erro || erroSenha ? avisoId : undefined}
          />
          <span className={styles.passwordHint}>Pelo menos {SENHA_MINIMA} caracteres</span>
        </div>
      </div>
      <AvisoEntrada id={avisoId} erro={erro ?? erroSenha} sucesso={salva ? "Senha salva. Abrindo seu espaço." : null} />
      <BotaoEntrada enviando={enviando}>{salva ? "Senha salva" : enviando ? "Salvando…" : "Salvar nova senha"}</BotaoEntrada>
    </form>
  );
}
