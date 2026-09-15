"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { formatarData } from "@/lib/format";
import { supabaseNavegador } from "@/lib/supabase/browser";

export type AlteracaoLegislativa = {
  id: string;
  artigoId: string;
  leiSlug: string;
  leiSigla: string;
  artigoSlug: string;
  numero: string;
  caputAnterior: string;
  paragrafosAnteriores: string[];
  caputNovo: string;
  paragrafosNovos: string[];
  comentarioAnterior: string[];
  indexavelAnterior: boolean;
  detectadaEm: string;
};

export function AlteracoesLegislativas({
  fila: filaInicial,
}: {
  fila: AlteracaoLegislativa[];
}) {
  const [fila, setFila] = useState(filaInicial);
  const atual = fila[0] ?? null;

  const resolver = useCallback(() => {
    if (!atual) return;
    setFila((itens) => itens.filter((item) => item.id !== atual.id));
  }, [atual]);

  return (
    <div className="painel-conteudo flex max-w-[1280px] flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-[64ch]">
          <span className="rotulo">Fonte oficial sob vigilância</span>
          <h1 className="mt-1 text-[clamp(1.75rem,3vw,2.15rem)] leading-[1.08] font-extrabold tracking-[-0.035em] text-ink">
            Alterações legislativas
          </h1>
          <p className="mt-2 text-body">
            A carga encontrou uma redação diferente no Planalto. O texto oficial
            já foi atualizado; o comentário antigo ficou preservado aqui e a
            página saiu do índice até esta revisão terminar.
          </p>
        </div>
        <span className="rounded-full bg-ouro-100 px-3 py-1.5 text-[0.82rem] font-semibold text-ouro-700 tabular-nums">
          {fila.length} {fila.length === 1 ? "revisão pendente" : "revisões pendentes"}
        </span>
      </header>

      {!atual ? (
        <section className="superficie p-8">
          <h2 className="text-[1.2rem] font-bold text-ink">Nenhuma mudança aguardando revisão.</h2>
          <p className="mt-2 text-[0.9rem] text-muted">
            A próxima ingestão compara novamente o acervo com a fonte oficial.
          </p>
        </section>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[15px] bg-paper px-5 py-3">
            <strong className="text-ink">Art. {atual.numero} {atual.leiSigla}</strong>
            <span className="text-[0.8rem] text-muted">
              detectada em {formatarData(atual.detectadaEm.slice(0, 10))}
            </span>
          </div>

          <section className="grid gap-4 lg:grid-cols-2">
            <TextoLegal titulo="Redação anterior" tom="anterior" caput={atual.caputAnterior} paragrafos={atual.paragrafosAnteriores} />
            <TextoLegal titulo="Redação oficial atual" tom="novo" caput={atual.caputNovo} paragrafos={atual.paragrafosNovos} />
          </section>

          <EditorDaAlteracao key={atual.id} alteracao={atual} aoResolver={resolver} />

          <Link
            href={`/legislacao/${atual.leiSlug}/${atual.artigoSlug}`}
            target="_blank"
            className="self-start text-[0.84rem] font-semibold text-brand-700 underline decoration-brand-200 underline-offset-4"
          >
            Conferir página do artigo em outra aba →
          </Link>
        </>
      )}
    </div>
  );
}

function TextoLegal({
  titulo,
  tom,
  caput,
  paragrafos,
}: {
  titulo: string;
  tom: "anterior" | "novo";
  caput: string;
  paragrafos: string[];
}) {
  return (
    <article className={`rounded-[18px] border p-6 ${tom === "novo" ? "border-brand-200 bg-brand-50" : "border-vinho-100 bg-vinho-50"}`}>
      <span className={`text-[0.7rem] font-bold tracking-[0.12em] uppercase ${tom === "novo" ? "text-brand-700" : "text-vinho-600"}`}>
        {titulo}
      </span>
      <div className="lei-texto mt-4">
        <p>{caput}</p>
        {paragrafos.map((paragrafo, indice) => <p key={indice}>{paragrafo}</p>)}
      </div>
    </article>
  );
}

function EditorDaAlteracao({
  alteracao,
  aoResolver,
}: {
  alteracao: AlteracaoLegislativa;
  aoResolver: () => void;
}) {
  const [texto, setTexto] = useState(alteracao.comentarioAnterior.join("\n\n"));
  const [indexavel, setIndexavel] = useState(alteracao.indexavelAnterior);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const comentario = texto.split(/\n{2,}/).map((trecho) => trecho.trim()).filter(Boolean);

  async function salvar() {
    if (salvando) return;
    if (indexavel && comentario.length === 0) {
      setErro("Uma página indexável precisa de comentário revisado.");
      return;
    }
    setSalvando(true);
    setErro(null);
    const { error } = await supabaseNavegador().rpc("resolver_alteracao_legislativa", {
      p_alteracao: alteracao.id,
      p_comentario: comentario,
      p_indexavel: indexavel,
    });
    setSalvando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    aoResolver();
  }

  return (
    <section className="superficie p-6 sm:p-7">
      <span className="rotulo">Revisar comentário preservado</span>
      <p className="mt-1 max-w-[70ch] text-[0.84rem] text-muted">
        Ajuste somente o que a nova redação afetou. Publicar devolve a página ao índice; manter sem indexação salva o texto como rascunho revisado.
      </p>
      <textarea
        value={texto}
        onChange={(evento) => setTexto(evento.target.value)}
        rows={10}
        className="mt-5 w-full rounded-[14px] border border-hairline bg-surface p-4 text-[0.92rem] leading-relaxed text-ink outline-none focus:border-brand-300"
      />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-[0.86rem] text-body">
          <input type="checkbox" checked={indexavel} onChange={(evento) => setIndexavel(evento.target.checked)} className="h-4 w-4 accent-brand-600" />
          Comentário revisto; devolver ao sitemap
        </label>
        <span className="text-[0.78rem] text-muted">{comentario.length} {comentario.length === 1 ? "parágrafo" : "parágrafos"}</span>
      </div>
      {erro && <p role="alert" className="mt-4 rounded-[12px] bg-vinho-50 px-4 py-3 text-[0.86rem] text-vinho-700">{erro}</p>}
      <button type="button" onClick={() => void salvar()} disabled={salvando} className="mt-5 rounded-full bg-brand-600 px-5 py-2.5 text-[0.88rem] font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
        {salvando ? "Salvando revisão…" : "Concluir revisão"}
      </button>
    </section>
  );
}
