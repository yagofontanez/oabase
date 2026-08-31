"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Reveal de rolagem, uma vez só e só em cabeçalho de seção.
 * Aplicar em cada elemento da página é o que faz um layout parecer
 * gerado — aqui ele marca a entrada de um bloco, e para por aí.
 */
export function Reveal({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const alvo = ref.current;
    if (!alvo) return;
    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) {
          setVisivel(true);
          observador.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    );

    observador.observe(alvo);
    return () => observador.disconnect();
  }, []);
  return (
    <div ref={ref} data-visivel={visivel} className={`oab-reveal ${className}`}>
      {children}
    </div>
  );
}
