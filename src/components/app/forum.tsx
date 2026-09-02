"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseNavegador } from "@/lib/supabase/browser";
import { formatarData } from "@/lib/format";

export type TopicoNaLista = {
  id: string;
  titulo: string;
  autor_nome: string;
  disciplina: string | null;
  respostas: number;
  fixado: boolean;
  trancado: boolean;
  removido: boolean;
  criado_em: string;
  atualizado_em: string;
};

export type DisciplinaOpcao = { slug: string; nome: string };

/**
 * Lista do fórum e abertura de tópico.
 *
 * O filtro de linguagem roda no banco, dentro de `criar_topico` — não aqui. A
 * validação no navegador seria contornada por qualquer pessoa que abrisse o
 * console, e é justamente quem faria isso que o filtro existe para conter. O
 * que a tela faz é traduzir a recusa em frase legível.
 */
export function Forum({
  topicos,
  disciplinas,
}: {
  topicos: TopicoNaLista[];
  disciplinas: DisciplinaOpcao[];
}) {
  const router = useRouter();
  const [novo, setNovo] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [corpo, setCorpo] = useState("");
  const [disciplina, setDisciplina] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function criar(evento: React.FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setErro(null);

    const { data, error } = await supabaseNavegador().rpc("criar_topico", {
      p_titulo: titulo,
      p_corpo: corpo,
      p_disciplina: disciplina || null,
    });

    setEnviando(false);
    if (error) {
      setErro(mensagemDeErro(error.message));
      return;
    }
    setTitulo("");
    setCorpo("");
    setNovo(false);
    router.push(`/app/forum/${data}`);
  }

  return (
    <div className="painel-conteudo flex max-w-[1000px] flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex max-w-[56ch] flex-col gap-2">
          <h1 className="text-[clamp(1.75rem,3vw,2.15rem)] leading-[1.08] font-extrabold tracking-[-0.035em] text-ink">
            Fórum
          </h1>
          <p className="text-body">
            Aberto a qualquer conta, com plano ou sem. Dúvida de matéria,
            experiência de prova, o que funcionou no seu estudo — o que for
            útil para quem também está fazendo o exame.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setNovo((n) => !n)}
          className="rounded-full bg-brand-600 px-5 py-2.5 text-[0.94rem] font-semibold text-white transition-colors hover:bg-brand-700"
        >
          {novo ? "Cancelar" : "Novo tópico"}
        </button>
      </header>

      {erro && (
        <p className="rounded-[12px] border border-vinho-200 bg-vinho-50 px-4 py-3 text-[0.9rem] text-vinho-700">
          {erro}
        </p>
      )}

      {novo && (
        <form onSubmit={criar} className="superficie flex flex-col gap-3 p-6">
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Título — a pergunta, em uma linha"
            maxLength={140}
            className="w-full rounded-[12px] border border-line bg-surface px-4 py-3 text-[0.96rem] text-ink outline-none focus:border-brand-400"
          />
          <select
            value={disciplina}
            onChange={(e) => setDisciplina(e.target.value)}
            className="self-start rounded-[12px] border border-line bg-surface px-3 py-2.5 text-[0.92rem] text-ink"
          >
            <option value="">Sem disciplina</option>
            {disciplinas.map((d) => (
              <option key={d.slug} value={d.slug}>
                {d.nome}
              </option>
            ))}
          </select>
          <textarea
            value={corpo}
            onChange={(e) => setCorpo(e.target.value)}
            placeholder="Escreva com detalhe. Se for dúvida de questão, diga qual exame e qual número."
            rows={7}
            maxLength={8000}
            className="w-full resize-none rounded-[12px] border border-line bg-surface px-4 py-3 text-[0.96rem] leading-relaxed text-ink outline-none focus:border-brand-400"
          />
          <button
            type="submit"
            disabled={enviando || titulo.trim().length < 5 || corpo.trim().length < 10}
            className="self-start rounded-full bg-brand-600 px-6 py-2.5 text-[0.94rem] font-semibold text-white transition-colors hover:bg-brand-700 disabled:bg-brand-200"
          >
            {enviando ? "Publicando…" : "Publicar"}
          </button>
        </form>
      )}

      {topicos.length === 0 ? (
        <p className="rounded-2xl bg-paper p-8 text-body">
          Nenhum tópico ainda. O primeiro é seu.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {topicos.map((t) => (
            <li key={t.id}>
              <Link
                href={`/app/forum/${t.id}`}
                className="group flex flex-wrap items-baseline gap-x-4 gap-y-1 p-5 transition-colors hover:bg-paper"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    {t.fixado && (
                      <span className="rounded-full bg-ouro-100 px-2 py-0.5 text-[0.72rem] font-semibold text-ouro-700">
                        fixado
                      </span>
                    )}
                    <span className="text-[1rem] font-semibold text-ink group-hover:text-brand-700">
                      {t.removido ? "[removido pela moderação]" : t.titulo}
                    </span>
                    {t.trancado && (
                      <span className="rounded-full bg-sunk px-2 py-0.5 text-[0.72rem] font-semibold text-muted">
                        trancado
                      </span>
                    )}
                  </span>
                  <span className="text-[0.82rem] text-muted">
                    {t.autor_nome} · {formatarData(t.criado_em.slice(0, 10))}
                    {t.disciplina ? ` · ${t.disciplina}` : ""}
                  </span>
                </span>
                <span className="text-[0.84rem] text-muted tabular-nums">
                  {t.respostas}{" "}
                  {t.respostas === 1 ? "resposta" : "respostas"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * A recusa do banco em português.
 *
 * `linguagem imprópria: x` é o formato que a função levanta. Dizer qual
 * palavra foi é deliberado: "revise a linguagem" sem dizer o quê faz a pessoa
 * tentar de novo às cegas e desistir.
 */
export function mensagemDeErro(bruto: string) {
  const impropria = /linguagem imprópria: (.+)$/.exec(bruto);
  if (impropria) {
    return `A mensagem tem linguagem que não passa no fórum ("${impropria[1]}"). Reescreva e tente de novo.`;
  }
  if (/tópico indisponível/.test(bruto)) {
    return "Este tópico está trancado ou foi removido.";
  }
  if (/violates check constraint/.test(bruto)) {
    return "Texto curto ou longo demais.";
  }
  return "Não consegui publicar agora.";
}
