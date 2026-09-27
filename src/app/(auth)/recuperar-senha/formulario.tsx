"use client";
import { useId, useState } from "react";
import { AvisoEntrada, BotaoEntrada } from "@/components/auth/aviso-entrada";
import { Campo } from "@/components/auth/campo";
import styles from "@/components/auth/entrada.module.css";
import { mensagemDeErro } from "@/lib/auth-erros";
import { supabaseNavegador } from "@/lib/supabase/browser";
export function FormularioRecuperar() {
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const avisoId = useId();
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
      <div className={styles.confirmation} role="status">
        <span className={styles.confirmationIcon} aria-hidden="true">
          <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="7" width="24" height="18" rx="4" />
            <path d="m5 9 11 8L27 9" />
          </svg>
        </span>
        <span className={styles.formEyebrow}>CONFIRA SEU E-MAIL</span>
        <h2>Link enviado</h2>
        <p>Se existir uma conta com <strong>{email.trim()}</strong>, o link de redefinição chega em instantes. Ele vale por uma hora.</p>
        <p className={styles.confirmationHint}>Não chegou? Aguarde alguns minutos e confira a caixa de spam.</p>
      </div>
    );
  }
  return (
    <form onSubmit={enviar} className={styles.form} noValidate aria-label="Pedir link de redefinição de senha">
      <div className={styles.fields}>
        <Campo
          rotulo="E-mail da conta"
          tipo="email"
          nome="email"
          valor={email}
          aoMudar={setEmail}
          autoComplete="email"
          placeholder="Seu e-mail"
          autoFocus
          disabled={enviando}
          descritoPor={erro ? avisoId : undefined}
        />
      </div>
      <AvisoEntrada id={avisoId} erro={erro} />
      <BotaoEntrada enviando={enviando}>{enviando ? "Enviando…" : "Enviar link de redefinição"}</BotaoEntrada>
    </form>
  );
}
