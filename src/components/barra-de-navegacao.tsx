"use client";

import { useEffect, useRef } from "react";

/**
 * Barra fina no topo enquanto uma navegação está a caminho.
 *
 * O esqueleto de `loading.tsx` só aparece na hora quando a rota foi
 * pré-carregada — os links do trilho, visíveis na tela. `router.push` depois
 * de um botão ("Iniciar sessão", "Criar simulado", "Abrir tópico") navega
 * para rota que ninguém pré-carregou, e aí nada na tela reagia até o servidor
 * responder: com a Netlify em Ohio e o banco em São Paulo, perto de um
 * segundo de tela parada — a queixa exata era "parece que travou".
 *
 * Começa no clique (captura de qualquer `<a>` interno) ou por `navegar()`,
 * para a navegação feita em código. Só aparece depois de 80 ms, para não
 * piscar em navegação instantânea. Termina quando a URL mudou **e** o
 * esqueleto saiu da tela — a barra cobre a espera que o esqueleto não cobre,
 * e some quando há conteúdo de verdade.
 *
 * Sem dependência: é um `div`, uma transição de largura e um laço de
 * `requestAnimationFrame` que só roda enquanto há navegação pendente.
 */

const EVENTO = "oab:navegar";
const ATRASO_MS = 80;
const TETO_MS = 12_000;

/** Anuncia uma navegação feita em código. Chame logo antes de `router.push`. */
export function navegar() {
  window.dispatchEvent(new Event(EVENTO));
}

function linkInterno(evento: MouseEvent): boolean {
  if (evento.defaultPrevented || evento.button !== 0) return false;
  if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return false;
  const a = (evento.target as Element | null)?.closest?.("a");
  if (!a || !a.href || a.target === "_blank" || a.hasAttribute("download")) return false;
  const destino = new URL(a.href, location.href);
  if (destino.origin !== location.origin) return false;
  // Âncora na mesma página não é navegação.
  const semHash = (u: URL) => u.pathname + u.search;
  return semHash(destino) !== semHash(new URL(location.href));
}

export function BarraDeNavegacao() {
  const barra = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ativa = false;
    let origem = "";
    let inicio = 0;
    let quadro = 0;
    let atraso: ReturnType<typeof setTimeout> | undefined;

    const el = () => barra.current;

    function mostrar() {
      const b = el();
      if (!b || !ativa) return;
      b.style.transition = "none";
      b.style.width = "0%";
      b.style.opacity = "1";
      // Força o recálculo antes de animar, senão o 0% não é pintado.
      void b.offsetWidth;
      // Anda rápido até ~70% e depois quase para: a barra não sabe quanto
      // falta, então não finge que sabe.
      b.style.transition = "width 8s cubic-bezier(0.08, 0.82, 0.17, 1)";
      b.style.width = "85%";
    }

    function terminar() {
      ativa = false;
      clearTimeout(atraso);
      cancelAnimationFrame(quadro);
      const b = el();
      if (!b || b.style.opacity !== "1") return;
      b.style.transition = "width 180ms ease-out, opacity 260ms ease 180ms";
      b.style.width = "100%";
      b.style.opacity = "0";
    }

    function vigiar() {
      if (!ativa) return;
      const mudou = location.href !== origem;
      const esqueleto = document.querySelector('main [role="status"]');
      if ((mudou && !esqueleto) || performance.now() - inicio > TETO_MS) {
        terminar();
        return;
      }
      quadro = requestAnimationFrame(vigiar);
    }

    function comecar() {
      if (ativa) return;
      ativa = true;
      origem = location.href;
      inicio = performance.now();
      atraso = setTimeout(mostrar, ATRASO_MS);
      quadro = requestAnimationFrame(vigiar);
    }

    const aoClicar = (e: MouseEvent) => {
      if (linkInterno(e)) comecar();
    };
    document.addEventListener("click", aoClicar, true);
    window.addEventListener(EVENTO, comecar);
    return () => {
      document.removeEventListener("click", aoClicar, true);
      window.removeEventListener(EVENTO, comecar);
      terminar();
    };
  }, []);

  return (
    <div
      ref={barra}
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 z-[100] h-[3px] bg-brand-500"
      style={{ width: "0%", opacity: 0, boxShadow: "0 0 8px rgba(15,122,95,0.45)" }}
    />
  );
}
