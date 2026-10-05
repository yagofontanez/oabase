"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { Campo } from "@/components/auth/campo";
import { mensagemDeErro } from "@/lib/auth-erros";
import { supabaseNavegador } from "@/lib/supabase/browser";
import { navegar } from "@/components/barra-de-navegacao";
import { destinoInterno } from "@/lib/destino";
import { BotaoGoogle } from "@/components/auth/botao-google";
import { ProgressoEntrada } from "@/components/auth/progresso-entrada";
import styles from "@/components/auth/entrada.module.css";

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

export function FormularioEntrar() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [credenciaisInvalidas, setCredenciaisInvalidas] = useState(false);
  const feedbackId = useId();

  // Volta de um login com Google que não se completou (cancelado na tela do
  // Google, ou recusado). Lido do endereço depois da montagem, como o resto
  // desta tela: o formulário precisa estar no HTML antes do JS.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("erro") === "google") {
      queueMicrotask(() =>
        setErro("O login com o Google não foi concluído. Tente de novo ou entre com e-mail e senha."),
      );
    }
  }, []);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    setCredenciaisInvalidas(false);
    setEnviando(true);
    const { error } = await supabaseNavegador().auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });
    if (error) {
      setCredenciaisInvalidas(error.code === "invalid_credentials");
      setErro(mensagemDeErro(error));
      setEnviando(false);
      return;
    }

    setSucesso(true);

    // O destino é lido só agora, do próprio endereço. Usar `useSearchParams`
    // obrigaria um limite de Suspense e tiraria o formulário do HTML inicial
    // — numa tela de login, o campo tem que estar lá antes do JS rodar.
    const destinoPedido = new URLSearchParams(window.location.search).get("proximo");
    // `proximo` também preserva o pedido OAuth. Só aceitamos caminho interno:
    // sem isso, um link de login poderia virar redirecionamento para phishing.
    const proximo = destinoInterno(destinoPedido);

    // `refresh` faz o servidor reler o cookie de sessão antes de navegar.
    router.refresh();
    navegar();
    router.push(proximo);
  }
  return (
    <form onSubmit={enviar} className={styles.form} noValidate aria-label="Entrar no OABase">
      <BotaoGoogle
        className={styles.socialButton}
        disabled={enviando}
        aoErro={setErro}
        carregamento={<ProgressoEntrada />}
      />
      <div className={styles.divider} aria-hidden="true">ou continue com e-mail</div>

      <div className={styles.fields}>
        <Campo
          rotulo="E-mail"
          tipo="email"
          nome="email"
          valor={email}
          aoMudar={setEmail}
          autoComplete="email"
          placeholder="Seu e-mail"
          disabled={enviando}
          invalido={credenciaisInvalidas}
          descritoPor={erro ? feedbackId : undefined}
        />
        <div className={styles.password}>
          <Campo
            rotulo="Senha"
            tipo="password"
            nome="senha"
            valor={senha}
            aoMudar={setSenha}
            autoComplete="current-password"
            placeholder="Sua senha"
            disabled={enviando}
            invalido={credenciaisInvalidas}
            descritoPor={erro ? feedbackId : undefined}
          />
          <Link href="/recuperar-senha" className={`${styles.textLink} ${styles.forgot}`}>
            Esqueceu a senha?
          </Link>
        </div>
      </div>

      {/* Espaço persistente: os controles não saltam quando o Auth responde. */}
      <div className={styles.feedback}>
        {erro && (
          <p id={feedbackId} role="alert" className={styles.message}>
            <Alerta />
            <span>{erro}</span>
          </p>
        )}
        {sucesso && (
          <p role="status" className={`${styles.message} ${styles.success}`}>
            <span aria-hidden="true">✓</span>
            Tudo certo. Vamos continuar seus estudos.
          </p>
        )}
      </div>

      <button type="submit" disabled={enviando} aria-busy={enviando && !sucesso} className={styles.submit}>
        <span aria-live="polite">
          {sucesso ? "Seu estudo continua" : enviando ? "Abrindo seu espaço…" : "Entrar e continuar"}
        </span>
        {enviando ? (sucesso ? <span aria-hidden="true">✓</span> : <ProgressoEntrada />) : (
          <svg className={styles.submitArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14m-5-5 5 5-5 5" />
          </svg>
        )}
      </button>
    </form>
  );
}
