"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseNavegador } from "@/lib/supabase/browser";
import { tempoRelativo } from "@/lib/format";
import { Iniciais } from "./iniciais";
import { navegar } from "@/components/barra-de-navegacao";

export type TopicoNaLista = {
  id: string;
  titulo: string;
  corpo: string;
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
 * A lista do fórum.
 *
 * O que a tela destaca é **o que ninguém respondeu ainda**, e não a contagem
 * de respostas. Fórum morre de pergunta sem resposta, não de falta de
 * assunto: mostrar "0 respostas" como número, ao lado de "12 respostas",
 * esconde exatamente a linha que precisa de alguém. Aqui isso vira estado,
 * com filtro próprio e contagem no topo.
 *
 * O filtro de linguagem roda no banco, dentro de `criar_topico` — não aqui.
 * Validação de navegador é contornada por quem abre o console, que é
 * justamente quem ela existiria para conter. A tela traduz a recusa.
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
  const [filtro, setFiltro] = useState<string>("todos");

  const semResposta = topicos.filter((t) => t.respostas === 0).length;

  // Só as disciplinas que já têm tópico viram filtro: uma fileira de dezoito
  // chips, quinze deles vazios, é ruído com cara de navegação.
  const comTopico = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const t of topicos) {
      if (t.disciplina) {
        contagem.set(t.disciplina, (contagem.get(t.disciplina) ?? 0) + 1);
      }
    }
    return [...contagem.entries()].sort((a, b) => b[1] - a[1]);
  }, [topicos]);

  const visiveis = useMemo(() => {
    if (filtro === "todos") return topicos;
    if (filtro === "sem-resposta") return topicos.filter((t) => t.respostas === 0);
    return topicos.filter((t) => t.disciplina === filtro);
  }, [topicos, filtro]);

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
    navegar();
    router.push(`/app/forum/${data}`);
  }

  return (
    <div className="painel-conteudo flex max-w-[1000px] flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex max-w-[52ch] flex-col gap-2">
          <h1 className="text-[clamp(1.75rem,3vw,2.15rem)] leading-[1.08] font-extrabold tracking-[-0.035em] text-ink">
            Fórum
          </h1>
          <p className="text-body">
            Quem está estudando para o mesmo exame, no mesmo mês. Dúvida de
            matéria, questão que não fechou, o que funcionou no seu estudo.
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
        <p
          role="alert"
          className="rounded-[12px] border border-vinho-200 bg-vinho-50 px-4 py-3 text-[0.9rem] text-vinho-700"
        >
          {erro}
        </p>
      )}

      {novo && (
        <form onSubmit={criar} className="superficie flex flex-col gap-3 p-6">
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="A pergunta, em uma linha"
            maxLength={140}
            autoFocus
            className="w-full rounded-[12px] border border-line bg-surface px-4 py-3 text-[1.02rem] font-semibold text-ink outline-none placeholder:font-normal focus:border-brand-400"
          />
          <textarea
            value={corpo}
            onChange={(e) => setCorpo(e.target.value)}
            placeholder="Escreva com detalhe. Se for dúvida de questão, diga qual exame e qual número — quem for responder vai querer olhar junto."
            rows={7}
            maxLength={8000}
            className="w-full resize-none rounded-[12px] border border-line bg-surface px-4 py-3 text-[0.96rem] leading-relaxed text-ink outline-none focus:border-brand-400"
          />
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={disciplina}
              onChange={(e) => setDisciplina(e.target.value)}
              className="rounded-[12px] border border-line bg-surface px-3 py-2.5 text-[0.92rem] text-ink"
            >
              <option value="">Sem disciplina</option>
              {disciplinas.map((d) => (
                <option key={d.slug} value={d.slug}>
                  {d.nome}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={
                enviando || titulo.trim().length < 5 || corpo.trim().length < 10
              }
              className="rounded-full bg-brand-600 px-6 py-2.5 text-[0.94rem] font-semibold text-white transition-colors hover:bg-brand-700 disabled:bg-brand-200"
            >
              {enviando ? "Publicando…" : "Publicar"}
            </button>
          </div>
        </form>
      )}

      {topicos.length > 0 && (
        <nav
          aria-label="Filtrar tópicos"
          className="rolagem-fina flex gap-2 overflow-x-auto pb-1"
        >
          <Chip
            ativo={filtro === "todos"}
            onClick={() => setFiltro("todos")}
            rotulo="Todos"
            contagem={topicos.length}
          />
          {semResposta > 0 && (
            <Chip
              ativo={filtro === "sem-resposta"}
              onClick={() => setFiltro("sem-resposta")}
              rotulo="Sem resposta"
              contagem={semResposta}
              destaque
            />
          )}
          {comTopico.map(([nome, quantos]) => (
            <Chip
              key={nome}
              ativo={filtro === nome}
              onClick={() => setFiltro(nome)}
              rotulo={nome}
              contagem={quantos}
            />
          ))}
        </nav>
      )}

      {visiveis.length === 0 ? (
        <div className="flex flex-col items-start gap-4 rounded-2xl border border-dashed border-hairline p-10">
          <p className="max-w-[46ch] text-[1rem] text-body">
            {topicos.length === 0
              ? "Ninguém escreveu ainda. A primeira pergunta costuma ser a que mais gente também tinha."
              : "Nenhum tópico com esse filtro."}
          </p>
          {topicos.length === 0 && (
            <button
              type="button"
              onClick={() => setNovo(true)}
              className="rounded-full bg-brand-600 px-6 py-2.5 text-[0.94rem] font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Abrir o primeiro tópico
            </button>
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {visiveis.map((t) => (
            <li key={t.id}>
              <Link
                href={`/app/forum/${t.id}`}
                className="group flex gap-4 rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-brand-200 hover:bg-paper"
              >
                <Iniciais nome={t.autor_nome} />

                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="flex flex-wrap items-center gap-2">
                    {t.fixado && (
                      <span className="rounded-full bg-ouro-100 px-2 py-0.5 text-[0.7rem] font-bold tracking-wide text-ouro-700 uppercase">
                        fixado
                      </span>
                    )}
                    <span className="text-[1.02rem] leading-snug font-semibold text-ink group-hover:text-brand-700">
                      {t.removido ? "[removido pela moderação]" : t.titulo}
                    </span>
                    {t.trancado && (
                      <span className="rounded-full bg-sunk px-2 py-0.5 text-[0.7rem] font-semibold text-muted">
                        trancado
                      </span>
                    )}
                  </span>

                  {/* Duas linhas do corpo: lista só de títulos é lista que
                      ninguém abre, porque título de dúvida raramente diz a
                      dúvida. */}
                  {!t.removido && (
                    <span className="line-clamp-2 text-[0.9rem] leading-relaxed text-muted">
                      {t.corpo}
                    </span>
                  )}

                  <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.79rem] text-muted">
                    <span className="font-medium text-body">{t.autor_nome}</span>
                    <span aria-hidden="true">·</span>
                    <span>{tempoRelativo(t.atualizado_em)}</span>
                    {t.disciplina && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{t.disciplina}</span>
                      </>
                    )}
                  </span>
                </span>

                {/* Estado, não contagem: "sem resposta" é o que pede alguém. */}
                {/* Alinhado ao topo, na altura do título: no meio do cartão o
                    número flutuava ao lado do resumo e disputava a leitura
                    com ele. */}
                <span className="hidden shrink-0 flex-col items-end gap-0.5 pt-0.5 sm:flex">
                  {t.respostas === 0 ? (
                    <span className="rounded-full bg-ouro-50 px-3 py-1 text-[0.76rem] font-semibold text-ouro-700">
                      sem resposta
                    </span>
                  ) : (
                    <>
                      <span className="text-[1.15rem] leading-none font-bold text-brand-600 tabular-nums">
                        {t.respostas}
                      </span>
                      <span className="text-[0.74rem] text-muted">
                        {t.respostas === 1 ? "resposta" : "respostas"}
                      </span>
                    </>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Chip({
  ativo,
  onClick,
  rotulo,
  contagem,
  destaque = false,
}: {
  ativo: boolean;
  onClick: () => void;
  rotulo: string;
  contagem: number;
  destaque?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-[0.86rem] font-medium whitespace-nowrap transition-colors ${
        ativo
          ? "border-brand-300 bg-brand-50 text-brand-700"
          : destaque
            ? "border-ouro-200 bg-ouro-50 text-ouro-700 hover:border-ouro-400"
            : "border-line text-body hover:border-brand-200 hover:text-brand-700"
      }`}
    >
      {rotulo}
      <span className="text-[0.76rem] text-muted tabular-nums">{contagem}</span>
    </button>
  );
}

/**
 * A recusa do banco em português.
 *
 * Dizer **qual** palavra travou é deliberado: "revise a linguagem" sem dizer
 * o quê faz a pessoa tentar de novo às cegas e desistir.
 */
export function mensagemDeErro(bruto: string) {
  const impropria = /linguagem imprópria: (.+)$/.exec(bruto);
  if (impropria) {
    return `A palavra "${impropria[1]}" não passa no fórum. Reescreva e publique de novo.`;
  }
  if (/tópico indisponível/.test(bruto)) {
    return "Este tópico está trancado ou foi removido.";
  }
  if (/violates check constraint/.test(bruto)) {
    return "Texto curto ou longo demais.";
  }
  return "Não consegui publicar agora.";
}
