"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/browser";

export type QuestaoParaVincular = {
  id: string;
  numero: number;
  edicao: number;
  exame: string;
  enunciado: string;
  alternativas: Record<string, string>;
  disciplina: string | null;
};

export type LeiOpcao = { slug: string; sigla: string; nome: string };

type Sugestao = {
  lei_slug: string;
  lei_sigla: string;
  artigo_slug: string;
  numero: string;
  caput: string;
  relevancia: number;
};

/**
 * Vincular questão a dispositivo — o gesto que o algoritmo não pode dar.
 *
 * `dispositivos.py` acha 164 vínculos em 3.540 questões, e não é defeito do
 * regex: a FGV narra um caso e quase nunca nomeia o artigo. Preencher o resto
 * por semelhança de texto e gravar como vínculo transformaria
 * `artigos.incidencia` — o número que ordena o que estudar — em palpite com
 * aparência de medição.
 *
 * Então a sugestão fica onde ela vale: **na tela, com a relevância à vista**,
 * e o que ela produz ao ser aceita é `origem = 'humano'`. Enquanto
 * `questoes.embedding` estiver vazio, a semelhança é só `ts_rank` de texto em
 * português e erra bastante — por isso a busca manual está ao lado, e não
 * escondida atrás de um "não achei".
 *
 * Cada vínculo confirmado reordena, na hora, a fila de quem escreve
 * comentário: é o mesmo gatilho que recalcula a incidência.
 */
export function Vinculos({
  filaInicial,
  leis,
}: {
  filaInicial: QuestaoParaVincular[];
  leis: LeiOpcao[];
}) {
  const [fila, setFila] = useState(filaInicial);
  const [feitos, setFeitos] = useState(0);

  const atual = fila[0] ?? null;

  const avancar = useCallback(async () => {
    const restantes = fila.length - 1;
    setFila((f) => f.slice(1));
    if (restantes > 4) return;
    const { data } = await supabaseNavegador().rpc("fila_de_vinculo", {
      p_limite: 12,
    });
    const novas = (data ?? []) as QuestaoParaVincular[];
    setFila((antiga) => {
      const vistos = new Set(antiga.map((q) => q.id));
      return [...antiga, ...novas.filter((q) => !vistos.has(q.id))];
    });
  }, [fila.length]);

  return (
    <div className="painel-conteudo flex max-w-[1150px] flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex max-w-[58ch] flex-col gap-2">
          <h1 className="text-[clamp(1.75rem,3vw,2.15rem)] leading-[1.08] font-extrabold tracking-[-0.035em] text-ink">
            Vincular questão a dispositivo
          </h1>
          <p className="text-body">
            A sugestão por semelhança é fraca enquanto não houver embedding —
            confira antes de aceitar. O que você confirma entra como vínculo{" "}
            <strong>humano</strong> e conta na incidência.
          </p>
        </div>
        <dl className="flex flex-col text-[0.9rem]">
          <dd className="text-[1.4rem] font-bold tabular-nums text-brand-600">
            {feitos}
          </dd>
          <dt className="text-muted">vínculos nesta sessão</dt>
        </dl>
      </header>

      {!atual ? (
        <p className="rounded-2xl bg-paper p-8 text-body">
          Nenhuma questão sem vínculo na fila carregada. Recarregue a página
          para buscar o próximo bloco.
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <article className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-7">
            <div className="flex flex-wrap items-center gap-3 text-[0.82rem] text-muted">
              <span className="rounded-full bg-sunk px-2.5 py-1 font-semibold">
                {atual.edicao}º Exame · questão {atual.numero}
              </span>
              {atual.disciplina && <span>{atual.disciplina}</span>}
            </div>

            <p className="text-[1.02rem] leading-relaxed text-ink">
              {atual.enunciado}
            </p>

            <ul className="flex flex-col gap-2 text-[0.92rem] text-body">
              {Object.entries(atual.alternativas).map(([letra, texto]) => (
                <li key={letra} className="flex gap-3">
                  <span className="font-semibold text-muted">{letra}</span>
                  <span>{texto}</span>
                </li>
              ))}
            </ul>
          </article>

          {/* `key` na questão: sugestão, busca e lista de ligados são estado
              daquela questão. Remontar é o que garante que nada de uma
              sobreviva na tela da seguinte. */}
          <PainelDeVinculo
            key={atual.id}
            questao={atual}
            leis={leis}
            aoLigar={() => setFeitos((n) => n + 1)}
            aoAvancar={() => void avancar()}
          />
        </div>
      )}
    </div>
  );
}

function PainelDeVinculo({
  questao,
  leis,
  aoLigar,
  aoAvancar,
}: {
  questao: QuestaoParaVincular;
  leis: LeiOpcao[];
  aoLigar: () => void;
  aoAvancar: () => void;
}) {
  const [sugestoes, setSugestoes] = useState<Sugestao[] | null>(null);
  const [ligados, setLigados] = useState<string[]>([]);
  const [lei, setLei] = useState(leis[0]?.slug ?? "");
  const [numero, setNumero] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Uma consulta de texto por questão: só vale a pena para a que está na
  // tela. O `setState` acontece na resposta, não no corpo do efeito.
  useEffect(() => {
    let ativo = true;
    void supabaseNavegador()
      .rpc("sugestoes_de_artigo", { p_questao: questao.id, p_limite: 6 })
      .then(({ data }) => {
        if (ativo) setSugestoes((data ?? []) as Sugestao[]);
      });
    return () => {
      ativo = false;
    };
  }, [questao.id]);

  const vincular = useCallback(
    async (leiSlug: string, artigoSlug: string, rotulo: string) => {
      const { error } = await supabaseNavegador().rpc("vincular_artigo", {
        p_questao: questao.id,
        p_lei_slug: leiSlug,
        p_artigo_slug: artigoSlug,
      });
      if (error) {
        setErro(error.message);
        return;
      }
      setErro(null);
      setLigados((l) => (l.includes(rotulo) ? l : [...l, rotulo]));
      aoLigar();
    },
    [questao.id, aoLigar],
  );

  const buscarManual = useCallback(async () => {
    if (!numero.trim()) return;
    setBuscando(true);
    setErro(null);
    // `artigos` é leitura aberta: não há por que inventar função para
    // procurar o que qualquer visitante do site já procura.
    const { data } = await supabaseNavegador()
      .from("artigos")
      .select("slug, numero, leis!inner(slug, sigla)")
      .eq("leis.slug", lei)
      .eq("numero", numero.trim())
      .limit(1);

    setBuscando(false);
    const linha = (data ?? [])[0] as
      | {
          slug: string;
          numero: string;
          leis: { slug: string; sigla: string } | { slug: string; sigla: string }[];
        }
      | undefined;

    if (!linha) {
      setErro(`Não achei o art. ${numero.trim()} nessa lei.`);
      return;
    }
    // O supabase-js tipa a relação embutida como lista; em `!inner` com um
    // registro só ela chega como objeto. Aceitar as duas formas evita um erro
    // que só aparece em produção.
    const leiDoArtigo = Array.isArray(linha.leis) ? linha.leis[0] : linha.leis;
    await vincular(
      leiDoArtigo.slug,
      linha.slug,
      `art. ${linha.numero} ${leiDoArtigo.sigla}`,
    );
    setNumero("");
  }, [lei, numero, vincular]);

  return (
    <div className="flex flex-col gap-4">
      {erro && (
        <p className="rounded-[12px] border border-ouro-300 bg-ouro-50 px-4 py-3 text-[0.9rem] text-ouro-800">
          {erro}
        </p>
      )}

      {ligados.length > 0 && (
        <p className="rounded-[12px] border border-brand-200 bg-brand-50 px-4 py-3 text-[0.9rem] text-brand-800">
          Ligada a {ligados.join(", ")}.
        </p>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-[0.86rem] font-semibold text-muted">
          Sugestões por semelhança de texto
        </h2>
        {sugestoes === null ? (
          <p className="text-[0.9rem] text-muted">Procurando…</p>
        ) : sugestoes.length === 0 ? (
          <p className="text-[0.9rem] text-muted">
            Nenhuma sugestão — use a busca abaixo.
          </p>
        ) : (
          sugestoes.map((s) => (
            <button
              key={`${s.lei_slug}-${s.artigo_slug}`}
              type="button"
              onClick={() =>
                void vincular(
                  s.lei_slug,
                  s.artigo_slug,
                  `art. ${s.numero} ${s.lei_sigla}`,
                )
              }
              className="flex flex-col gap-1 rounded-[12px] border border-line bg-surface px-4 py-3 text-left transition-colors hover:border-brand-300"
            >
              <span className="flex items-baseline gap-2 text-[0.92rem] font-semibold text-ink">
                Art. {s.numero} {s.lei_sigla}
                <span className="text-[0.76rem] font-normal text-muted tabular-nums">
                  relevância {s.relevancia.toFixed(3)}
                </span>
              </span>
              <span className="line-clamp-2 text-[0.85rem] text-muted">
                {s.caput}
              </span>
            </button>
          ))
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-[0.86rem] font-semibold text-muted">
          Ou informe o artigo
        </h2>
        <div className="flex gap-2">
          <select
            value={lei}
            onChange={(e) => setLei(e.target.value)}
            className="rounded-[12px] border border-line bg-surface px-3 py-2.5 text-[0.9rem] text-ink"
          >
            {leis.map((l) => (
              <option key={l.slug} value={l.slug}>
                {l.sigla}
              </option>
            ))}
          </select>
          <input
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void buscarManual();
            }}
            placeholder="número, ex. 121 ou 217-A"
            className="min-w-0 flex-1 rounded-[12px] border border-line bg-surface px-4 py-2.5 text-[0.9rem] text-ink outline-none focus:border-brand-400"
          />
          <button
            type="button"
            onClick={() => void buscarManual()}
            disabled={buscando || !numero.trim()}
            className="rounded-[12px] bg-brand-600 px-4 py-2.5 text-[0.9rem] font-semibold text-white transition-colors hover:bg-brand-700 disabled:bg-brand-200"
          >
            Ligar
          </button>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={aoAvancar}
          className="rounded-full bg-brand-600 px-6 py-2.5 text-[0.94rem] font-semibold text-white transition-colors hover:bg-brand-700"
        >
          Próxima questão
        </button>
        <button
          type="button"
          onClick={aoAvancar}
          className="rounded-full px-5 py-2.5 text-[0.92rem] text-muted transition-colors hover:text-ink"
        >
          Nenhum artigo identificável
        </button>
      </div>
    </div>
  );
}
