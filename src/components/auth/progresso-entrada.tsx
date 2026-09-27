import styles from "./entrada.module.css";

/** O mesmo avanço entre marcos da ilustração, no tamanho de um botão. */
export function ProgressoEntrada() {
  return <span className={styles.progress} aria-hidden="true"><i /><i /><i /></span>;
}
