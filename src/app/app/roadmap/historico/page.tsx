import type { Metadata } from "next";
import Link from "next/link";
import { formatarData } from "@/lib/format";
import {
  ROTULOS_DA_ORIGEM,
  versaoDaLinha,
  type VersaoDoRoadmap,
} from "@/lib/historico-roadmap";
import { metaDaLinha, type MetaDoRoadmap } from "@/lib/metas-roadmap";
import type { EstadoDoRoadmap } from "@/lib/roadmap";
import { supabaseServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = {
  title: "Histórico do roadmap",
  robots: { index: false, follow: false },
};

type LinhaDoBloco = {
  id: string;
  versao: number;
  semana: number;
  ordem: number;
  disciplina: string;
  objetivo: string;
  horas: number | string;
  estado: EstadoDoRoadmap;
  anotacao: string;
};

type LinhaDaSessao = {
  roadmap_item_id: string;
  segundos_foco: number;
  questoes_respondidas: number;
  materiais_lidos: string[];
  resumo: string;
};

function numeroPedido(valor: string | string[] | undefined) {
  if (typeof valor !== "string") return null;
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
}

function horas(valor: number) {
  const arredondado = Math.round(valor * 10) / 10;
  return `${arredondado.toLocaleString("pt-BR")}h`;
}

function minutos(valor: number) {
  if (valor < 60) return `${valor}min`;
  const h = Math.floor(valor / 60);
  const min = valor % 60;
  return min ? `${h}h ${min}min` : `${h}h`;
}

function assinatura(bloco: LinhaDoBloco) {
  return `${bloco.disciplina}::${bloco.objetivo
    .replace(/ · parte \d+\/\d+$/i, "")
    .trim()}`;
}

function diferenca(atual: number, anterior: number, unidade = "") {
  const delta = atual - anterior;
  if (delta === 0) return "sem mudança";
  return `${delta > 0 ? "+" : ""}${delta}${unidade}`;
}

export default async function HistoricoDoRoadmapPage({
  searchParams,
}: {
  searchParams: Promise<{ versao?: string | string[] }>;
}) {
  const consulta = await searchParams;
  const supabase = await supabaseServidor();
  const { data: historicoBruto, error: erroHistorico } =
    await supabase.rpc("historico_do_roadmap");
  if (erroHistorico) {
    throw new Error(`Não foi possível abrir o histórico: ${erroHistorico.message}`);
  }
  const versoes = ((historicoBruto ?? []) as Record<string, unknown>[]).map(
    versaoDaLinha,
  );
  if (versoes.length === 0) {
    return (
      <div className="painel-conteudo flex max-w-[900px] flex-col gap-5">
        <span className="rotulo">Linha do tempo</span>
        <h1 className="text-[2rem] font-extrabold text-ink">Histórico do roadmap</h1>
        <section className="superficie p-7">
          <p className="text-body">Crie seu primeiro roadmap para inaugurar o histórico.</p>
          <Link href="/app/plano" className="mt-4 inline-block rounded-full bg-brand-700 px-5 py-2.5 text-[0.82rem] font-semibold text-white">
            Montar plano
          </Link>
        </section>
      </div>
    );
  }

  const pedida = numeroPedido(consulta.versao);
  const selecionada =
    versoes.find((item) => item.versao === pedida) ??
    versoes.find((item) => item.vigente) ??
    versoes[0];
  const anterior =
    versoes.find((item) => item.versao === selecionada.versaoAnterior) ??
    versoes.find((item) => item.versao < selecionada.versao) ??
    null;
  const versoesNecessarias = [selecionada.versao, anterior?.versao].filter(
    (valor): valor is number => typeof valor === "number",
  );
  const { data: blocosBrutos, error: erroBlocos } = await supabase
    .from("roadmap_itens")
    .select("id, versao, semana, ordem, disciplina, objetivo, horas, estado, anotacao")
    .in("versao", versoesNecessarias)
    .order("semana")
    .order("ordem");
  if (erroBlocos) throw new Error(`Não foi possível ler a versão: ${erroBlocos.message}`);
  const todosOsBlocos = (blocosBrutos ?? []) as LinhaDoBloco[];
  const blocos = todosOsBlocos.filter((item) => item.versao === selecionada.versao);
  const blocosAnteriores = anterior
    ? todosOsBlocos.filter((item) => item.versao === anterior.versao)
    : [];
  const ids = blocos.map((item) => item.id);
  const [sessoesRes, metasRes] = ids.length
    ? await Promise.all([
        supabase
          .from("sessoes_estudo")
          .select("roadmap_item_id, segundos_foco, questoes_respondidas, materiais_lidos, resumo")
          .in("roadmap_item_id", ids),
        supabase.rpc("metas_do_roadmap", { p_versao: selecionada.versao }),
      ])
    : [{ data: [] }, { data: [] }];
  const evidencias = new Map<
    string,
    { segundos: number; questoes: number; materiais: Set<string>; resumos: number }
  >();
  for (const linha of (sessoesRes.data ?? []) as LinhaDaSessao[]) {
    const atual = evidencias.get(linha.roadmap_item_id) ?? {
      segundos: 0,
      questoes: 0,
      materiais: new Set<string>(),
      resumos: 0,
    };
    atual.segundos += Number(linha.segundos_foco);
    atual.questoes += Number(linha.questoes_respondidas);
    for (const material of linha.materiais_lidos ?? []) atual.materiais.add(material);
    if (linha.resumo.trim()) atual.resumos += 1;
    evidencias.set(linha.roadmap_item_id, atual);
  }
  const metasPorBloco = new Map<string, MetaDoRoadmap[]>();
  for (const linha of (metasRes.data ?? []) as Record<string, unknown>[]) {
    const blocoId = String(linha.roadmap_item_id);
    metasPorBloco.set(blocoId, [
      ...(metasPorBloco.get(blocoId) ?? []),
      metaDaLinha(linha),
    ]);
  }

  const assinaturasAtuais = new Set(blocos.map(assinatura));
  const assinaturasAnteriores = new Set(blocosAnteriores.map(assinatura));
  const adicionados = blocos.filter(
    (item) => !assinaturasAnteriores.has(assinatura(item)),
  );
  const removidos = blocosAnteriores.filter(
    (item) => !assinaturasAtuais.has(assinatura(item)),
  );
  const movidos = blocos.filter((item) => {
    const correspondente = blocosAnteriores.find(
      (antigo) => assinatura(antigo) === assinatura(item),
    );
    return Boolean(correspondente && correspondente.semana !== item.semana);
  });
  const divididos = blocos.filter((item) => / · parte \d+\/\d+$/i.test(item.objetivo));
  const semanas = [...new Set(blocos.map((item) => item.semana))];

  return (
    <div className="painel-conteudo flex max-w-[1320px] flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div>
          <span className="rotulo">Memória do planejamento</span>
          <h1 className="mt-1 text-[clamp(1.8rem,3vw,2.45rem)] leading-none font-extrabold tracking-[-0.045em] text-ink">
            Histórico do roadmap
          </h1>
          <p className="mt-2 max-w-[68ch] text-[0.9rem] leading-relaxed text-body">
            Veja o que mudou, por que mudou e quanto foi realmente executado em cada versão — sem restaurar nem alterar o plano atual.
          </p>
        </div>
        <Link href="/app/roadmap" className="rounded-full bg-brand-700 px-4 py-2.5 text-[0.8rem] font-semibold text-white">
          Voltar ao roadmap atual
        </Link>
      </header>

      <div className="grid gap-5 xl:grid-cols-[330px_minmax(0,1fr)]">
        <aside className="superficie h-fit overflow-hidden xl:sticky xl:top-5">
          <div className="border-b border-line bg-paper px-5 py-4">
            <span className="rotulo">Linha do tempo</span>
            <p className="mt-1 text-[0.76rem] text-muted">{versoes.length} {versoes.length === 1 ? "versão preservada" : "versões preservadas"}</p>
          </div>
          <nav className="rolagem-fina max-h-[72vh] overflow-y-auto p-2" aria-label="Versões do roadmap">
            {versoes.map((versao, indice) => (
              <div key={versao.versao} className="relative pl-5">
                {indice < versoes.length - 1 && <span className="absolute top-7 bottom-0 left-[9px] w-px bg-line" />}
                <span className={`absolute top-5 left-[5px] h-2.5 w-2.5 rounded-full ring-4 ring-surface ${versao.vigente ? "bg-ouro-400" : "bg-brand-400"}`} />
                <Link href={`/app/roadmap/historico?versao=${versao.versao}`} className={`mb-2 block rounded-[13px] border p-3.5 ${selecionada.versao === versao.versao ? "border-brand-300 bg-brand-50" : "border-transparent hover:bg-paper"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-[0.84rem] text-ink">Versão {versao.versao}</strong>
                    {versao.vigente && <span className="rounded-full bg-ouro-100 px-2 py-0.5 text-[0.62rem] font-bold text-ouro-700">atual</span>}
                  </div>
                  <span className="mt-1 block text-[0.68rem] font-semibold text-brand-700">{ROTULOS_DA_ORIGEM[versao.origem]}</span>
                  <span className="mt-1.5 line-clamp-2 block text-[0.72rem] leading-snug text-muted">{versao.motivo}</span>
                  <span className="mt-2 block text-[0.65rem] text-muted">{formatarData(versao.criadoEm.slice(0, 10), { day: "2-digit", month: "short", year: "numeric" })}</span>
                </Link>
              </div>
            ))}
          </nav>
        </aside>

        <main className="flex min-w-0 flex-col gap-5">
          <section className="relative overflow-hidden rounded-[24px] bg-brand-900 p-6 text-white sm:p-7">
            <div aria-hidden="true" className="absolute -top-24 -right-20 h-64 w-64 rounded-full bg-ouro-400/15 blur-2xl" />
            <div className="relative">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[0.7rem] font-bold tracking-[0.13em] text-ouro-200 uppercase">Versão {selecionada.versao}</span>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[0.66rem] text-white/70">{ROTULOS_DA_ORIGEM[selecionada.origem]}</span>
                {selecionada.vigente && <span className="rounded-full bg-ouro-400 px-2.5 py-1 text-[0.66rem] font-bold text-noite">roadmap atual</span>}
              </div>
              <h2 className="mt-3 text-[1.45rem] font-extrabold text-white">{selecionada.motivo}</h2>
              {selecionada.diagnostico && <p className="mt-2 max-w-[75ch] text-[0.85rem] leading-relaxed text-white/68">{selecionada.diagnostico}</p>}
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              [`${selecionada.concluidos}/${selecionada.blocos}`, "blocos concluídos"],
              [horas(selecionada.horasPlanejadas), "carga planejada"],
              [minutos(selecionada.minutosFoco), "foco registrado"],
              [String(selecionada.questoesRespondidas), "questões nas sessões"],
            ].map(([valor, rotulo]) => (
              <div key={rotulo} className="superficie p-4">
                <strong className="block text-[1.3rem] tracking-[-0.035em] text-brand-700">{valor}</strong>
                <span className="mt-1 block text-[0.7rem] text-muted">{rotulo}</span>
              </div>
            ))}
          </section>

          {anterior ? (
            <section className="superficie overflow-hidden">
              <div className="border-b border-line bg-paper px-5 py-4">
                <span className="rotulo">Comparação com a versão {anterior.versao}</span>
                <h2 className="mt-1 text-[1.08rem] font-bold text-ink">O que esta mudança produziu</h2>
              </div>
              <div className="grid gap-px bg-line sm:grid-cols-2 xl:grid-cols-4">
                {[
                  [diferenca(selecionada.blocos, anterior.blocos), "blocos"],
                  [diferenca(selecionada.horasPlanejadas, anterior.horasPlanejadas, "h"), "carga"],
                  [String(movidos.length), "blocos redistribuídos"],
                  [String(divididos.length), "partes criadas"],
                ].map(([valor, rotulo]) => <div key={rotulo} className="bg-surface p-4"><strong className="block text-[1.08rem] text-ink">{valor}</strong><span className="text-[0.69rem] text-muted">{rotulo}</span></div>)}
              </div>
              {(adicionados.length > 0 || removidos.length > 0) && (
                <div className="grid gap-4 p-5 lg:grid-cols-2">
                  <div><span className="text-[0.7rem] font-bold text-brand-700 uppercase">Entraram nesta versão</span>{adicionados.length ? <ul className="mt-2 flex flex-col gap-1.5">{adicionados.slice(0, 6).map((item) => <li key={item.id} className="text-[0.78rem] text-body">+ {item.disciplina}: {item.objetivo}</li>)}</ul> : <p className="mt-2 text-[0.78rem] text-muted">Nenhum bloco novo.</p>}</div>
                  <div><span className="text-[0.7rem] font-bold text-vinho-600 uppercase">Saíram da sequência</span>{removidos.length ? <ul className="mt-2 flex flex-col gap-1.5">{removidos.slice(0, 6).map((item) => <li key={item.id} className="text-[0.78rem] text-body">− {item.disciplina}: {item.objetivo}</li>)}</ul> : <p className="mt-2 text-[0.78rem] text-muted">Nenhum bloco removido.</p>}</div>
                </div>
              )}
            </section>
          ) : (
            <p className="rounded-[14px] border border-brand-100 bg-brand-50 p-4 text-[0.8rem] text-brand-800">Esta é a primeira versão preservada. A comparação começará na próxima alteração.</p>
          )}

          <section className="superficie overflow-hidden">
            <div className="border-b border-line bg-paper px-5 py-4">
              <span className="rotulo">Fotografia da versão</span>
              <h2 className="mt-1 text-[1.08rem] font-bold text-ink">Planejamento e execução por bloco</h2>
            </div>
            <div className="flex flex-col p-4 sm:p-5">
              {semanas.map((semana) => (
                <section key={semana} className="border-b border-line py-5 first:pt-0 last:border-0 last:pb-0">
                  <span className="text-[0.7rem] font-bold tracking-[0.1em] text-brand-700 uppercase">Semana {semana}</span>
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    {blocos.filter((item) => item.semana === semana).map((item) => {
                      const execucao = evidencias.get(item.id);
                      const metas = metasPorBloco.get(item.id) ?? [];
                      return (
                        <article key={item.id} className="rounded-[14px] border border-hairline bg-paper p-4">
                          <div className="flex items-start justify-between gap-3"><div><strong className="text-[0.88rem] text-ink">{item.disciplina}</strong><p className="mt-1 text-[0.76rem] leading-relaxed text-body">{item.objetivo}</p></div><span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-[0.68rem] font-bold text-brand-700">{horas(Number(item.horas))}</span></div>
                          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[0.67rem] text-muted"><span>{item.estado === "concluido" ? "✓ concluído" : item.estado === "em_andamento" ? "em andamento" : "a estudar"}</span><span>{minutos(Math.floor((execucao?.segundos ?? 0) / 60))} de foco</span><span>{execucao?.questoes ?? 0} questões</span><span>{execucao?.materiais.size ?? 0} leituras</span></div>
                          {metas.length > 0 && <div className="mt-3 border-t border-line pt-3"><span className="text-[0.64rem] font-bold text-muted uppercase">Metas preservadas</span><div className="mt-2 flex flex-col gap-1.5">{metas.map((meta) => <div key={meta.id} className="flex items-center justify-between gap-3 text-[0.7rem]"><span className={meta.progresso >= meta.alvo ? "text-brand-700" : "text-body"}>{meta.progresso >= meta.alvo ? "✓ " : ""}{meta.titulo}</span><span className="shrink-0 text-muted">{meta.progresso}/{meta.alvo}</span></div>)}</div></div>}
                          {item.anotacao && <p className="mt-3 line-clamp-3 rounded-[10px] bg-brand-50 px-3 py-2 text-[0.7rem] leading-relaxed text-brand-800">Anotação: {item.anotacao}</p>}
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
