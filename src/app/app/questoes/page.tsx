import type { Metadata } from "next";
import Link from "next/link";
import {
  Resolvedor,
  type QuestaoDaFila,
} from "@/components/app/resolvedor";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { getDisciplinas, getExames } from "@/lib/content/queries";

export const metadata: Metadata = {
  title: "Questões",
  robots: { index: false, follow: false },
};

const MODOS = [
  {
    chave: "novas",
    rotulo: "Novas",
    texto: "Questões que você ainda não respondeu, do exame mais recente para trás.",
  },
  {
    chave: "revisao",
    rotulo: "Revisão de hoje",
    texto:
      "O que a repetição espaçada marcou para hoje. Errar aproxima a próxima revisão; acertar a afasta.",
  },
  {
    chave: "erros",
    rotulo: "Caderno de erros",
    texto:
      "Questões cuja última tentativa foi errada. Sai da lista sozinha quando você acerta.",
  },
  {
    chave: "todas",
    rotulo: "Todas",
    texto: "O acervo inteiro do filtro escolhido, respondidas ou não.",
  },
] as const;

type Modo = (typeof MODOS)[number]["chave"];

type LinhaDaFila = {
  id: string;
  numero: number;
  slug: string;
  enunciado: string;
  alternativas: Record<string, string>;
  exame_edicao: number;
  exame_slug: string;
  exame_data: string;
  disciplina_nome: string | null;
  ja_respondida: boolean;
  errou_antes: boolean;
  revisao_em: string | null;
};

export default async function QuestoesPage({
  searchParams,
}: {
  searchParams: Promise<{ modo?: string; exame?: string; disciplina?: string }>;
}) {
  const {
    modo: modoBruto,
    exame: exameBruto,
    disciplina: disciplinaBruta,
  } = await searchParams;
  const modo: Modo =
    (MODOS.find((m) => m.chave === modoBruto)?.chave as Modo) ?? "novas";
  const exame = exameBruto || null;
  const disciplina = disciplinaBruta || null;

  const supabase = await supabaseServidor();

  // Uma rodada. A contagem e a fila não dependem da checagem de plano — sem
  // plano, a RLS as devolve vazias e elas são descartadas abaixo. Esperar a
  // checagem para só então perguntar o resto custava duas viagens a mais,
  // justamente na tela que mais se abre.
  const [assinaturaRes, exames, disciplinas, desempenhoRes, semDisciplinaRes, filaRes] =
    await Promise.all([
      supabase
        .from("assinaturas")
        .select("plano")
        .eq("status", "ativa")
        .limit(1),
      getExames(),
      getDisciplinas(),
      supabase.rpc("meu_desempenho"),
      // Quantas questões ainda não têm disciplina. Contado, não estimado: o
      // número aparece na tela como ressalva, e ressalva com número
      // inventado é pior do que ressalva nenhuma.
      supabase
        .from("questoes")
        .select("*", { count: "exact", head: true })
        .is("disciplina_id", null),
      supabase.rpc("fila_de_questoes", {
        p_modo: modo,
        p_exame: exame,
        p_disciplina: disciplina,
        p_limite: 30,
      }),
    ]);

  const temPlano = Boolean(assinaturaRes.data?.[0]);
  const numeros = (Array.isArray(desempenhoRes.data)
    ? desempenhoRes.data[0]
    : desempenhoRes.data) as
    | { erros: number; revisao_hoje: number }
    | undefined;

  /* Sem plano a fila voltaria vazia de qualquer forma — a RLS de `questoes`
     exige assinatura ativa. Mas "nenhuma questão encontrada" seria uma
     mentira sobre o motivo, então a checagem acontece aqui e a tela diz o
     que de fato está acontecendo. */
  if (!temPlano) {
    return (
      <div className="painel-conteudo flex max-w-[720px] flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-[clamp(1.6rem,2.6vw,1.95rem)] leading-[1.1] font-extrabold tracking-[-0.035em] text-ink">
            Questões
          </h1>
          <p className="text-body">
            A resolução de questões faz parte do plano. Toda a legislação
            comentada, os exames e as estatísticas do site continuam abertos,
            com ou sem assinatura.
          </p>
        </header>
        <Link
          href="/app/assinar"
          className="self-start rounded-full bg-brand-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-brand-700"
        >
          Ver planos
        </Link>
      </div>
    );
  }

  const semDisciplina = semDisciplinaRes.count ?? 0;
  const filaBruta = filaRes.data;

  const fila: QuestaoDaFila[] = ((filaBruta ?? []) as LinhaDaFila[]).map(
    (q) => ({
      id: q.id,
      numero: q.numero,
      slug: q.slug,
      enunciado: q.enunciado,
      alternativas: q.alternativas,
      exameEdicao: q.exame_edicao,
      exameSlug: q.exame_slug,
      disciplina: q.disciplina_nome,
      jaRespondida: q.ja_respondida,
      errouAntes: q.errou_antes,
    }),
  );

  const ingeridos = exames.filter((e) => e.questoesCarregadas > 0);
  const acervo = ingeridos.reduce((s, e) => s + e.questoesCarregadas, 0);
  const modoAtual = MODOS.find((m) => m.chave === modo)!;

  function href(
    proximoModo: Modo,
    proximoExame: string | null,
    proximaDisciplina: string | null = disciplina,
  ) {
    const parametros = new URLSearchParams();
    if (proximoModo !== "novas") parametros.set("modo", proximoModo);
    if (proximoExame) parametros.set("exame", proximoExame);
    if (proximaDisciplina) parametros.set("disciplina", proximaDisciplina);
    const busca = parametros.toString();
    return busca ? `/app/questoes?${busca}` : "/app/questoes";
  }

  return (
    /* Uma coluna só, na largura cheia do painel.
       O cartão da questão parava nos 820 do resolvedor e ficava centralizado
       sob um painel de filtros que ia até a margem — dois blocos de larguras
       diferentes, um sobre o outro, lêem como erro de montagem. Agora quem
       manda na largura é esta coluna, e os dois nascem alinhados. */
    <div className="painel-conteudo flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-[clamp(1.6rem,2.6vw,1.95rem)] leading-[1.1] font-extrabold tracking-[-0.035em] text-ink">
            Questões
          </h1>
          <p className="text-[0.96rem] text-muted">{modoAtual.texto}</p>
        </div>
      </header>

      {/* ---- Filtros ---- */}
      <section className="superficie flex flex-col gap-4 p-5">
        <div className="flex flex-wrap gap-2">
          {MODOS.map((m) => {
            const ativo = m.chave === modo;
            const contador =
              m.chave === "erros"
                ? (numeros?.erros ?? 0)
                : m.chave === "revisao"
                  ? (numeros?.revisao_hoje ?? 0)
                  : null;
            return (
              <Link
                key={m.chave}
                href={href(m.chave, exame)}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-[0.9rem] font-semibold transition-colors ${
                  ativo
                    ? "bg-brand-700 text-white"
                    : "border border-hairline text-body hover:border-brand-300 hover:text-brand-700"
                }`}
              >
                {m.rotulo}
                {contador !== null && contador > 0 && (
                  <span
                    className={`rounded-full px-1.5 text-[0.76rem] tabular-nums ${
                      ativo ? "bg-white/20" : "bg-sunk text-muted"
                    }`}
                  >
                    {contador}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <span className="rotulo mr-1">Exame</span>
          <Link
            href={href(modo, null)}
            className={`rounded-full px-3 py-1.5 text-[0.85rem] font-semibold transition-colors ${
              !exame
                ? "bg-brand-50 text-brand-700"
                : "text-muted hover:text-ink"
            }`}
          >
            todos
          </Link>
          {ingeridos.map((e) => (
            <Link
              key={e.slug}
              href={href(modo, e.slug)}
              className={`rounded-full px-3 py-1.5 text-[0.85rem] font-semibold tabular-nums transition-colors ${
                exame === e.slug
                  ? "bg-brand-50 text-brand-700"
                  : "text-muted hover:text-ink"
              }`}
            >
              {e.edicao}º
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <span className="rotulo mr-1">Disciplina</span>
          <Link
            href={href(modo, exame, null)}
            className={`rounded-full px-3 py-1.5 text-[0.85rem] font-semibold transition-colors ${
              !disciplina
                ? "bg-brand-50 text-brand-700"
                : "text-muted hover:text-ink"
            }`}
          >
            todas
          </Link>
          {disciplinas.map((d) => (
            <Link
              key={d.slug}
              href={href(modo, exame, d.slug)}
              className={`rounded-full px-3 py-1.5 text-[0.85rem] font-semibold transition-colors ${
                disciplina === d.slug
                  ? "bg-brand-50 text-brand-700"
                  : "text-muted hover:text-ink"
              }`}
            >
              {d.nome}
            </Link>
          ))}
        </div>

        <p className="text-[0.8rem] text-muted">
          {semDisciplina.toLocaleString("pt-BR")} das{" "}
          {acervo.toLocaleString("pt-BR")} questões ainda não têm disciplina
          atribuída. Filtrar por exame é exato; por disciplina, aproximado.
        </p>
      </section>

      {fila.length > 0 ? (
        <Resolvedor key={`${modo}-${exame ?? "todos"}`} fila={fila} />
      ) : (
        <div className="superficie mx-auto flex w-full max-w-[620px] flex-col gap-3 p-8 text-center">
          <p className="text-[1.15rem] font-bold text-ink">
            {modo === "revisao"
              ? "Nada para revisar hoje"
              : modo === "erros"
                ? "Caderno de erros vazio"
                : "Nenhuma questão neste filtro"}
          </p>
          <p className="mx-auto max-w-[48ch] text-[0.95rem] text-body">
            {modo === "revisao"
              ? "A fila de revisão se enche sozinha conforme você responde: cada questão volta na data que a sua última resposta determinou."
              : modo === "erros"
                ? "Uma questão entra aqui quando a última tentativa é errada, e sai quando você acerta."
                : "Troque o exame ou escolha outro filtro para montar a fila."}
          </p>
          <Link
            href={href("novas", null)}
            className="mx-auto mt-1 rounded-full bg-brand-600 px-5 py-2.5 text-[0.92rem] font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Responder questões novas
          </Link>
        </div>
      )}
    </div>
  );
}
