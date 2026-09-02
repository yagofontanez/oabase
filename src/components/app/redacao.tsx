"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/browser";

export type ArtigoParaComentar = {
  id: string;
  slug: string;
  numero: string;
  caput: string;
  paragrafos: string[];
  incidencia: number;
  leiSlug: string;
  leiSigla: string;
  leiNome: string;
};

/**
 * Redação de comentário — a ferramenta que abre o portão de qualidade.
 *
 * São 5.756 artigos e quatro comentados. O sitemap só anuncia o que tem
 * comentário revisado, e é por isso — não por marcação, não por desempenho —
 * que o site não posiciona. Nenhuma linha de código resolve isso; o que dá
 * para fazer é pôr o texto da lei, a incidência medida e o campo de escrita
 * na mesma tela, na ordem em que a decisão acontece.
 *
 * **A fila é ordenada por incidência.** Comentar na ordem do código seria
 * gastar as primeiras semanas no art. 1º de cada lei; comentar por incidência
 * é escrever primeiro o que a banca cobra — e a incidência aqui não é palpite,
 * vem de citação expressa em questão de prova.
 *
 * Um parágrafo por bloco separado por linha em branco. `comentario` é
 * `text[]` no banco justamente para isso: o texto chega estruturado e a
 * página do artigo não precisa adivinhar quebra.
 */
export function Redacao({
  fila,
  comentados,
}: {
  fila: ArtigoParaComentar[];
  comentados: number;
}) {
  const [pendentes, setPendentes] = useState(fila);
  const [indice, setIndice] = useState(0);
  const [publicados, setPublicados] = useState(comentados);

  const atual = pendentes[indice] ?? null;

  const aoPublicar = useCallback(
    (id: string) => {
      const restante = pendentes.filter((a) => a.id !== id);
      setPublicados((n) => n + 1);
      setPendentes(restante);
      // Removido o item da posição atual, o índice já aponta para o próximo.
      setIndice((i) => Math.max(0, Math.min(i, restante.length - 1)));
    },
    [pendentes],
  );

  return (
    <div className="painel-conteudo flex max-w-[1280px] flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex max-w-[58ch] flex-col gap-2">
          <h1 className="text-[clamp(1.75rem,3vw,2.15rem)] leading-[1.08] font-extrabold tracking-[-0.035em] text-ink">
            Redação de comentário
          </h1>
          <p className="text-body">
            Fila ordenada pela incidência medida — o que a banca já cobrou vem
            primeiro. Uma linha em branco separa parágrafos.{" "}
            <kbd className="tecla">⌘</kbd>
            <kbd className="tecla">Enter</kbd> publica.
          </p>
        </div>
        <dl className="flex gap-6 text-[0.9rem]">
          <div className="flex flex-col">
            <dd className="text-[1.4rem] font-bold tabular-nums text-brand-600">
              {publicados}
            </dd>
            <dt className="text-muted">comentados</dt>
          </div>
          <div className="flex flex-col">
            <dd className="text-[1.4rem] font-bold tabular-nums text-ink">
              {pendentes.length}
            </dd>
            <dt className="text-muted">na fila</dt>
          </div>
        </dl>
      </header>

      {!atual ? (
        <p className="rounded-2xl bg-paper p-8 text-body">
          A fila acabou: todos os artigos com incidência medida já têm
          comentário. Ingira mais edições para medir novos dispositivos, ou
          escolha um artigo pela navegação da legislação.
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          {/* O texto da lei. Comentar sem o dispositivo à vista é como
              revisar prova sem o gabarito ao lado. */}
          <article className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-7">
            <div className="flex flex-wrap items-center gap-3 text-[0.82rem] text-muted">
              <span className="rounded-full bg-sunk px-2.5 py-1 font-semibold">
                {atual.leiSigla}
              </span>
              <span className="rounded-full bg-brand-50 px-2.5 py-1 font-semibold text-brand-700 tabular-nums">
                {atual.incidencia}{" "}
                {atual.incidencia === 1 ? "questão" : "questões"}
              </span>
              <a
                href={`/legislacao/${atual.leiSlug}/${atual.slug}`}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-line underline-offset-4 hover:text-ink"
              >
                ver a página pública
              </a>
            </div>

            <h2 className="text-[1.3rem] font-bold tracking-[-0.02em] text-ink">
              Art. {atual.numero}
            </h2>

            <div className="lei-texto">
              <p>{atual.caput}</p>
              {atual.paragrafos.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </article>

          <div className="flex flex-col gap-3">
            {/* `key` no artigo: trocar de dispositivo remonta o editor e o
                rascunho some junto. É a única garantia de que o texto na
                caixa é o texto do artigo que está na tela — um efeito de
                limpeza deixaria uma janela de render em que não é. */}
            <Editor
              key={atual.id}
              artigo={atual}
              aoPublicar={() => aoPublicar(atual.id)}
            />

            <button
              type="button"
              onClick={() =>
                setIndice((i) => Math.min(i + 1, pendentes.length - 1))
              }
              className="self-start rounded-full px-5 py-2.5 text-[0.92rem] text-muted transition-colors hover:text-ink"
            >
              Pular este artigo
            </button>

            <ul className="mt-1 flex flex-col divide-y divide-line rounded-2xl border border-line bg-paper">
              {pendentes.slice(0, 8).map((a, i) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => setIndice(i)}
                    className={`flex w-full items-baseline gap-3 px-5 py-2.5 text-left text-[0.88rem] transition-colors ${
                      i === indice
                        ? "font-semibold text-brand-700"
                        : "text-body hover:text-ink"
                    }`}
                  >
                    <span className="tabular-nums">
                      Art. {a.numero} {a.leiSigla}
                    </span>
                    <span className="ml-auto text-muted tabular-nums">
                      {a.incidencia}×
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * A caixa de escrita de um artigo.
 *
 * Componente próprio porque o rascunho é estado **daquele** artigo: montado
 * com `key={artigo.id}`, ele nasce e morre junto com o dispositivo em edição,
 * sem efeito nenhum para limpar nada.
 */
function Editor({
  artigo,
  aoPublicar,
}: {
  artigo: ArtigoParaComentar;
  aoPublicar: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [indexavel, setIndexavel] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const paragrafos = texto
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const publicar = useCallback(async () => {
    if (salvando) return;
    if (paragrafos.length === 0) {
      setErro("Escreva alguma coisa antes de publicar.");
      return;
    }
    setSalvando(true);
    setErro(null);

    const { error } = await supabaseNavegador().rpc("publicar_comentario", {
      p_artigo: artigo.id,
      p_comentario: paragrafos,
      p_indexavel: indexavel,
    });

    if (error) {
      setSalvando(false);
      setErro(error.message);
      return;
    }
    aoPublicar();
  }, [artigo.id, indexavel, paragrafos, salvando, aoPublicar]);

  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      if ((evento.metaKey || evento.ctrlKey) && evento.key === "Enter") {
        evento.preventDefault();
        void publicar();
      }
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [publicar]);

  return (
    <>
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        autoFocus
        placeholder={
          "Por que este artigo cai, e o que a banca costuma trocar de lugar.\n\nUma linha em branco começa outro parágrafo."
        }
        className="min-h-[340px] w-full rounded-2xl border border-line bg-surface p-6 text-[1rem] leading-relaxed text-ink outline-none focus:border-brand-400"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-[0.9rem] text-body">
          <input
            type="checkbox"
            checked={indexavel}
            onChange={(e) => setIndexavel(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-brand-600)]"
          />
          Entra no sitemap e no índice do Google
        </label>
        <span className="text-[0.84rem] text-muted tabular-nums">
          {paragrafos.length}{" "}
          {paragrafos.length === 1 ? "parágrafo" : "parágrafos"} ·{" "}
          {texto.trim().length} caracteres
        </span>
      </div>

      {erro && (
        <p className="rounded-[12px] border border-ouro-300 bg-ouro-50 px-4 py-3 text-[0.9rem] text-ouro-800">
          {erro}
        </p>
      )}

      <button
        type="button"
        onClick={() => void publicar()}
        disabled={salvando || paragrafos.length === 0}
        className="self-start rounded-full bg-brand-600 px-6 py-2.5 text-[0.94rem] font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-brand-200"
      >
        {salvando ? "Publicando…" : "Publicar e seguir"}
      </button>
    </>
  );
}
