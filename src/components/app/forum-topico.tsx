"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseNavegador } from "@/lib/supabase/browser";
import { formatarData, tempoRelativo } from "@/lib/format";
import { Iniciais } from "./iniciais";
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
 * A pergunta ganha peso tipográfico e as respostas ficam recuadas atrás de um
 * fio: numa discussão, saber onde a pergunta acaba e a conversa começa é
 * metade da leitura. Sem isso, a primeira resposta parece continuação do
 * texto de quem perguntou.
 *
 * A moderação aparece só para admin, e o que ela faz é marcar `removido` —
 * nunca apagar. Apagar some com a resposta que citava a mensagem e reabre a
 * discussão do zero; a marca esvazia o conteúdo e mantém o fio.
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

  const fechado = topico.trancado || topico.removido;

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
    <div className="painel-conteudo flex max-w-[840px] flex-col gap-6">
      <Link
        href="/app/forum"
        className="self-start text-[0.88rem] font-semibold text-brand-700 transition-colors hover:text-brand-600"
      >
        ← Fórum
      </Link>

      {erro && (
        <p
          role="alert"
          className="rounded-[12px] border border-vinho-200 bg-vinho-50 px-4 py-3 text-[0.9rem] text-vinho-700"
        >
          {erro}
        </p>
      )}

      {/* ---- A pergunta ---- */}
      <article className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <span className="flex flex-wrap items-center gap-2 text-[0.79rem]">
            {topico.disciplina && (
              <span className="selo">{topico.disciplina}</span>
            )}
            {topico.trancado && (
              <span className="rounded-full bg-sunk px-2.5 py-1 font-semibold text-muted">
                trancado
              </span>
            )}
          </span>
          <h1 className="text-[clamp(1.5rem,2.8vw,2rem)] leading-[1.14] font-extrabold tracking-[-0.03em] text-ink">
            {topico.removido ? "[removido pela moderação]" : topico.titulo}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Iniciais nome={topico.autor_nome} tom="marca" />
          <span className="flex flex-col">
            <span className="text-[0.9rem] font-semibold text-ink">
              {topico.autor_nome}
            </span>
            <span className="text-[0.79rem] text-muted">
              perguntou {tempoRelativo(topico.criado_em)} ·{" "}
              {formatarData(topico.criado_em.slice(0, 10))}
            </span>
          </span>
        </div>

        <p className="text-[1.05rem] leading-relaxed whitespace-pre-wrap text-body">
          {topico.removido ? "Conteúdo removido." : topico.corpo}
        </p>

        {moderador && (
          <div className="flex flex-wrap gap-2">
            <BotaoDeModeracao
              rotulo={topico.removido ? "Restaurar tópico" : "Remover tópico"}
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

      {/* ---- A conversa ----
          Recuada atrás de um fio: é o que separa a pergunta das respostas
          sem precisar de moldura em cada uma. */}
      <section className="flex flex-col gap-4 border-t border-line pt-6">
        <h2 className="text-[0.82rem] font-bold tracking-[0.06em] text-muted uppercase">
          {respostas.length === 0
            ? "Nenhuma resposta ainda"
            : `${respostas.length} ${respostas.length === 1 ? "resposta" : "respostas"}`}
        </h2>

        {respostas.length === 0 ? (
          <p className="max-w-[52ch] text-[0.96rem] text-body">
            {fechado
              ? "Este tópico foi encerrado sem resposta."
              : "Se você sabe alguma coisa sobre isto — mesmo que não seja a resposta inteira — escreva abaixo. Metade das dúvidas se resolve com um empurrão."}
          </p>
        ) : (
          <ol className="flex flex-col gap-4 border-l border-line pl-5 sm:pl-6">
            {respostas.map((r) => (
              <li key={r.id} className="relative flex flex-col gap-2">
                {/* O ponto na linha do tempo: marca cada voz sem cercar
                    cada resposta com uma caixa. */}
                <span
                  aria-hidden="true"
                  className="absolute top-3.5 -left-[1.68rem] h-2 w-2 rounded-full bg-hairline sm:-left-[1.93rem]"
                />
                <span className="flex items-center gap-2.5">
                  <Iniciais nome={r.autor_nome} />
                  <span className="flex flex-col">
                    <span className="text-[0.88rem] font-semibold text-ink">
                      {r.autor_nome}
                    </span>
                    <span className="text-[0.76rem] text-muted">
                      {tempoRelativo(r.criado_em)}
                    </span>
                  </span>
                </span>
                <p className="text-[0.98rem] leading-relaxed whitespace-pre-wrap text-body">
                  {r.removido ? "Conteúdo removido." : r.corpo}
                </p>
                {moderador && (
                  <BotaoDeModeracao
                    rotulo={r.removido ? "Restaurar" : "Remover"}
                    onClick={() =>
                      moderar("forum_respostas", r.id, {
                        removido: !r.removido,
                      })
                    }
                  />
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {fechado ? (
        <p className="rounded-2xl bg-paper p-5 text-[0.92rem] text-muted">
          Este tópico não recebe novas respostas.
        </p>
      ) : (
        <form
          onSubmit={responder}
          className="flex flex-col gap-2 border-t border-line pt-6"
        >
          <label
            htmlFor="resposta"
            className="text-[0.82rem] font-bold tracking-[0.06em] text-muted uppercase"
          >
            Sua resposta
          </label>
          <textarea
            id="resposta"
            value={corpo}
            onChange={(e) => setCorpo(e.target.value)}
            placeholder="Escreva o que você sabe. Citar o artigo ou a questão ajuda quem vier depois."
            rows={5}
            maxLength={8000}
            className="w-full resize-none rounded-[12px] border border-line bg-surface px-4 py-3 text-[0.96rem] leading-relaxed text-ink outline-none focus:border-brand-400"
          />
          <button
            type="submit"
            disabled={enviando || corpo.trim().length < 2}
            className="self-start rounded-full bg-brand-600 px-6 py-2.5 text-[0.92rem] font-semibold text-white transition-colors hover:bg-brand-700 disabled:bg-brand-200"
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
      className="self-start rounded-full border border-line px-3.5 py-1.5 text-[0.8rem] font-semibold text-muted transition-colors hover:border-vinho-200 hover:text-vinho-600"
    >
      {rotulo}
    </button>
  );
}
