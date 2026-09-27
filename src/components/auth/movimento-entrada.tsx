"use client";

import { useState } from "react";
import styles from "./entrada.module.css";

export function MovimentoEntrada() {
  const [pausado, setPausado] = useState(false);
  return (
    <button
      type="button"
      className={styles.motionControl}
      aria-label={pausado ? "Retomar animação" : "Pausar animação"}
      aria-pressed={pausado}
      onClick={(event) => {
        const raiz = event.currentTarget.closest<HTMLElement>("[data-entrada]");
        if (raiz) raiz.dataset.pausado = String(!pausado);
        setPausado(!pausado);
      }}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
        {pausado ? <path d="m3 2 7 4-7 4Z" /> : <path d="M3 2h2v8H3zm4 0h2v8H7z" />}
      </svg>
      <span>{pausado ? "Retomar" : "Pausar"} movimento</span>
    </button>
  );
}
