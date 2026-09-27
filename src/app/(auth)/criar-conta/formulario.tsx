"use client";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Campo } from "@/components/auth/campo";
import { mensagemDeErro } from "@/lib/auth-erros";
import { supabaseNavegador } from "@/lib/supabase/browser";
import { BotaoGoogle } from "@/components/auth/botao-google";
import { ProgressoEntrada } from "@/components/auth/progresso-entrada";
import styles from "@/components/auth/entrada.module.css";
import Link from "next/link";
import { navegar } from "@/components/barra-de-navegacao";

const Alerta = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px] shrink-0" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5" />
    <path d="M12 16.2h.01" />
  </svg>
);

const SENHA_MINIMA = 8;
export function FormularioCriarConta() {
  const router = useRouter();
  const feedbackId = useId();
  const senhaDicaId = useId();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [erroSenha, setErroSenha] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [sucesso, setSucesso] = useState(false);
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

    setSucesso(true);
    router.refresh();
    navegar();
    router.push("/app");
  }
  if (confirmar) {
    return (
      <div className={styles.confirmation} role="status">
        <span className={styles.confirmationIcon} aria-hidden="true">
          <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="7" width="24" height="18" rx="4" />
            <path d="m5 9 11 8L27 9" />
          </svg>
        </span>
        <span className={styles.formEyebrow}>SÓ FALTA UM PASSO</span>
        <h2>Confirme seu e-mail</h2>
        <p>Enviamos um link para <strong>{email.trim()}</strong>. Clique nele para ativar sua conta e começar seu plano de estudos.</p>
        <p className={styles.confirmationHint}>Não chegou? Aguarde alguns minutos e confira a caixa de spam.</p>
        <Link href="/entrar" className={styles.textLink}>Ir para o login <span aria-hidden="true">→</span></Link>
      </div>
    );
  }
  return (
    <form onSubmit={enviar} className={styles.form} noValidate aria-label="Criar conta no OABase">
      <BotaoGoogle
        rotulo="Criar conta com o Google"
        className={styles.socialButton}
        disabled={enviando}
        aoErro={setErro}
        carregamento={<ProgressoEntrada />}
      />
      <div className={styles.divider} aria-hidden="true">ou comece com e-mail</div>

      <div className={styles.fields}>
        <Campo
          rotulo="Nome"
          nome="nome"
          valor={nome}
          aoMudar={setNome}
          autoComplete="given-name"
          placeholder="Seu nome"
          disabled={enviando}
        />
        <Campo
          rotulo="E-mail"
          tipo="email"
          nome="email"
          valor={email}
          aoMudar={setEmail}
          autoComplete="email"
          placeholder="Seu e-mail"
          disabled={enviando}
          descritoPor={erro ? feedbackId : undefined}
        />
        <div className={styles.password}>
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
            placeholder="Crie sua senha"
            disabled={enviando}
            invalido={Boolean(erroSenha)}
            descritoPor={erroSenha ? feedbackId : senhaDicaId}
          />
          <span id={senhaDicaId} className={styles.passwordHint}>Pelo menos {SENHA_MINIMA} caracteres</span>
        </div>
      </div>

      <div className={styles.feedback}>
        {(erro || erroSenha) && (
          <p id={feedbackId} role="alert" className={styles.message}>
            <Alerta /><span>{erro || erroSenha}</span>
          </p>
        )}
        {sucesso && (
          <p role="status" className={`${styles.message} ${styles.success}`}>
            <span aria-hidden="true">✓</span>Conta criada. Vamos montar seu plano.
          </p>
        )}
      </div>
      <button type="submit" disabled={enviando} aria-busy={enviando && !sucesso} className={styles.submit}>
        <span aria-live="polite">{sucesso ? "Seu caminho começa agora" : enviando ? "Preparando seu espaço…" : "Criar minha conta"}</span>
        {enviando ? (sucesso ? <span aria-hidden="true">✓</span> : <ProgressoEntrada />) : (
          <svg className={styles.submitArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5" /></svg>
        )}
      </button>
      {/* Sempre visível para ambos os métodos de cadastro, inclusive em telas baixas. */}
      <p className={styles.terms}>
        Ao criar a conta, você aceita os <Link href="/termos">Termos de Uso</Link> e a <Link href="/privacidade">Política de Privacidade</Link>.
      </p>
    </form>
  );
}
