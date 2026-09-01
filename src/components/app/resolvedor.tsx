"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const LETRAS = ["A", "B", "C", "D"] as const;
type Letra = (typeof LETRAS)[number];

export type QuestaoDaFila = {
  id: string;
  numero: number;
  slug: string;
  enunciado: string;
  alternativas: Record<string, string>;
  exameEdicao: number;
  exameSlug: string;
  disciplina: string | null;
  jaRespondida: boolean;
  errouAntes: boolean;
};

type ArtigoLigado = {
  href: string;
  rotulo: string;
  caput: string;
  comentado: boolean;
};

type Resultado = {
  acertou: boolean;
  gabarito: string;
  comentario: string[];
  /** Artigos que a própria questão cita — vínculo verificável. */
  artigos: ArtigoLigado[];
  /** Só quando não há citação: semelhança de texto, e a tela diz isso. */
  sugestoes: ArtigoLigado[];
  parecidas: {
    edicao: number;
    numero: number;
    exameSlug: string;
    disciplina: string | null;
    resumo: string;
    motivo: string;
  }[];
  /** Null abaixo do piso de respondentes — a tela não mostra nada. */
  dificuldade: { respondentes: number; taxaAcerto: number } | null;
};

/**
 * A tela de resolução.
 *
 * O gabarito não chega junto com a questão: ele só vem na resposta do
 * servidor, depois de a alternativa ser enviada. É o que impede que abrir o
 * inspetor do navegador vire o gabarito da prova inteira — e o que faz a
 * taxa de acerto do painel significar alguma coisa.
 *
 * A fila é resolvida em memória, sem recarregar a página a cada questão:
 * quem está treinando com o cronômetro na cabeça não deve esperar por
 * navegação entre uma questão e a seguinte.
 */
export function Resolvedor({ fila }: { fila: QuestaoDaFila[] }) {
  const [indice, setIndice] = useState(0);
  // A alternativa marcada é guardada por questão, e não numa variável que
  // precisa ser zerada a cada avanço: assim voltar para a anterior mostra o
  // que foi marcado lá, e nenhum efeito precisa chamar `setState`.
  const [escolhas, setEscolhas] = useState<Record<string, Letra>>({});
  const [resultados, setResultados] = useState<Record<string, Resultado>>({});
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // `Date.now()` na inicialização seria chamada impura durante a renderização
  // — e o valor do servidor, além de inútil, divergiria do cliente. O relógio
  // começa no efeito, quando a questão aparece de fato na tela.
  const abertaEm = useRef<number>(0);

  const questao = fila[indice];
  const resultado = questao ? resultados[questao.id] : undefined;
  const respondida = Boolean(resultado);
  const escolhida = questao ? (escolhas[questao.id] ?? null) : null;

  function marcar(letra: Letra) {
    if (!questao) return;
    setErro(null);
    setEscolhas((atual) => ({ ...atual, [questao.id]: letra }));
  }

  // O cronômetro reinicia a cada questão — o tempo gravado é o tempo daquela
  // questão, não o tempo desde que a página abriu.
  useEffect(() => {
    abertaEm.current = Date.now();
  }, [indice]);

  const respondidas = Object.keys(resultados).length;
  const acertos = Object.values(resultados).filter((r) => r.acertou).length;

  async function responder() {
    if (!questao || !escolhida || enviando || respondida) return;
    setEnviando(true);
    setErro(null);
    try {
      const resposta = await fetch("/api/responder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questaoId: questao.id,
          alternativa: escolhida,
          tempoMs: abertaEm.current > 0 ? Date.now() - abertaEm.current : null,
        }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        setErro(dados.erro ?? "Não consegui registrar a resposta.");
        return;
      }
      setResultados((atual) => ({ ...atual, [questao.id]: dados as Resultado }));
    } catch {
      setErro("Sem conexão com o servidor. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  // Enter responde; depois de respondida, Enter avança. Teclado importa aqui:
  // são 80 questões por simulado, e o mouse cansa antes do conteúdo.
  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      const alvo = evento.target as HTMLElement | null;
      if (alvo && ["INPUT", "TEXTAREA", "SELECT"].includes(alvo.tagName)) return;

      const letra = evento.key.toUpperCase();
      if (!respondida && (LETRAS as readonly string[]).includes(letra)) {
        evento.preventDefault();
        marcar(letra as Letra);
        return;
      }
      if (evento.key === "Enter") {
        evento.preventDefault();
        if (respondida) setIndice((i) => Math.min(fila.length, i + 1));
        else void responder();
      }
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [respondida, escolhida, enviando, indice, fila.length]);

  /* ---------------- Fim da fila ---------------- */

  if (!questao) {
    const taxa =
      respondidas > 0 ? Math.round((acertos / respondidas) * 100) : 0;
    return (
      <div className="superficie mx-auto flex w-full max-w-[620px] flex-col gap-5 p-8 text-center">
        <span className="rotulo mx-auto">Fila concluída</span>
        <p className="text-[1.35rem] font-bold text-ink">
          {respondidas > 0
            ? `${acertos} de ${respondidas} — ${taxa}% de acerto`
            : "Nada por aqui agora"}
        </p>
        <p className="mx-auto max-w-[46ch] text-[0.95rem] text-body">
          {respondidas > 0
            ? "As que você errou já estão no caderno de erros, e todas voltam na fila de revisão pelo intervalo que a sua resposta determinou."
            : "Troque o filtro acima ou escolha outro exame para montar uma nova fila."}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/app/questoes"
            className="rounded-full bg-brand-600 px-5 py-2.5 text-[0.92rem] font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Montar outra fila
          </Link>
          <Link
            href="/app/desempenho"
            className="rounded-full border border-hairline px-5 py-2.5 text-[0.92rem] font-semibold text-ink transition-colors hover:border-brand-300 hover:text-brand-700"
          >
            Ver desempenho
          </Link>
        </div>
      </div>
    );
  }

  const progresso = ((indice + (respondida ? 1 : 0)) / fila.length) * 100;

  return (
    <div className="mx-auto flex w-full max-w-[820px] flex-col gap-4">
      {/* ---- Progresso ---- */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <span className="text-[0.88rem] text-muted tabular-nums">
            Questão {indice + 1} de {fila.length}
          </span>
          {respondidas > 0 && (
            <span className="text-[0.88rem] text-muted tabular-nums">
              {acertos} certas · {respondidas - acertos} erradas
            </span>
          )}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-sunk">
          <div
            className="h-full rounded-full bg-brand-500 transition-[width] duration-300"
            style={{ width: `${progresso}%` }}
          />
        </div>
      </div>

      {/* ---- A questão ---- */}
      <article className="superficie overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line bg-brand-50/60 px-6 py-3.5">
          <Link
            href={`/exames/${questao.exameSlug}`}
            className="text-[0.86rem] font-semibold text-brand-700 transition-colors hover:text-brand-800"
          >
            {questao.exameEdicao}º Exame · questão {questao.numero}
          </Link>
          <span className="flex items-center gap-2 text-[0.82rem] text-brand-600/70">
            {questao.errouAntes && (
              <span className="rounded-full bg-vinho-100 px-2 py-0.5 text-[0.76rem] font-semibold text-vinho-600">
                errou antes
              </span>
            )}
            {questao.disciplina ?? "sem classificação"}
          </span>
        </div>

        <div className="flex flex-col gap-5 p-6 sm:p-7">
          {/* Serifa: enunciado de prova é texto normativo, e é o único lugar
              do painel onde ela aparece. */}
          <p className="lei-texto whitespace-pre-line">{questao.enunciado}</p>

          <ul className="flex flex-col gap-1.5">
            {LETRAS.map((letra) => {
              const correta = resultado?.gabarito === letra;
              const estaEscolhida = escolhida === letra;
              let linha =
                "border-line bg-surface hover:border-brand-200 hover:bg-brand-50/50";
              let selo = "bg-sunk text-body";

              if (respondida) {
                if (correta) {
                  linha = "border-brand-300 bg-brand-50";
                  selo = "bg-brand-500 text-white";
                } else if (estaEscolhida) {
                  linha = "border-vinho-200 bg-vinho-50";
                  selo = "bg-vinho-500 text-white";
                } else {
                  linha = "border-line bg-surface opacity-45";
                }
              } else if (estaEscolhida) {
                linha = "border-brand-400 bg-brand-50";
                selo = "bg-brand-600 text-white";
              }

              return (
                <li key={letra}>
                  <button
                    type="button"
                    disabled={respondida || enviando}
                    onClick={() => marcar(letra)}
                    aria-pressed={estaEscolhida}
                    className={`flex w-full items-start gap-3 rounded-[12px] border px-4 py-3 text-left transition-all duration-200 disabled:cursor-default ${linha}`}
                  >
                    <span
                      className={`mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.76rem] font-bold transition-colors duration-200 ${selo}`}
                    >
                      {letra}
                    </span>
                    <span className="text-[0.92rem] leading-relaxed text-body">
                      {questao.alternativas[letra]}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {erro && (
            <p
              role="alert"
              className="rounded-[12px] bg-vinho-50 px-4 py-3 text-[0.9rem] text-vinho-700"
            >
              {erro}
            </p>
          )}

          {/* ---- Resultado ---- */}
          {resultado && (
            <div className="flex flex-col gap-3 border-t border-line pt-5">
              <p
                className={`flex items-center gap-2.5 text-[1.05rem] font-bold ${
                  resultado.acertou ? "text-brand-700" : "text-vinho-600"
                }`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[0.8rem] text-white ${
                    resultado.acertou ? "bg-brand-500" : "bg-vinho-500"
                  }`}
                  aria-hidden="true"
                >
                  {resultado.acertou ? "✓" : "✕"}
                </span>
                {resultado.acertou
                  ? "Certa"
                  : `Errada — o gabarito é ${resultado.gabarito}`}
              </p>

              {/* Dificuldade medida. Só aparece com base suficiente: "50%
                  acertam" apurado em duas pessoas não é estatística, é uma
                  moeda — e num universo de dois o número diria o que a outra
                  pessoa respondeu. */}
              {resultado.dificuldade && (
                <p className="text-[0.88rem] text-muted">
                  <strong
                    className={`font-semibold ${
                      resultado.dificuldade.taxaAcerto < 50
                        ? "text-vinho-600"
                        : "text-ink"
                    }`}
                  >
                    {resultado.dificuldade.taxaAcerto}%
                  </strong>{" "}
                  de quem respondeu esta questão acerta ·{" "}
                  {resultado.dificuldade.respondentes}{" "}
                  {resultado.dificuldade.respondentes === 1
                    ? "pessoa"
                    : "pessoas"}
                  {resultado.dificuldade.taxaAcerto < 40 &&
                    " · está entre as mais difíceis do acervo"}
                </p>
              )}

              {resultado.comentario.length > 0 ? (
                <div className="comentario text-[0.95rem] text-body">
                  {resultado.comentario.map((paragrafo, i) => (
                    <p key={i}>{paragrafo}</p>
                  ))}
                </div>
              ) : (
                /* Honestidade sobre o estado do acervo: o gabarito é oficial
                   da FGV, o comentário é trabalho autoral e ainda não existe
                   para esta questão. Inventar explicação com IA seria o pior
                   defeito possível numa ferramenta de estudo. */
                <p className="rounded-[12px] bg-sunk px-4 py-3 text-[0.9rem] text-muted">
                  O gabarito é o oficial da FGV. O comentário desta questão
                  ainda não foi redigido.
                </p>
              )}

              {/* Dispositivos. Vínculo citado e sugestão por semelhança nunca
                  aparecem com o mesmo rótulo — a diferença entre "a questão
                  diz isto" e "isto se parece com a questão" é a diferença
                  entre estudar o certo e estudar o parecido. */}
              {(resultado.artigos.length > 0 ||
                resultado.sugestoes.length > 0) && (
                <div className="flex flex-col gap-2 border-t border-line pt-4">
                  <span className="rotulo">
                    {resultado.artigos.length > 0
                      ? "Dispositivos cobrados nesta questão"
                      : "Artigos parecidos com esta questão · sugestão"}
                  </span>
                  <ul className="flex flex-col gap-2">
                    {(resultado.artigos.length > 0
                      ? resultado.artigos
                      : resultado.sugestoes
                    ).map((a) => (
                      <li key={a.href}>
                        <Link
                          href={a.href}
                          className="group flex flex-col gap-0.5 rounded-[12px] bg-paper p-3.5 transition-colors hover:bg-sunk"
                        >
                          <span className="flex flex-wrap items-center gap-2 text-[0.9rem] font-semibold text-brand-700">
                            {a.rotulo}
                            {a.comentado && (
                              <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[0.72rem] font-semibold text-brand-700">
                                comentado
                              </span>
                            )}
                            <span className="opacity-40 transition-opacity group-hover:opacity-100">
                              →
                            </span>
                          </span>
                          <span className="line-clamp-2 text-[0.85rem] text-muted">
                            {a.caput}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* "Onde mais isto cai?" é a pergunta seguinte a errar. Estas
                  não abrem individualmente — não existe página pública de
                  questão, e não vai existir: enunciado é conteúdo do plano.
                  O que elas dão é o reconhecimento do padrão. */}
              {resultado.parecidas.length > 0 && (
                <div className="flex flex-col gap-2 border-t border-line pt-4">
                  <span className="rotulo">Onde mais esse assunto cai</span>
                  <ul className="flex flex-col gap-2">
                    {resultado.parecidas.map((q) => (
                      <li
                        key={`${q.exameSlug}-${q.numero}`}
                        className="flex flex-col gap-0.5 rounded-[12px] bg-paper p-3.5"
                      >
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-[0.88rem] font-semibold text-ink">
                            {q.edicao}º Exame · questão {q.numero}
                          </span>
                          <span className="rounded-full bg-sunk px-2 py-0.5 text-[0.72rem] font-semibold text-muted">
                            {q.motivo}
                          </span>
                          {q.disciplina && (
                            <span className="text-[0.78rem] text-muted">
                              {q.disciplina}
                            </span>
                          )}
                        </span>
                        <span className="line-clamp-2 text-[0.84rem] text-muted">
                          {q.resumo}…
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={`/app/questoes?modo=todas${
                      resultado.parecidas[0]
                        ? `&exame=${resultado.parecidas[0].exameSlug}`
                        : ""
                    }`}
                    className="self-start text-[0.86rem] font-semibold text-brand-600 underline decoration-brand-200 underline-offset-4 transition-colors hover:decoration-brand-500"
                  >
                    Resolver as questões desse exame →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ---- Ações ---- */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-4">
          <button
            type="button"
            disabled={indice === 0}
            onClick={() => setIndice((i) => Math.max(0, i - 1))}
            className="rounded-full px-3 py-2 text-[0.9rem] font-medium text-muted transition-colors hover:text-ink disabled:opacity-35"
          >
            ← Anterior
          </button>

          {respondida ? (
            <button
              type="button"
              onClick={() => setIndice((i) => i + 1)}
              className="rounded-full bg-brand-600 px-6 py-2.5 text-[0.92rem] font-semibold text-white transition-colors hover:bg-brand-700"
            >
              {indice + 1 === fila.length ? "Concluir fila" : "Próxima questão"}
            </button>
          ) : (
            <button
              type="button"
              disabled={!escolhida || enviando}
              onClick={responder}
              className="rounded-full bg-brand-600 px-6 py-2.5 text-[0.92rem] font-semibold text-white transition-colors hover:bg-brand-700 disabled:bg-sunk disabled:text-muted"
            >
              {enviando ? "Registrando…" : "Responder"}
            </button>
          )}
        </div>
      </article>

      <p className="text-center text-[0.8rem] text-muted">
        Teclado: A a D escolhem a alternativa, Enter responde e avança.
      </p>
    </div>
  );
}
