"use client";

import { useEffect } from "react";

/**
 * Registra o service worker em produção e só. Em desenvolvimento ele só
 * atrapalharia — cache intermediário escondendo a edição que acabou de
 * salvar. E o PWA é progressivo: sem registro, o site continua inteiro.
 */
export function PwaRegistro() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Falhou e não tem o que fazer: rede de segurança é o offline composto
      // pelo navegador, não pelo app.
    });
  }, []);

  return null;
}