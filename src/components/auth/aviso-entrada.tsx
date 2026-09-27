import type { ReactNode } from "react";
import { ProgressoEntrada } from "./progresso-entrada";
import styles from "./entrada.module.css";

/**
 * Espaço persistente para a resposta do Auth: os controles não saltam
 * quando a mensagem aparece. Mesma área de entrar e criar conta.
 */
export function AvisoEntrada({ id, erro, sucesso }: { id?: string; erro?: string | null; sucesso?: ReactNode }) {
  return (
    <div className={styles.feedback}>
      {erro && (
        <p id={id} role="alert" className={styles.message}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px] shrink-0" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5" />
            <path d="M12 16.2h.01" />
          </svg>
          <span>{erro}</span>
        </p>
      )}
      {!erro && sucesso && (
        <p role="status" className={`${styles.message} ${styles.success}`}>
          <span aria-hidden="true">✓</span>
          {sucesso}
        </p>
      )}
    </div>
  );
}

/** Botão principal: rótulo que acompanha o estado e a seta que vira progresso. */
export function BotaoEntrada({ enviando, children }: { enviando: boolean; children: ReactNode }) {
  return (
    <button type="submit" disabled={enviando} aria-busy={enviando} className={styles.submit}>
      <span aria-live="polite">{children}</span>
      {enviando ? <ProgressoEntrada /> : (
        <svg className={styles.submitArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12h14m-5-5 5 5-5 5" />
        </svg>
      )}
    </button>
  );
}
