"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/browser";

const LETRAS = ["A", "B", "C", "D"] as const;
type Letra = (typeof LETRAS)[number];

export type QuestaoDaProva = {
  ordem: number;
  questaoId: string;
  numero: number;
  enunciado: string;
  alternativas: Record<string, string>;
  exameEdicao: number;
  disciplina: string | null;
  marcada: Letra | null;
};

function relogio(segundos: number) {
  const s = Math.max(0, segundos);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(seg).padStart(2, "0")}`;
}

/**
 * A prova em andamento.
 *
 * Sem gabarito, sem cor de certo e errado, sem contagem de acertos: as três
 * coisas que a tela de questões faz e que aqui destruiriam o exercício. O que
 * se treina num simulado é decidir sob incerteza e sob relógio.
 *
 * O relógio conta a partir de `finalizaEm`, que veio do banco. O navegador só
 * exibe a diferença — recarregar a página, trocar de aba ou adiantar o
 * relógio do sistema não devolve um segundo de prova.
 */
export function Prova({
  simuladoId,
  questoes,
  finalizaEm,
  edicao,
}: {
  simuladoId: string;
  questoes: QuestaoDaProva[];
  finalizaEm: string;
  edicao: number | null;
}) {
  const router = useRouter();
  const [indice, setIndice] = useState(0);
  const [marcadas, setMarcadas] = useState<Record<string, Letra>>(() =>
    Object.fromEntries(
      questoes
        .filter((q) => q.marcada)
        .map((q) => [q.questaoId, q.marcada as Letra]),
    ),
  );
  const [restante, setRestante] = useState<number | null>(null);
  const [finalizando, setFinalizando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const jaFinalizou = useRef(false);

  const questao = questoes[indice];
  const respondidas = Object.keys(marcadas).length;

  const finalizar = useCallback(async () => {
    if (jaFinalizou.current) return;
    jaFinalizou.current = true;
    setFinalizando(true);
    const { error } = await supabaseNavegador().rpc("finalizar_simulado", {
      p_simulado_id: simuladoId,
    });
    if (error) {
      setErro("Não consegui finalizar. Tente de novo.");
      jaFinalizou.current = false;
      setFinalizando(false);
      return;
    }
    router.refresh();
  }, [simuladoId, router]);

  // O relógio só existe depois da montagem: renderizar no servidor daria um
  // valor que já nasce velho e diverge na hidratação.
  useEffect(() => {
    const alvo = new Date(finalizaEm).getTime();
    const tique = () => {
      const falta = Math.round((alvo - Date.now()) / 1000);
      setRestante(falta);
      if (falta <= 0) void finalizar();
    };
    tique();
    const id = window.setInterval(tique, 1000);
    return () => window.clearInterval(id);
  }, [finalizaEm, finalizar]);

  async function marcar(letra: Letra) {
    if (!questao || finalizando) return;
    // Otimista: a marcação aparece na hora e o servidor confirma depois. Numa
    // prova de 80 questões, esperar a rede a cada clique seria o gargalo.
    setMarcadas((atual) => ({ ...atual, [questao.questaoId]: letra }));
    const { error } = await supabaseNavegador().rpc("marcar_no_simulado", {
      p_simulado_id: simuladoId,
      p_questao_id: questao.questaoId,
      p_alternativa: letra,
    });
    if (error) setErro("A marcação não foi salva. Verifique sua conexão.");
  }

  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      const alvo = evento.target as HTMLElement | null;
      if (alvo && ["INPUT", "TEXTAREA", "SELECT"].includes(alvo.tagName)) return;
      const letra = evento.key.toUpperCase();
      if ((LETRAS as readonly string[]).includes(letra)) {
        evento.preventDefault();
        void marcar(letra as Letra);
      } else if (evento.key === "ArrowRight" || evento.key === "Enter") {
        evento.preventDefault();
        setIndice((i) => Math.min(questoes.length - 1, i + 1));
      } else if (evento.key === "ArrowLeft") {
        evento.preventDefault();
        setIndice((i) => Math.max(0, i - 1));
      }
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indice, questoes.length, finalizando]);

  if (!questao) return null;

  const acabando = restante !== null && restante <= 300;

  return (
    <div className="painel-conteudo flex max-w-[1180px] flex-col gap-5">
      {/* ---- Relógio e progresso ---- */}
      <header className="superficie flex flex-wrap items-center justify-between gap-x-8 gap-y-3 p-5">
        <div className="flex flex-col gap-0.5">
          <span className="rotulo">
            {edicao ? `Simulado · ${edicao}º Exame` : "Simulado · mistura do acervo"}
          </span>
          <span className="text-[0.92rem] text-body tabular-nums">
            {respondidas} de {questoes.length} respondidas
          </span>
        </div>

        <div className="flex items-center gap-5">
          <span
            className={`text-[1.9rem] leading-none font-extrabold tracking-[-0.04em] tabular-nums ${
              acabando ? "text-vinho-600" : "text-ink"
            }`}
            aria-live="off"
          >
            {restante === null ? "—:—:—" : relogio(restante)}
          </span>

          {confirmando ? (
            <span className="flex items-center gap-2">
              <button
                type="button"
                onClick={finalizar}
                disabled={finalizando}
                className="rounded-full bg-vinho-500 px-4 py-2.5 text-[0.9rem] font-semibold text-white transition-colors hover:bg-vinho-600 disabled:opacity-60"
              >
                {finalizando ? "Corrigindo…" : "Entregar e corrigir"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmando(false)}
                className="rounded-full px-3 py-2.5 text-[0.9rem] font-medium text-muted hover:text-ink"
              >
                Voltar
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmando(true)}
              className="rounded-full border border-hairline px-5 py-2.5 text-[0.9rem] font-semibold text-ink transition-colors hover:border-vinho-200 hover:text-vinho-600"
            >
              Entregar prova
            </button>
          )}
        </div>
      </header>

      {confirmando && (
        <p className="rounded-[14px] bg-ouro-50 px-5 py-3 text-[0.9rem] text-ouro-700">
          Faltam {questoes.length - respondidas}{" "}
          {questoes.length - respondidas === 1 ? "questão" : "questões"} sem
          resposta. Entregar corrige o que está marcado e encerra o relógio.
        </p>
      )}

      {erro && (
        <p role="alert" className="rounded-[14px] bg-vinho-50 px-5 py-3 text-[0.9rem] text-vinho-700">
          {erro}
        </p>
      )}

      <div className="grid gap-5 xl:grid-cols-[1fr_260px] xl:items-start">
        {/* ---- A questão ---- */}
        <article className="superficie overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line bg-brand-50/60 px-6 py-3.5">
            <span className="text-[0.86rem] font-semibold text-brand-700 tabular-nums">
              Questão {questao.ordem} de {questoes.length}
            </span>
            <span className="text-[0.82rem] text-brand-600/70">
              {questao.disciplina ?? "sem classificação"}
            </span>
          </div>

          <div className="flex flex-col gap-5 p-6 sm:p-7">
            <p className="lei-texto whitespace-pre-line">{questao.enunciado}</p>

            <ul className="flex flex-col gap-1.5">
              {LETRAS.map((letra) => {
                const escolhida = marcadas[questao.questaoId] === letra;
                return (
                  <li key={letra}>
                    <button
                      type="button"
                      onClick={() => marcar(letra)}
                      aria-pressed={escolhida}
                      className={`flex w-full items-start gap-3 rounded-[12px] border px-4 py-3 text-left transition-colors ${
                        escolhida
                          ? "border-brand-400 bg-brand-50"
                          : "border-line bg-surface hover:border-brand-200 hover:bg-brand-50/50"
                      }`}
                    >
                      <span
                        className={`mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.76rem] font-bold ${
                          escolhida
                            ? "bg-brand-600 text-white"
                            : "bg-sunk text-body"
                        }`}
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
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-4">
            <button
              type="button"
              disabled={indice === 0}
              onClick={() => setIndice((i) => Math.max(0, i - 1))}
              className="rounded-full px-3 py-2 text-[0.9rem] font-medium text-muted transition-colors hover:text-ink disabled:opacity-35"
            >
              ← Anterior
            </button>
            <button
              type="button"
              disabled={indice === questoes.length - 1}
              onClick={() =>
                setIndice((i) => Math.min(questoes.length - 1, i + 1))
              }
              className="rounded-full bg-brand-600 px-5 py-2.5 text-[0.9rem] font-semibold text-white transition-colors hover:bg-brand-700 disabled:bg-sunk disabled:text-muted"
            >
              Próxima →
            </button>
          </div>
        </article>

        {/* ---- Cartão-resposta ---- */}
        <aside className="superficie flex flex-col gap-3 p-5 xl:sticky xl:top-4">
          <span className="rotulo">Cartão-resposta</span>
          <div className="grid grid-cols-8 gap-1.5 xl:grid-cols-6">
            {questoes.map((q, i) => {
              const respondida = Boolean(marcadas[q.questaoId]);
              const atual = i === indice;
              return (
                <button
                  key={q.questaoId}
                  type="button"
                  onClick={() => setIndice(i)}
                  title={`Questão ${q.ordem}`}
                  className={`flex h-8 items-center justify-center rounded-[7px] text-[0.75rem] font-semibold tabular-nums transition-colors ${
                    atual
                      ? "bg-brand-700 text-white"
                      : respondida
                        ? "bg-brand-100 text-brand-700"
                        : "bg-sunk text-muted hover:bg-hairline"
                  }`}
                >
                  {q.ordem}
                </button>
              );
            })}
          </div>
          <p className="text-[0.78rem] text-muted">
            Teclado: A a D marcam, ← e → navegam.
          </p>
        </aside>
      </div>
    </div>
  );
}
