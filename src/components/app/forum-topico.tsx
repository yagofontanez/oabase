"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseNavegador } from "@/lib/supabase/browser";
import { formatarData } from "@/lib/format";
import { mensagemDeErro } from "./forum";

export type RespostaDoForum = {
  id: string;
  autor_nome: string;
  corpo: string;
  removido: boolean;
  criado_em: string;
};

export type TopicoAberto = {
  id: string;
  titulo: string;
  corpo: string;
  autor_nome: string;
  disciplina: string | null;
  trancado: boolean;
  removido: boolean;
  criado_em: string;
};

/**
 * Um tópico e sua conversa.
 *
 * A moderação aparece só para admin, e o que ela faz é marcar `removido` —
 * nunca apagar a linha. Apagar some com a resposta que citava a mensagem e
 * reabre a discussão do zero; a marca esvazia o conteúdo e mantém o fio.
 */
export function TopicoDoForum({
  topico,
  respostas,
  moderador,
}: {
  topico: TopicoAberto;
  respostas: RespostaDoForum[];
  moderador: boolean;
}) {
  const router = useRouter();
  const [corpo, setCorpo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function responder(evento: React.FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setErro(null);
    const { error } = await supabaseNavegador().rpc("responder_topico", {
      p_topico: topico.id,
      p_corpo: corpo,
    });
    setEnviando(false);
    if (error) {
      setErro(mensagemDeErro(error.message));
      return;
    }
    setCorpo("");
    router.refresh();
  }

  async function moderar(
    tabela: "forum_topicos" | "forum_respostas",
    id: string,
    campos: Record<string, boolean>,
  ) {
    const { error } = await supabaseNavegador()
      .from(tabela)
      .update(campos)
      .eq("id", id);
    if (error) {
      setErro("Não consegui moderar.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="painel-conteudo flex max-w-[820px] flex-col gap-6">
      <Link
        href="/app/forum"
        className="self-start text-[0.9rem] font-semibold text-brand-700 underline decoration-brand-200 underline-offset-4"
      >
        ← Fórum
      </Link>

      <header className="flex flex-col gap-2">
        <h1 className="text-[clamp(1.5rem,2.6vw,1.95rem)] leading-[1.15] font-extrabold tracking-[-0.03em] text-ink">
          {topico.removido ? "[removido pela moderação]" : topico.titulo}
        </h1>
        <p className="text-[0.85rem] text-muted">
          {topico.autor_nome} · {formatarData(topico.criado_em.slice(0, 10))}
          {topico.disciplina ? ` · ${topico.disciplina}` : ""}
          {topico.trancado ? " · trancado" : ""}
        </p>
      </header>

      {erro && (
        <p className="rounded-[12px] border border-vinho-200 bg-vinho-50 px-4 py-3 text-[0.9rem] text-vinho-700">
          {erro}
        </p>
      )}

      <article className="superficie flex flex-col gap-3 p-6">
        <p className="text-[1rem] leading-relaxed whitespace-pre-wrap text-body">
          {topico.removido ? "Conteúdo removido." : topico.corpo}
        </p>
        {moderador && (
          <div className="flex flex-wrap gap-2 border-t border-line pt-3">
            <BotaoDeModeracao
              rotulo={topico.removido ? "Restaurar" : "Remover"}
              onClick={() =>
                moderar("forum_topicos", topico.id, {
                  removido: !topico.removido,
                })
              }
            />
            <BotaoDeModeracao
              rotulo={topico.trancado ? "Destrancar" : "Trancar"}
              onClick={() =>
                moderar("forum_topicos", topico.id, {
                  trancado: !topico.trancado,
                })
              }
            />
          </div>
        )}
      </article>

      <section className="flex flex-col gap-3">
        {respostas.map((r) => (
          <article
            key={r.id}
            className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-5"
          >
            <span className="text-[0.8rem] font-semibold text-muted">
              {r.autor_nome} · {formatarData(r.criado_em.slice(0, 10))}
            </span>
            <p className="text-[0.96rem] leading-relaxed whitespace-pre-wrap text-body">
              {r.removido ? "Conteúdo removido." : r.corpo}
            </p>
            {moderador && (
              <BotaoDeModeracao
                rotulo={r.removido ? "Restaurar" : "Remover"}
                onClick={() =>
                  moderar("forum_respostas", r.id, { removido: !r.removido })
                }
              />
            )}
          </article>
        ))}
      </section>

      {topico.trancado || topico.removido ? (
        <p className="rounded-2xl bg-paper p-6 text-[0.94rem] text-muted">
          Este tópico não recebe novas respostas.
        </p>
      ) : (
        <form onSubmit={responder} className="flex flex-col gap-2">
          <textarea
            value={corpo}
            onChange={(e) => setCorpo(e.target.value)}
            placeholder="Responder"
            rows={5}
            maxLength={8000}
            className="w-full resize-none rounded-[12px] border border-line bg-surface px-4 py-3 text-[0.95rem] leading-relaxed text-ink outline-none focus:border-brand-400"
          />
          <button
            type="submit"
            disabled={enviando || corpo.trim().length < 2}
            className="self-start rounded-full bg-brand-600 px-5 py-2.5 text-[0.92rem] font-semibold text-white transition-colors hover:bg-brand-700 disabled:bg-brand-200"
          >
            {enviando ? "Enviando…" : "Responder"}
          </button>
        </form>
      )}
    </div>
  );
}

function BotaoDeModeracao({
  rotulo,
  onClick,
}: {
  rotulo: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="self-start rounded-full border border-line px-3.5 py-1.5 text-[0.82rem] font-semibold text-muted transition-colors hover:border-vinho-200 hover:text-vinho-600"
    >
      {rotulo}
    </button>
  );
}
