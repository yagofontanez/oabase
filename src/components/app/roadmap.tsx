"use client";

import Link from "next/link";
import { useState } from "react";
import { ReplanejadorRoadmap } from "@/components/app/replanejador-roadmap";
import { Resolvedor, type QuestaoDaFila } from "@/components/app/resolvedor";
import type { DiagnosticoDoReplanejamento } from "@/lib/replanejamento";
import { supabaseNavegador } from "@/lib/supabase/browser";
import type { EstadoDoRoadmap, ItemRoadmap } from "@/lib/roadmap";

export type LeituraDoRoadmap = {
  href: string;
  rotulo: string;
  caput: string;
  comentario: string[];
};

const ESTADOS: [EstadoDoRoadmap, string][] = [
  ["a_estudar", "A estudar"],
  ["em_andamento", "Estudando"],
  ["concluido", "Concluído"],
];

export function Roadmap({
  itensIniciais,
  ativoId,
  focos,
  leituras,
  questoes,
  disciplinaSlug,
  diagnosticoReplanejamento,
  versao,
}: {
  itensIniciais: ItemRoadmap[];
  ativoId: string;
  focos: Record<number, string>;
  leituras: LeituraDoRoadmap[];
  questoes: QuestaoDaFila[];
  disciplinaSlug: string | null;
  diagnosticoReplanejamento: DiagnosticoDoReplanejamento;
  versao: number;
}) {
  const [itens, setItens] = useState(itensIniciais);
  const ativo = itens.find((item) => item.id === ativoId) ?? itens[0];
  const [anotacao, setAnotacao] = useState(ativo?.anotacao ?? "");
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const concluidos = itens.filter((item) => item.estado === "concluido").length;
  const percentual = itens.length ? Math.round((concluidos / itens.length) * 100) : 0;
  const semanas = [...new Set(itens.map((item) => item.semana))];

  async function mudarEstado(estado: EstadoDoRoadmap) {
    if (!ativo || ativo.estado === estado) return;
    const anteriores = itens;
    const agora = new Date().toISOString();
    setItens((lista) =>
      lista.map((item) => (item.id === ativo.id ? { ...item, estado } : item)),
    );
    const datas =
      estado === "concluido"
        ? { iniciado_em: agora, concluido_em: agora }
        : estado === "em_andamento"
          ? { iniciado_em: agora, concluido_em: null }
          : { iniciado_em: null, concluido_em: null };
    const { error } = await supabaseNavegador()
      .from("roadmap_itens")
      .update({ estado, ...datas, atualizado_em: agora })
      .eq("id", ativo.id);
    if (error) {
      setItens(anteriores);
      setMensagem("Não consegui atualizar o bloco.");
    }
  }

  async function salvarAnotacao() {
    if (!ativo || salvando) return;
    setSalvando(true);
    setMensagem(null);
    const texto = anotacao.trim().slice(0, 2000);
    const { error } = await supabaseNavegador()
      .from("roadmap_itens")
      .update({ anotacao: texto, atualizado_em: new Date().toISOString() })
      .eq("id", ativo.id);
    if (error) setMensagem("Não consegui salvar a anotação.");
    else {
      setItens((lista) =>
        lista.map((item) =>
          item.id === ativo.id ? { ...item, anotacao: texto } : item,
        ),
      );
      setMensagem("Anotação salva.");
    }
    setSalvando(false);
  }

  if (!ativo) return null;

  return (
    <div className="painel-conteudo flex flex-col gap-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="rotulo">Mesa de execução</span>
          <h1 className="mt-1 text-[clamp(1.8rem,3vw,2.35rem)] leading-none font-extrabold tracking-[-0.045em] text-ink">
            Seu roadmap
          </h1>
          <p className="mt-2 max-w-[58ch] text-[0.94rem] text-body">
            Escolha um bloco, estude o material e resolva as questões sem sair desta tela.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/app/plano" className="rounded-full border border-hairline bg-surface px-4 py-2 text-[0.84rem] font-semibold text-ink hover:border-brand-300 hover:text-brand-700">
            Ajustar plano
          </Link>
          <a href="/api/roadmap/pdf" className="rounded-full border border-hairline bg-surface px-4 py-2 text-[0.84rem] font-semibold text-ink hover:border-brand-300 hover:text-brand-700">
            Baixar guia completo
          </a>
          <div className="min-w-56 rounded-[16px] bg-brand-800 px-4 py-3 text-white">
            <div className="flex items-baseline justify-between gap-3">
              <strong className="text-[1.15rem]">{percentual}%</strong>
              <span className="text-[0.78rem] text-brand-100">{concluidos}/{itens.length} blocos</span>
            </div>
            <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-white/15">
              <span className="block h-full rounded-full bg-ouro-400" style={{ width: `${percentual}%` }} />
            </span>
          </div>
        </div>
      </header>

      <ReplanejadorRoadmap
        diagnostico={diagnosticoReplanejamento}
        versao={versao}
      />

      <div className="grid min-h-0 gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="superficie h-fit overflow-hidden xl:sticky xl:top-6">
          <div className="border-b border-line px-4 py-3">
            <span className="rotulo">Semanas e blocos</span>
          </div>
          <nav className="rolagem-fina max-h-[68vh] overflow-y-auto p-2" aria-label="Blocos do roadmap">
            {semanas.map((semana) => {
              const daSemana = itens.filter((item) => item.semana === semana);
              const feitos = daSemana.filter((item) => item.estado === "concluido").length;
              return (
                <section key={semana} className="py-2">
                  <div className="flex items-baseline justify-between px-2 pb-1.5">
                    <span className="text-[0.78rem] font-bold text-brand-700 uppercase">Semana {semana}</span>
                    <span className="text-[0.72rem] text-muted">{feitos}/{daSemana.length}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    {daSemana.map((item) => (
                      <Link
                        key={item.id}
                        href={`/app/roadmap?item=${item.id}`}
                        className={`flex items-start gap-2.5 rounded-[10px] px-2.5 py-2.5 transition-colors ${item.id === ativo.id ? "bg-brand-50 text-brand-800" : "text-body hover:bg-paper"}`}
                      >
                        <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${item.estado === "concluido" ? "bg-brand-500" : item.estado === "em_andamento" ? "bg-ouro-400" : "bg-hairline"}`} />
                        <span className="min-w-0">
                          <span className="block truncate text-[0.84rem] font-semibold">{item.disciplina}</span>
                          <span className="line-clamp-2 text-[0.75rem] leading-snug text-muted">{item.objetivo}</span>
                        </span>
                      </Link>
                    ))}
                  </div>
                </section>
              );
            })}
          </nav>
        </aside>

        <main className="flex min-w-0 flex-col gap-5">
          <section className="superficie overflow-hidden">
            <div className="border-b border-line bg-paper px-5 py-4 sm:px-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="text-[0.76rem] font-bold text-brand-700 uppercase">Semana {ativo.semana} · {focos[ativo.semana]}</span>
                  <h2 className="mt-1 text-[1.45rem] font-extrabold text-ink">{ativo.disciplina}</h2>
                  <p className="mt-1 max-w-[68ch] text-[0.95rem] text-body">{ativo.objetivo}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-brand-50 px-3 py-1.5 text-[0.82rem] font-bold text-brand-700">{ativo.horas}h previstas</span>
                  {ativo.estado !== "concluido" && (
                    <Link href={`/app/sessao/${ativo.id}`} className="rounded-full bg-ouro-400 px-4 py-2 text-[0.82rem] font-bold text-noite hover:bg-ouro-300">
                      Iniciar sessão guiada
                    </Link>
                  )}
                </div>
              </div>
            </div>
            <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[auto_1fr]">
              <div>
                <span className="rotulo">Estado do bloco</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ESTADOS.map(([chave, rotulo]) => (
                    <button
                      key={chave}
                      type="button"
                      onClick={() => mudarEstado(chave)}
                      aria-pressed={ativo.estado === chave}
                      className={`rounded-full px-3 py-2 text-[0.82rem] font-semibold ${ativo.estado === chave ? chave === "concluido" ? "bg-brand-600 text-white" : chave === "em_andamento" ? "bg-ouro-400 text-noite" : "bg-body text-white" : "bg-sunk text-muted hover:text-ink"}`}
                    >
                      {rotulo}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="anotacao-roadmap" className="rotulo">Anotações deste bloco</label>
                <textarea
                  id="anotacao-roadmap"
                  value={anotacao}
                  onChange={(evento) => setAnotacao(evento.target.value)}
                  maxLength={2000}
                  rows={4}
                  placeholder="Registre dúvidas, conceitos para revisar ou o que ficou pendente…"
                  className="mt-2 w-full resize-y rounded-[12px] border border-hairline bg-surface px-3.5 py-3 text-[0.9rem] text-ink outline-none focus:border-brand-300"
                />
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-[0.76rem] text-muted">{anotacao.length}/2.000</span>
                  <button type="button" onClick={salvarAnotacao} disabled={salvando} className="rounded-full bg-brand-600 px-4 py-2 text-[0.82rem] font-semibold text-white disabled:opacity-50">
                    {salvando ? "Salvando…" : "Salvar anotação"}
                  </button>
                </div>
                {mensagem && <p role="status" className="mt-2 text-[0.8rem] text-muted">{mensagem}</p>}
              </div>
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            <div className="superficie p-5 sm:p-6">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-[1.1rem] font-bold text-ink">Leitura recomendada</h2>
                <span className="text-[0.76rem] text-muted">do acervo aberto</span>
              </div>
              {leituras.length ? (
                <div className="mt-4 flex flex-col divide-y divide-line">
                  {leituras.map((leitura) => (
                    <article key={leitura.href} className="py-4 first:pt-0">
                      <Link href={leitura.href} className="font-bold text-brand-700 hover:underline">{leitura.rotulo}</Link>
                      <p className="lei-texto mt-1.5 line-clamp-4 text-[0.96rem]">{leitura.caput}</p>
                      {leitura.comentario[0] && <p className="mt-2 line-clamp-3 text-[0.82rem] text-muted">{leitura.comentario[0]}</p>}
                    </article>
                  ))}
                </div>
              ) : <p className="mt-4 text-[0.88rem] text-muted">Ainda não há artigo comentado desta matéria no acervo.</p>}
            </div>
            <div className="superficie flex flex-col p-5 sm:p-6">
              <h2 className="text-[1.1rem] font-bold text-ink">Treino recomendado</h2>
              <p className="mt-2 text-[0.88rem] leading-relaxed text-body">
                {questoes.length ? `${questoes.length} questões novas desta matéria foram separadas abaixo. O gabarito só aparece depois da resposta.` : "Não há questões novas disponíveis para esta matéria agora."}
              </p>
              {disciplinaSlug && (
                <Link href={`/app/questoes?disciplina=${disciplinaSlug}`} className="mt-auto pt-5 text-[0.86rem] font-semibold text-brand-700 underline decoration-brand-200 underline-offset-4">
                  Abrir fila completa da matéria →
                </Link>
              )}
            </div>
          </section>

          {questoes.length > 0 && (
            <section id="questoes-do-bloco" className="flex flex-col gap-3 scroll-mt-6">
              <div>
                <span className="rotulo">Prática do bloco</span>
                <h2 className="mt-1 text-[1.25rem] font-bold text-ink">Resolva sem sair do roadmap</h2>
              </div>
              <Resolvedor key={ativo.id} fila={questoes} />
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
