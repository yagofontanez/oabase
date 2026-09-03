"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/browser";

export type QuestaoParaRevisar = {
  id: string;
  numero: number;
  exame: string;
  edicao: number;
  enunciado: string;
  alternativas: Record<string, string>;
  palpite: string | null;
  anulada: boolean;
};

export type DisciplinaOpcao = { slug: string; nome: string };

/**
 * Triagem de disciplina — a ferramenta, não o produto.
 *
 * 3.540 questões classificadas por heurística e nenhuma confirmada por
 * humano. Enquanto for assim, a distribuição por exame não existe, o gráfico
 * de evolução por matéria não existe, e `/estatisticas` publica estimativa.
 * O trabalho é de leitura; o que o código pode fazer é não cobrar um clique a
 * mais do que o necessário.
 *
 * Daí o desenho: **o teclado decide tudo**. Número escolhe a disciplina,
 * Enter aceita o palpite do léxico (que acerta a maioria), `S` pula. A mão
 * não sai da posição, e a fila se repõe sozinha antes de acabar — parar para
 * carregar a próxima página é o que faz alguém desistir na trigésima questão.
 *
 * A confirmação é otimista: a tela avança na hora e o `rpc` viaja atrás. Numa
 * ferramenta interna isso é aceitável — se falhar, a questão volta para a
 * fila na próxima carga, porque `disciplina_confirmada` continua falso.
 */
export function Triagem({
  filaInicial,
  disciplinas,
  pendentesIniciais,
  confirmadasIniciais,
}: {
  filaInicial: QuestaoParaRevisar[];
  disciplinas: DisciplinaOpcao[];
  pendentesIniciais: number;
  confirmadasIniciais: number;
}) {
  const [fila, setFila] = useState<QuestaoParaRevisar[]>(filaInicial);
  const [erro, setErro] = useState<string | null>(null);
  const [feitas, setFeitas] = useState(0);
  const [confirmadas, setConfirmadas] = useState(confirmadasIniciais);

  const atual = fila[0] ?? null;

  /**
   * Repõe a fila **a partir do avanço**, não de um efeito que observa o
   * tamanho: buscar mais é consequência de alguém ter classificado uma
   * questão, e efeito que dispara rede ao ver um número mudar reexecuta em
   * situações que ninguém previu. A primeira página vem do servidor.
   */
  const repor = useCallback(async (restantes: number) => {
    if (restantes > 6) return;
    const { data, error } = await supabaseNavegador().rpc("fila_de_revisao", {
      p_limite: 25,
    });
    if (error) {
      setErro(error.message);
      return;
    }
    const novas = (data ?? []) as QuestaoParaRevisar[];
    setFila((antiga) => {
      const vistos = new Set(antiga.map((q) => q.id));
      return [...antiga, ...novas.filter((q) => !vistos.has(q.id))];
    });
  }, []);

  const confirmar = useCallback(
    (slug: string) => {
      if (!atual) return;
      const questao = atual;
      const restantes = fila.length - 1;
      setFila((f) => f.slice(1));
      setFeitas((n) => n + 1);
      setConfirmadas((n) => n + 1);
      void repor(restantes);

      void supabaseNavegador()
        .rpc("confirmar_disciplina", {
          p_questao: questao.id,
          p_disciplina_slug: slug,
        })
        .then(({ error }) => {
          if (error) {
            // Sem `disciplina_confirmada`, ela volta na próxima carga.
            setErro(`Questão ${questao.numero}: ${error.message}`);
            setConfirmadas((n) => n - 1);
          }
        });
    },
    [atual, fila.length, repor],
  );

  const pular = useCallback(() => {
    const restantes = fila.length - 1;
    setFila((f) => f.slice(1));
    void repor(restantes);
  }, [fila.length, repor]);

  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.metaKey || evento.ctrlKey || evento.altKey) return;
      const alvo = evento.target as HTMLElement | null;
      if (alvo && /^(INPUT|TEXTAREA)$/.test(alvo.tagName)) return;

      if (evento.key === "Enter" && atual?.palpite) {
        evento.preventDefault();
        confirmar(atual.palpite);
        return;
      }
      if (evento.key.toLowerCase() === "s") {
        evento.preventDefault();
        pular();
        return;
      }
      const indice = Number(evento.key);
      if (indice >= 1 && indice <= 9 && disciplinas[indice - 1]) {
        evento.preventDefault();
        confirmar(disciplinas[indice - 1].slug);
      }
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [atual, confirmar, pular, disciplinas]);

  const nomePalpite = atual?.palpite
    ? (disciplinas.find((d) => d.slug === atual.palpite)?.nome ?? atual.palpite)
    : null;
  const pendentes = Math.max(0, pendentesIniciais - feitas);

  return (
    <div className="painel-conteudo flex max-w-[1100px] flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex max-w-[54ch] flex-col gap-2">
          <h1 className="text-[clamp(1.75rem,3vw,2.15rem)] leading-[1.08] font-extrabold tracking-[-0.035em] text-ink">
            Triagem de disciplina
          </h1>
          <p className="text-body">
            Número escolhe · <kbd className="tecla">Enter</kbd> aceita o
            palpite · <kbd className="tecla">S</kbd> pula. Confirmar é afirmar
            que alguém leu — não confirme no chute.
          </p>
        </div>
        <dl className="flex gap-6 text-[0.9rem]">
          <div className="flex flex-col">
            <dd className="text-[1.4rem] font-bold tabular-nums text-brand-600">
              {confirmadas.toLocaleString("pt-BR")}
            </dd>
            <dt className="text-muted">confirmadas</dt>
          </div>
          <div className="flex flex-col">
            <dd className="text-[1.4rem] font-bold tabular-nums text-ink">
              {pendentes.toLocaleString("pt-BR")}
            </dd>
            <dt className="text-muted">pendentes</dt>
          </div>
        </dl>
      </header>

      {erro && (
        <p className="rounded-[12px] border border-ouro-300 bg-ouro-50 px-4 py-3 text-[0.9rem] text-ouro-800">
          {erro}
        </p>
      )}

      {!atual ? (
        <p className="rounded-2xl bg-paper p-8 text-body">
          Nada pendente por aqui. Se a contagem acima ainda mostra questões,
          recarregue a página — a fila vem em blocos.
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <article className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-7">
            <div className="flex flex-wrap items-center gap-3 text-[0.82rem] text-muted">
              <span className="rounded-full bg-sunk px-2.5 py-1 font-semibold">
                {atual.edicao}º Exame · questão {atual.numero}
              </span>
              {atual.anulada && (
                <span className="rounded-full bg-ouro-100 px-2.5 py-1 font-semibold text-ouro-700">
                  anulada
                </span>
              )}
              {nomePalpite && (
                <span>
                  palpite do léxico: <strong>{nomePalpite}</strong>
                </span>
              )}
            </div>

            <p className="text-[1.02rem] leading-relaxed text-ink">
              {atual.enunciado}
            </p>

            <ul className="flex flex-col gap-2 text-[0.94rem] text-body">
              {Object.entries(atual.alternativas).map(([letra, texto]) => (
                <li key={letra} className="flex gap-3">
                  <span className="font-semibold text-muted">{letra}</span>
                  <span>{texto}</span>
                </li>
              ))}
            </ul>
          </article>

          <div className="flex flex-col gap-2">
            {atual.palpite && (
              <button
                type="button"
                onClick={() => confirmar(atual.palpite!)}
                className="rounded-[12px] bg-brand-600 px-4 py-3 text-left text-[0.95rem] font-semibold text-white transition-colors hover:bg-brand-700"
              >
                <span className="tecla-clara">Enter</span> {nomePalpite}
              </button>
            )}
            {disciplinas.map((d, i) => (
              <button
                key={d.slug}
                type="button"
                onClick={() => confirmar(d.slug)}
                className="flex items-center gap-3 rounded-[12px] border border-line bg-surface px-4 py-2.5 text-left text-[0.92rem] text-body transition-colors hover:border-brand-300 hover:text-brand-700"
              >
                {i < 9 && <kbd className="tecla">{i + 1}</kbd>}
                {d.nome}
              </button>
            ))}
            <button
              type="button"
              onClick={pular}
              className="mt-1 rounded-[12px] px-4 py-2.5 text-left text-[0.9rem] text-muted transition-colors hover:text-ink"
            >
              <kbd className="tecla">S</kbd> pular sem confirmar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
