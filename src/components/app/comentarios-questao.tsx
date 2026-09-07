"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/browser";

export type QuestaoParaComentar = {
  questaoId: string;
  edicao: number;
  numero: number;
  enunciado: string;
  alternativas: Record<string, string>;
  gabarito: string;
  disciplinaNome: string | null;
  /** Texto já escrito e ainda não publicado. Vazio = questão virgem. */
  corpo: string[];
  status: string;
  autor: string | null;
  /** Artigos vinculados à questão, com caput e comentário publicado. */
  apoio: Array<{
    rotulo: string;
    href: string;
    caput: string;
    comentario: string[];
  }>;
};

/**
 * Redação de comentário de questão — a ferramenta que explica o porquê da
 * resposta correta.
 *
 * São 3.540 questões e 92 comentadas. O comentário é o diferencial do produto
 * pago: transforma "errei" em "entendi". A fila vem por exame mais recente, e
 * os dispositivos vinculados em cada questão baixam ordenados por incidência —
 * o que a banca já cobrou em evidência.
 *
 * Um parágrafo por bloco separado por linha em branco. `corpo` é `text[]`
 * no banco justamente para isso: o texto chega estruturado e a página não
 * precisa adivinhar quebra.
 */
export function ComentariosQuestao({
  fila,
  publicados: publicadosIniciais,
  totalQuestoes,
}: {
  fila: QuestaoParaComentar[];
  publicados: number;
  totalQuestoes: number;
}) {
  const [pendentes, setPendentes] = useState(fila);
  const [indice, setIndice] = useState(0);
  const [publicados, setPublicados] = useState(publicadosIniciais);

  const atual = pendentes[indice] ?? null;

  const aoPublicar = useCallback(
    (questaoId: string) => {
      const restante = pendentes.filter((q) => q.questaoId !== questaoId);
      setPublicados((n) => n + 1);
      setPendentes(restante);
      setIndice((i) => Math.max(0, Math.min(i, restante.length - 1)));
    },
    [pendentes],
  );

  const ALTERNATIVAS = ["a", "b", "c", "d", "e"] as const;

  return (
    <div className="painel-conteudo flex max-w-[1280px] flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex max-w-[58ch] flex-col gap-2">
          <h1 className="text-[clamp(1.75rem,3vw,2.15rem)] leading-[1.08] font-extrabold tracking-[-0.035em] text-ink">
            Comentários de questão
          </h1>
          <p className="text-body">
            Exames mais recentes primeiro — o apoio de cada questão vem com os
            dispositivos ordenados por incidência, o que a banca já cobrou em
            evidência. Uma linha em branco separa parágrafos.{" "}
            <kbd className="tecla">⌘</kbd>
            <kbd className="tecla">Enter</kbd> publica.
          </p>
        </div>
        <dl className="flex gap-6 text-[0.9rem]">
          <div className="flex flex-col">
            <dd className="text-[1.4rem] font-bold tabular-nums text-brand-600">
              {publicados}
            </dd>
            <dt className="text-muted">publicados</dt>
          </div>
          <div className="flex flex-col">
            <dd className="text-[1.4rem] font-bold tabular-nums text-ink">
              {pendentes.length}
            </dd>
            <dt className="text-muted">na fila</dt>
          </div>
          <div className="flex flex-col">
            <dd className="text-[1.4rem] font-bold tabular-nums text-muted">
              {totalQuestoes}
            </dd>
            <dt className="text-muted">total</dt>
          </div>
        </dl>
      </header>

      {!atual ? (
        <p className="rounded-2xl bg-paper p-8 text-body">
          A fila acabou: esta leva de questões está comentada. Continue a
          partir das abas de revisão — classificar mais questões e vincular
          dispositivos dá mais material para comentar.
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          {/* A questão. Comentar sem o enunciado à vista é como revisar
              prova sem o gabarito ao lado. */}
          <article className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-7">
            <div className="flex flex-wrap items-center gap-3 text-[0.82rem] text-muted">
              <span className="rounded-full bg-sunk px-2.5 py-1 font-semibold">
                {atual.edicao}º Exame
              </span>
              <span className="rounded-full bg-brand-50 px-2.5 py-1 font-semibold text-brand-700 tabular-nums">
                Questão {atual.numero}
              </span>
              {atual.disciplinaNome && (
                <span className="rounded-full bg-sunk px-2.5 py-1 font-semibold">
                  {atual.disciplinaNome}
                </span>
              )}
              {atual.corpo.length > 0 && (
                <span className="rounded-full bg-ouro-100 px-2.5 py-1 font-semibold text-ouro-700">
                  rascunho a revisar
                </span>
              )}
            </div>

            <div className="lei-texto">
              <p>{atual.enunciado}</p>
            </div>

            <div className="flex flex-col gap-2">
              {ALTERNATIVAS.map((letra) => (
                <div
                  key={letra}
                  className={`rounded-xl border px-4 py-3 text-[0.92rem] ${
                    letra === atual.gabarito
                      ? "border-brand-300 bg-brand-50 font-semibold text-brand-700"
                      : "border-line bg-paper text-body"
                  }`}
                >
                  <span className="mr-2 font-bold uppercase">{letra})</span>
                  {atual.alternativas[letra] ?? "—"}
                </div>
              ))}
            </div>

            {atual.apoio.length > 0 && (
              <div className="mt-2 flex flex-col gap-3 border-t border-line pt-4">
                <h3 className="text-[0.82rem] font-semibold text-muted uppercase">
                  Dispositivos vinculados
                </h3>
                {atual.apoio.map((artigo, i) => (
                  <details key={i} className="group rounded-xl border border-line bg-paper">
                    <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-[0.88rem] font-semibold text-ink transition-colors hover:bg-sunk">
                      <span>{artigo.rotulo}</span>
                      <span className="ml-auto text-[0.78rem] text-muted group-open:hidden">
                        expandir
                      </span>
                    </summary>
                    <div className="border-t border-line px-4 py-4">
                      <p className="text-[0.9rem] leading-relaxed text-body">
                        {artigo.caput}
                      </p>
                      {artigo.comentario.length > 0 && (
                        <div className="mt-3 border-t border-line pt-3">
                          <span className="text-[0.76rem] font-semibold text-muted uppercase">
                            Comentário publicado
                          </span>
                          {artigo.comentario.map((p, j) => (
                            <p
                              key={j}
                              className="mt-2 text-[0.88rem] leading-relaxed text-body"
                            >
                              {p}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </article>

          <div className="flex flex-col gap-3">
            <Editor
              key={atual.questaoId}
              questao={atual}
              aoPublicar={() => aoPublicar(atual.questaoId)}
            />

            <button
              type="button"
              onClick={() =>
                setIndice((i) => Math.min(i + 1, pendentes.length - 1))
              }
              className="self-start rounded-full px-5 py-2.5 text-[0.92rem] text-muted transition-colors hover:text-ink"
            >
              Pular esta questão
            </button>

            <ul className="mt-1 flex flex-col divide-y divide-line rounded-2xl border border-line bg-paper">
              {pendentes.slice(0, 8).map((q, i) => (
                <li key={q.questaoId}>
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
                      {q.edicao}º — Q{q.numero}
                    </span>
                    <span className="ml-auto text-muted">
                      {q.disciplinaNome ?? "sem disciplina"}
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
 * A caixa de escrita de uma questão.
 *
 * Componente próprio porque o rascunho é estado **daquela** questão: montado
 * com `key={questaoId}`, ele nasce e morre junto com a questão em edição,
 * sem efeito nenhum para limpar nada.
 */
function Editor({
  questao,
  aoPublicar,
}: {
  questao: QuestaoParaComentar;
  aoPublicar: () => void;
}) {
  const [texto, setTexto] = useState(questao.corpo.join("\n\n"));
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

    const { error } = await supabaseNavegador().rpc("salvar_comentario", {
      p_questao: questao.questaoId,
      p_corpo: paragrafos,
      p_status: "publicado",
    });

    if (error) {
      setSalvando(false);
      setErro(error.message);
      return;
    }
    aoPublicar();
  }, [questao.questaoId, paragrafos, salvando, aoPublicar]);

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
          "Por que esta questão cai, qual armadilha a banca monta, e o que o candidato precisa saber para não errar.\n\nUma linha em branco começa outro parágrafo."
        }
        className="min-h-[340px] w-full rounded-2xl border border-line bg-surface p-6 text-[1rem] leading-relaxed text-ink outline-none focus:border-brand-400"
      />

      <div className="flex items-center justify-between gap-3">
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
