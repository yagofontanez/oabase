"use client";
import { useRef, useState } from "react";

/**
 * O filme de lançamento numa moldura de celular — ele foi feito em 9:16
 * para o TikTok, e é assim que quem chega pela bio já o viu.
 *
 * `preload="none"`: são 4 MB, e a home é a página de entrada de quem estuda
 * pelo celular em conexão ruim. O vídeo só começa a baixar no toque; até lá,
 * a capa é um quadro do próprio filme.
 *
 * O arquivo mora em `public/filme/`, não em `public/videos/`: aquela pasta é
 * a saída do roteiro de divulgação e fica fora da imagem Docker
 * (`.dockerignore`) — servido de lá, o filme dava 404 em produção.
 */
export function FilmeLancamento() {
  const video = useRef<HTMLVideoElement>(null);
  const [tocando, setTocando] = useState(false);

  function tocar() {
    const alvo = video.current;
    if (!alvo) return;
    setTocando(true);
    void alvo.play().catch(() => setTocando(false));
  }

  return (
    <div className="relative mx-auto w-[min(78vw,320px)]">
      <div className="relative rounded-[52px] bg-[#0b0f0e] p-[10px] shadow-[0_0_0_1.5px_rgba(255,255,255,.14),0_60px_120px_-40px_rgba(42,148,120,.55)]">
        <div className="relative aspect-[9/16] overflow-hidden rounded-[42px] bg-black">
          <video
            ref={video}
            src="/filme/lancamento.mp4"
            poster="/filme/lancamento-capa.jpg"
            preload="none"
            playsInline
            controls={tocando}
            onEnded={() => setTocando(false)}
            aria-label="Filme de lançamento do OABase, 36 segundos"
            className="h-full w-full object-cover"
          />
          {!tocando && (
            <button
              type="button"
              onClick={tocar}
              className="group absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/45 via-transparent to-transparent pb-10"
            >
              <span className="flex items-center gap-2.5 rounded-full bg-white/90 py-2.5 pr-5 pl-3 text-[0.9rem] font-semibold text-ink shadow-lg backdrop-blur transition-transform group-hover:scale-105">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-white">
                  <svg viewBox="0 0 16 16" className="ml-0.5 h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                    <path d="M4 2.5v11l9-5.5z" />
                  </svg>
                </span>
                Assistir · 0:36
              </span>
            </button>
          )}
        </div>
        <span aria-hidden="true" className="absolute top-[22px] left-1/2 h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-black" />
      </div>
    </div>
  );
}
