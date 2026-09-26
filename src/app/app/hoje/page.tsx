import type { Metadata } from "next";
import Link from "next/link";
import { AcoesSessaoHoje } from "@/components/app/acoes-sessao-hoje";
import { Resolvedor, type QuestaoDaFila } from "@/components/app/resolvedor";
import { dataUtc, hojeEmBrasilia } from "@/lib/calendario";
import {
  diasAte,
  getArtigosDaDisciplina,
  getDisciplinas,
  getLeis,
  getProximoExame,
} from "@/lib/content/queries";
import type { ContextoSalvoDoPlano, Plano } from "@/lib/ia/plano";
import type { ItemRoadmap } from "@/lib/roadmap";
import { supabaseServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = {
  title: "O que estudar hoje",
  robots: { index: false, follow: false },
};

type LinhaQuestao = {
  id: string;
  numero: number;
  slug: string;
  enunciado: string;
  alternativas: Record<string, string>;
  exame_edicao: number;
  exame_slug: string;
  disciplina_nome: string | null;
  ja_respondida: boolean;
  errou_antes: boolean;
};

const COLUNAS_ETAPAS: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-2 xl:grid-cols-4",
};

function paraQuestao(linha: LinhaQuestao): QuestaoDaFila {
  return {
    id: linha.id,
    numero: linha.numero,
    slug: linha.slug,
    enunciado: linha.enunciado,
    alternativas: linha.alternativas,
    exameEdicao: linha.exame_edicao,
    exameSlug: linha.exame_slug,
    disciplina: linha.disciplina_nome,
    jaRespondida: linha.ja_respondida,
    errouAntes: linha.errou_antes,
  };
}

function limitarMinutos(valor: string | undefined) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return 40;
  return Math.min(180, Math.max(15, Math.round(numero)));
}

function distribuirTempo(
  total: number,
  opcoes: {
    flashcards: boolean;
    revisao: boolean;
    leitura: boolean;
    questoes: boolean;
    execucao: boolean;
  },
  fase: "normal" | "reta_final" | "ultima_semana" = "normal",
) {
  const quantidade =
    Number(opcoes.revisao) +
    Number(opcoes.leitura) +
    Number(opcoes.questoes) +
    Number(opcoes.execucao);
  if (quantidade === 0) {
    return {
      flashcards: opcoes.flashcards ? total : 0,
      revisao: 0,
      leitura: 0,
      questoes: 0,
      execucao: opcoes.flashcards ? 0 : total,
    };
  }
  const flashcards = opcoes.flashcards
    ? Math.min(10, Math.max(5, Math.round(total * 0.15)))
    : 0;
  const disponivel = total - flashcards;
  if (quantidade === 1) {
    return {
      flashcards,
      revisao: opcoes.revisao ? disponivel : 0,
      leitura: opcoes.leitura ? disponivel : 0,
      questoes: opcoes.questoes ? disponivel : 0,
      execucao: opcoes.execucao ? disponivel : 0,
    };
  }

  const revisao = opcoes.revisao
    ? Math.min(
        fase === "normal" ? 10 : 20,
        Math.max(
          5,
          Math.round(
            disponivel *
              (fase === "ultima_semana" ? 0.3 : fase === "reta_final" ? 0.2 : 0.125),
          ),
        ),
      )
    : 0;
  const restante = disponivel - revisao;
  if (opcoes.execucao) {
    return { flashcards, revisao, leitura: 0, questoes: 0, execucao: restante };
  }
  let leitura = 0;
  let questoes = 0;
  if (opcoes.leitura && opcoes.questoes) {
    const fatiaDeLeitura =
      fase === "ultima_semana" ? 0.18 : fase === "reta_final" ? 0.3 : opcoes.revisao ? 0.43 : 0.4;
    leitura = Math.max(5, Math.round(restante * fatiaDeLeitura));
    questoes = restante - leitura;
    if (questoes < 5) {
      questoes = 5;
      leitura = restante - questoes;
    }
  } else if (opcoes.leitura) {
    leitura = restante;
  } else {
    questoes = restante;
  }
  return { flashcards, revisao, leitura, questoes, execucao: 0 };
}

function quantidadeDeQuestoes(minutos: number, disponiveis: number) {
  if (minutos <= 0 || disponiveis <= 0) return 0;
  return Math.min(disponiveis, Math.max(1, Math.floor(minutos / 5)));
}

export default async function HojePage({
  searchParams,
}: {
  searchParams: Promise<{ minutos?: string }>;
}) {
  const { minutos: minutosBrutos } = await searchParams;
  const minutos = limitarMinutos(minutosBrutos);
  const hoje = hojeEmBrasilia();
  const supabase = await supabaseServidor();

  const [
    registroRes,
    disciplinas,
    leis,
    assinaturaRes,
    desempenhoRes,
    flashcardsRes,
    proximo,
    ultimoSimuladoRes,
  ] = await Promise.all([
    supabase.from("planos_estudo").select("plano, versao_roadmap, contexto").maybeSingle(),
    getDisciplinas(),
    getLeis(),
    supabase.from("assinaturas").select("plano").eq("status", "ativa").limit(1),
    supabase.rpc("meu_desempenho"),
    supabase
      .from("flashcards")
      .select("id", { count: "exact", head: true })
      .eq("suspenso", false)
      .lte("proxima_revisao", hoje),
    getProximoExame(),
    supabase
      .from("simulados")
      .select("id, finalizado_em")
      .not("finalizado_em", "is", null)
      .order("finalizado_em", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const ultimoSimulado = ultimoSimuladoRes.data;
  const diasDesdeSimulado = ultimoSimulado?.finalizado_em
    ? Math.round(
        (dataUtc(hoje).getTime() -
          dataUtc(hojeEmBrasilia(new Date(ultimoSimulado.finalizado_em))).getTime()) /
          86_400_000,
      )
    : null;
  const recuperacaoAtiva =
    diasDesdeSimulado !== null && diasDesdeSimulado >= 0 && diasDesdeSimulado < 7;
  const registro = registroRes.data;
  // O relatório do último simulado e o roteiro da semana dependem só da
  // primeira rodada, não um do outro: juntos, são uma viagem ao banco em vez
  // de duas.
  const [{ data: relatorioRecuperacao }, { data: linhasRoadmap }] =
    await Promise.all([
      recuperacaoAtiva
        ? supabase.rpc("relatorio_do_simulado", {
            p_simulado_id: ultimoSimulado!.id,
          })
        : Promise.resolve({ data: null }),
      registro?.versao_roadmap
        ? supabase
            .from("roadmap_itens")
            .select("id, semana, ordem, disciplina, objetivo, horas, estado, anotacao")
            .eq("versao", registro.versao_roadmap)
            .order("semana")
            .order("ordem")
        : Promise.resolve({ data: [] }),
    ]);
  const errosPorDisciplina = new Map<string, number>();
  for (const linha of (relatorioRecuperacao ?? []) as {
    disciplina_nome: string | null;
    acertou: boolean;
  }[]) {
    if (linha.acertou || !linha.disciplina_nome) continue;
    errosPorDisciplina.set(
      linha.disciplina_nome,
      (errosPorDisciplina.get(linha.disciplina_nome) ?? 0) + 1,
    );
  }
  const materiasDaRecuperacao = [...errosPorDisciplina.entries()]
    .map(([nome, erros]) => ({
      nome,
      erros,
      slug: disciplinas.find((item) => item.nome === nome)?.slug ?? null,
    }))
    .filter((item) => item.slug)
    .sort((a, b) => b.erros - a.erros)
    .slice(0, 3);
  const focoDaRecuperacao =
    recuperacaoAtiva && diasDesdeSimulado! < 6
      ? materiasDaRecuperacao[
          Math.min(Math.floor(diasDesdeSimulado! / 2), materiasDaRecuperacao.length - 1)
        ]
      : null;
  const plano = (registro?.plano as Plano | null) ?? null;
  const contexto = (registro?.contexto as ContextoSalvoDoPlano | null) ?? null;
  const itens = (linhasRoadmap ?? []) as ItemRoadmap[];
  const ativo =
    itens.find((item) => item.estado === "em_andamento") ??
    itens.find((item) => item.estado !== "concluido") ??
    null;
  const disciplina = ativo
    ? disciplinas.find((item) => item.nome === ativo.disciplina) ?? null
    : null;

  const podeSugerirQuestoesGerais = !ativo && contexto?.modo !== "livre";
  const [artigos, revisoesRes, novasRes] = await Promise.all([
    disciplina ? getArtigosDaDisciplina(disciplina.slug, 3) : Promise.resolve([]),
    supabase.rpc("fila_de_questoes", {
      p_modo: "revisao",
      p_exame: null,
      p_disciplina: null,
      p_limite: 12,
    }),
    disciplina || podeSugerirQuestoesGerais
      ? supabase.rpc("fila_de_questoes", {
          p_modo: "novas",
          p_exame: null,
          p_disciplina: disciplina?.slug ?? null,
          p_limite: 12,
        })
      : Promise.resolve({ data: [] as LinhaQuestao[] }),
  ]);
  const revisoesDisponiveis = (revisoesRes.data ?? []) as LinhaQuestao[];
  const novasDisponiveis = (novasRes.data ?? []) as LinhaQuestao[];
  const exigeMaterialExterno = Boolean(
    ativo && !disciplina && artigos.length === 0 && novasDisponiveis.length === 0,
  );
  const diasRestantes = diasAte(proximo.data);
  const planoOab = contexto?.modo !== "livre";
  const fase = !planoOab
    ? "normal"
    : diasRestantes <= 7
      ? "ultima_semana"
      : diasRestantes <= 30
        ? "reta_final"
        : "normal";
  const flashcardsVencidos = flashcardsRes.count ?? 0;
  const distribuicao = distribuirTempo(minutos, {
    flashcards: flashcardsVencidos > 0,
    revisao: revisoesDisponiveis.length > 0,
    leitura: artigos.length > 0,
    questoes: novasDisponiveis.length > 0,
    execucao: exigeMaterialExterno,
  }, fase);
  const quantidadeRevisoes = quantidadeDeQuestoes(
    distribuicao.revisao,
    revisoesDisponiveis.length,
  );
  const quantidadeNovas = quantidadeDeQuestoes(
    distribuicao.questoes,
    novasDisponiveis.length,
  );
  const questoes = [
    ...revisoesDisponiveis.slice(0, quantidadeRevisoes),
    ...novasDisponiveis.slice(0, quantidadeNovas),
  ].map(paraQuestao);
  const desempenho = (Array.isArray(desempenhoRes.data)
    ? desempenhoRes.data[0]
    : desempenhoRes.data) as { revisao_hoje?: number } | undefined;
  const revisoesVencidas = desempenho?.revisao_hoje ?? 0;
  const temAssinatura = Boolean(assinaturaRes.data?.[0]);
  const siglas = new Map(leis.map((lei) => [lei.slug, lei.sigla]));
  const dataHoje = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  const etapas = [
    distribuicao.flashcards > 0
      ? {
          titulo: "Flashcards vencidos",
          minutos: distribuicao.flashcards,
          detalhe: `${flashcardsVencidos} ${flashcardsVencidos === 1 ? "cartão aguardando" : "cartões aguardando"} na revisão espaçada`,
          href: "/app/flashcards?modo=revisao",
        }
      : null,
    distribuicao.revisao > 0
      ? {
          titulo: "Revisão vencida",
          minutos: distribuicao.revisao,
          detalhe: `${quantidadeRevisoes} ${quantidadeRevisoes === 1 ? "questão agendada" : "questões agendadas"}`,
          href: "#questoes-de-hoje",
        }
      : null,
    distribuicao.leitura > 0
      ? {
          titulo: "Leitura orientada",
          minutos: distribuicao.leitura,
          detalhe: `${artigos.length} ${artigos.length === 1 ? "dispositivo prioritário" : "dispositivos prioritários"}`,
          href: "#leitura-de-hoje",
        }
      : null,
    distribuicao.questoes > 0
      ? {
          titulo: "Prática dirigida",
          minutos: distribuicao.questoes,
          detalhe: `${quantidadeNovas} ${quantidadeNovas === 1 ? "questão nova" : "questões novas"} de ${ativo?.disciplina ?? "Direito"}`,
          href: "#questoes-de-hoje",
        }
      : null,
    distribuicao.execucao > 0
      ? {
          titulo: "Execução do bloco",
          minutos: distribuicao.execucao,
          detalhe: ativo?.objetivo ?? "Use este tempo para avançar no seu objetivo principal.",
          href: ativo ? `/app/roadmap?item=${ativo.id}` : "/app/plano",
        }
      : null,
  ].filter((etapa): etapa is NonNullable<typeof etapa> => etapa !== null);

  return (
    <div className="painel-conteudo flex max-w-[1220px] flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="rotulo">Execução diária</span>
          <h1 className="mt-1 text-[clamp(1.8rem,3vw,2.45rem)] leading-none font-extrabold tracking-[-0.045em] text-ink">
            O que estudar hoje
          </h1>
          <p className="mt-2 capitalize text-[0.94rem] text-muted">{dataHoje}</p>
        </div>
        <form action="/app/hoje" method="get" className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-[0.76rem] font-semibold text-muted">
            Tempo disponível
            <span className="flex items-center rounded-full border border-hairline bg-surface px-3">
              <input
                name="minutos"
                type="number"
                min={15}
                max={180}
                defaultValue={minutos}
                className="w-14 bg-transparent py-2 text-right text-[0.9rem] font-bold text-ink outline-none"
              />
              <span className="ml-1 text-[0.8rem] text-muted">min</span>
            </span>
          </label>
          <button className="rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-[0.86rem] font-semibold text-brand-700 hover:bg-brand-100">
            Recalcular sessão
          </button>
        </form>
      </header>

      {fase !== "normal" && (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-[17px] border border-ouro-200 bg-ouro-50 px-5 py-4">
          <div>
            <span className="text-[0.7rem] font-bold tracking-[0.13em] text-ouro-700 uppercase">
              {fase === "ultima_semana" ? "Última semana" : "Reta final"} · {diasRestantes} {diasRestantes === 1 ? "dia" : "dias"}
            </span>
            <p className="mt-1 max-w-[70ch] text-[0.86rem] text-body">
              {fase === "ultima_semana"
                ? "A sessão reduz conteúdo novo e concentra o tempo em erros, revisões vencidas e prática sob decisão."
                : "A sessão reserva mais tempo para revisão e questões, sem abandonar a leitura ligada ao bloco atual."}
            </p>
          </div>
          <Link
            href="/app/simulado"
            className="shrink-0 rounded-full border border-ouro-300 bg-surface px-4 py-2 text-[0.82rem] font-semibold text-ouro-800 hover:border-ouro-500"
          >
            Abrir simulados
          </Link>
        </section>
      )}

      {recuperacaoAtiva && materiasDaRecuperacao.length > 0 && (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-[17px] border border-brand-200 bg-brand-50 px-5 py-4">
          <div>
            <span className="text-[0.7rem] font-bold tracking-[0.13em] text-brand-700 uppercase">
              Recuperação do simulado · dia {diasDesdeSimulado! + 1} de 7
            </span>
            <p className="mt-1 max-w-[70ch] text-[0.86rem] text-body">
              {focoDaRecuperacao
                ? `Hoje, volte aos erros de ${focoDaRecuperacao.nome} (${focoDaRecuperacao.erros} neste simulado). Cada prioridade ocupa dois dias; no sétimo, faça outro bloco para medir o avanço.`
                : "Hoje é o dia de repetir um bloco rápido sem consultar o gabarito e comparar o resultado com o anterior."}
              {" "}A classificação por disciplina ainda é aproximada.
            </p>
          </div>
          <Link
            href={focoDaRecuperacao
              ? `/app/questoes?modo=erros&disciplina=${focoDaRecuperacao.slug}`
              : "/app/simulado"}
            className="shrink-0 rounded-full bg-brand-700 px-4 py-2 text-[0.82rem] font-semibold text-white hover:bg-brand-800"
          >
            {focoDaRecuperacao ? "Revisar erros" : "Novo simulado"}
          </Link>
        </section>
      )}

      <section className="relative overflow-hidden rounded-[26px] bg-brand-900 p-6 text-white shadow-[0_18px_45px_rgba(8,58,49,0.16)] sm:p-8">
        <div aria-hidden="true" className="absolute -top-24 -right-16 h-64 w-64 rounded-full bg-ouro-400/15 blur-2xl" />
        <div className="relative grid gap-7 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-[72ch]">
            <span className="text-[0.74rem] font-bold tracking-[0.15em] text-ouro-200 uppercase">
              Sua prioridade agora
            </span>
            <h2 className="mt-3 text-[clamp(1.45rem,3vw,2.15rem)] leading-tight font-extrabold tracking-[-0.035em] text-white">
              {ativo?.disciplina ?? (plano ? "Roadmap concluído" : "Comece pelo seu roadmap")}
            </h2>
            <p className="mt-2 max-w-[66ch] text-[0.96rem] leading-relaxed text-white/72">
              {ativo?.objetivo ??
                (plano
                  ? "Todos os blocos foram concluídos. Use a sessão para revisar e praticar."
                  : "Monte um plano para o sistema escolher a matéria, a leitura e as questões certas para cada dia.")}
            </p>
            {ativo?.anotacao && (
              <p className="mt-4 line-clamp-3 rounded-[14px] border border-white/10 bg-white/[0.06] px-4 py-3 text-[0.84rem] text-white/70">
                <strong className="text-white">Sua anotação:</strong> {ativo.anotacao}
              </p>
            )}
          </div>
          <AcoesSessaoHoje
            itemId={ativo?.id ?? null}
            estadoInicial={ativo?.estado ?? null}
            disciplinaSlug={disciplina?.slug ?? null}
            minutos={minutos}
          />
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Resumo da sessão">
        {[
          [ativo ? `Semana ${ativo.semana}` : "—", "próximo bloco"],
          [String(flashcardsVencidos), "flashcards vencidos"],
          [String(revisoesVencidas), "revisões vencidas"],
          [String(questoes.length), "questões nesta sessão"],
          [String(artigos.length), "leituras indicadas"],
        ].map(([valor, rotulo]) => (
          <div key={rotulo} className="superficie flex items-baseline justify-between gap-3 px-5 py-4">
            <span className="text-[1.45rem] font-extrabold tracking-[-0.04em] text-brand-700 tabular-nums">{valor}</span>
            <span className="text-right text-[0.78rem] text-muted">{rotulo}</span>
          </div>
        ))}
      </section>

      <section className="superficie overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-paper px-5 py-4 sm:px-6">
          <div>
            <span className="rotulo">Agenda fechada</span>
            <h2 className="mt-1 text-[1.15rem] font-bold text-ink">{minutos} minutos, sem decidir no meio</h2>
          </div>
          <div className="flex gap-1.5">
            {[20, 40, 60, 90].map((opcao) => (
              <Link
                key={opcao}
                href={`/app/hoje?minutos=${opcao}`}
                className={`rounded-full px-3 py-1.5 text-[0.78rem] font-semibold ${opcao === minutos ? "bg-brand-700 text-white" : "bg-sunk text-muted hover:text-ink"}`}
              >
                {opcao} min
              </Link>
            ))}
          </div>
        </div>
        <ol className={`grid divide-y divide-line lg:divide-x lg:divide-y-0 ${COLUNAS_ETAPAS[etapas.length] ?? "lg:grid-cols-1"}`}>
          {etapas.map((etapa, indice) => (
            <li key={etapa.titulo} className="flex min-w-0 gap-4 p-5 sm:p-6">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[0.78rem] font-extrabold text-brand-700">{indice + 1}</span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-baseline gap-2">
                  <Link href={etapa.href} className="font-bold text-ink hover:text-brand-700">{etapa.titulo}</Link>
                  <strong className="text-[0.82rem] text-ouro-600">{etapa.minutos} min</strong>
                </span>
                <span className="mt-1 block text-[0.82rem] leading-relaxed text-muted">{etapa.detalhe}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {!plano && (
        <section className="rounded-[18px] border border-ouro-200 bg-ouro-50 p-5 sm:flex sm:items-center sm:justify-between sm:gap-5">
          <div>
            <h2 className="font-bold text-ink">Falta a peça que personaliza o seu dia</h2>
            <p className="mt-1 text-[0.88rem] text-body">Com um roadmap, a sessão passa a escolher matéria, objetivo e leitura conforme o seu plano.</p>
          </div>
          <Link href="/app/plano" className="mt-4 inline-flex shrink-0 rounded-full bg-brand-700 px-5 py-2.5 text-[0.88rem] font-semibold text-white sm:mt-0">Montar roadmap</Link>
        </section>
      )}

      {artigos.length > 0 && (
        <section id="leitura-de-hoje" className="scroll-mt-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <span className="rotulo">Leitura do bloco · {distribuicao.leitura} min</span>
              <h2 className="mt-1 text-[1.3rem] font-bold text-ink">Dispositivos para ler agora</h2>
            </div>
            <Link href={`/app/roadmap?item=${ativo?.id}`} className="text-[0.84rem] font-semibold text-brand-700 underline decoration-brand-200 underline-offset-4">Abrir bloco completo →</Link>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {artigos.map((artigo, indice) => (
              <article key={`${artigo.leiSlug}-${artigo.slug}`} className="superficie flex flex-col p-5">
                <span className="text-[0.72rem] font-bold tracking-[0.12em] text-ouro-600 uppercase">Leitura {indice + 1}</span>
                <h3 className="mt-2 text-[1rem] font-bold text-brand-700">Art. {artigo.numero} {siglas.get(artigo.leiSlug) ?? ""}</h3>
                <p className="lei-texto mt-3 line-clamp-6 text-[0.93rem]">{artigo.caput}</p>
                {artigo.comentario[0] && <p className="mt-3 line-clamp-3 text-[0.8rem] leading-relaxed text-muted">{artigo.comentario[0]}</p>}
                <Link href={`/legislacao/${artigo.leiSlug}/${artigo.slug}`} className="mt-auto pt-5 text-[0.84rem] font-semibold text-brand-700 underline decoration-brand-200 underline-offset-4">Ler na fonte →</Link>
              </article>
            ))}
          </div>
        </section>
      )}

      <section id="questoes-de-hoje" className="scroll-mt-6">
        <div className="mb-4">
          <span className="rotulo">Prática de hoje · {distribuicao.revisao + distribuicao.questoes} min</span>
          <h2 className="mt-1 text-[1.3rem] font-bold text-ink">Questões na ordem certa</h2>
          <p className="mt-1 max-w-[72ch] text-[0.88rem] text-muted">
            {quantidadeRevisoes > 0 && `${quantidadeRevisoes} de revisão primeiro. `}
            {quantidadeNovas > 0 && `${quantidadeNovas} novas de ${ativo?.disciplina ?? "Direito"} depois. `}
            O gabarito só aparece depois da resposta.
          </p>
        </div>
        {!temAssinatura ? (
          <div className="superficie flex flex-wrap items-center justify-between gap-4 p-6">
            <p className="max-w-[58ch] text-[0.92rem] text-body">A agenda e a legislação continuam visíveis, mas a resolução de questões exige um plano ativo.</p>
            <Link href="/app/assinar" className="rounded-full bg-brand-600 px-5 py-2.5 text-[0.88rem] font-semibold text-white">Ver planos</Link>
          </div>
        ) : questoes.length > 0 ? (
          <Resolvedor key={`${ativo?.id ?? "geral"}-${minutos}`} fila={questoes} />
        ) : (
          <div className="superficie p-6 text-[0.92rem] text-muted">Não há revisão vencida nem questão nova disponível para esta sessão. Avance pela leitura ou pelo objetivo do bloco.</div>
        )}
      </section>
    </div>
  );
}
