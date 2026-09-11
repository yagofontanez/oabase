"use client";

import { useState } from "react";
import {
  configuracaoDaMeta,
  metaDaLinha,
  TIPOS_DE_META,
  type MetaDoRoadmap,
  type ResumoDeMetasDoBloco,
  type TipoDeMetaDoRoadmap,
} from "@/lib/metas-roadmap";
import { supabaseNavegador } from "@/lib/supabase/browser";

function percentualDaMeta(meta: MetaDoRoadmap) {
  return Math.min(100, Math.round((meta.progresso / meta.alvo) * 100));
}

function resumoDasMetas(
  metas: MetaDoRoadmap[],
): ResumoDeMetasDoBloco | null {
  if (metas.length === 0) return null;
  return {
    total: metas.length,
    concluidas: metas.filter((meta) => meta.progresso >= meta.alvo).length,
    percentual: Math.round(
      metas.reduce((total, meta) => total + percentualDaMeta(meta), 0) /
        metas.length,
    ),
  };
}

function quantidade(meta: MetaDoRoadmap, valor: number) {
  if (meta.tipo !== "foco") return String(valor);
  const horas = Math.floor(valor / 60);
  const minutos = valor % 60;
  if (!horas) return `${minutos}min`;
  return minutos ? `${horas}h${String(minutos).padStart(2, "0")}` : `${horas}h`;
}

function FormularioDeMeta({
  roadmapItemId,
  meta,
  tipoInicial,
  tiposUsados,
  aoSalvar,
  aoCancelar,
}: {
  roadmapItemId: string;
  meta: MetaDoRoadmap | null;
  tipoInicial?: TipoDeMetaDoRoadmap;
  tiposUsados: TipoDeMetaDoRoadmap[];
  aoSalvar: () => Promise<void>;
  aoCancelar: () => void;
}) {
  const disponiveis = TIPOS_DE_META.filter(
    (tipo) => meta?.tipo === tipo.id || !tiposUsados.includes(tipo.id),
  );
  const inicial = meta
    ? configuracaoDaMeta(meta.tipo)
    : configuracaoDaMeta(tipoInicial ?? disponiveis[0]?.id ?? "leitura");
  const [tipo, setTipo] = useState<TipoDeMetaDoRoadmap>(inicial.id);
  const [titulo, setTitulo] = useState(meta?.titulo ?? inicial.titulo);
  const [alvo, setAlvo] = useState(meta?.alvo ?? inicial.alvoPadrao);
  const [subtopicos, setSubtopicos] = useState(
    meta?.subtopicos.map((item) => item.texto).join("\n") ?? "",
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const configuracao = configuracaoDaMeta(tipo);

  function escolherTipo(proximo: TipoDeMetaDoRoadmap) {
    if (meta) return;
    const proxima = configuracaoDaMeta(proximo);
    setTipo(proximo);
    setTitulo(proxima.titulo);
    setAlvo(proxima.alvoPadrao);
    setErro(null);
  }

  async function salvar() {
    if (salvando) return;
    const itens = [
      ...new Set(
        subtopicos
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    ].slice(0, 30);
    if (!titulo.trim()) {
      setErro("Dê um nome para a meta.");
      return;
    }
    if (tipo === "subtopicos" && itens.length === 0) {
      setErro("Escreva ao menos um subtópico, um por linha.");
      return;
    }
    setSalvando(true);
    setErro(null);
    const { error } = await supabaseNavegador().rpc("salvar_meta_roadmap", {
      p_roadmap_item_id: roadmapItemId,
      p_meta_id: meta?.id ?? null,
      p_tipo: tipo,
      p_titulo: titulo.trim(),
      p_alvo: tipo === "subtopicos" ? Math.max(1, itens.length) : alvo,
      p_subtopicos: tipo === "subtopicos" ? itens : [],
    });
    if (error) {
      setErro(
        error.code === "23505"
          ? "Este bloco já tem uma meta desse tipo."
          : "Não consegui salvar a meta.",
      );
      setSalvando(false);
      return;
    }
    await aoSalvar();
    setSalvando(false);
  }

  return (
    <div className="rounded-[18px] border border-brand-200 bg-brand-50/70 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="rotulo">{meta ? "Editar meta" : "Nova meta"}</span>
          <h3 className="mt-1 text-[1.05rem] font-bold text-ink">
            Defina o que significa terminar este bloco
          </h3>
        </div>
        <button
          type="button"
          onClick={aoCancelar}
          disabled={salvando}
          className="rounded-full px-3 py-1.5 text-[0.76rem] font-semibold text-muted hover:bg-white"
        >
          Cancelar
        </button>
      </div>

      {!meta && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {disponiveis.map((opcao) => (
            <button
              key={opcao.id}
              type="button"
              onClick={() => escolherTipo(opcao.id)}
              aria-pressed={tipo === opcao.id}
              className={`rounded-[12px] border p-3 text-left transition-colors ${
                tipo === opcao.id
                  ? "border-brand-400 bg-white ring-1 ring-brand-200"
                  : "border-hairline bg-white/60 hover:border-brand-200"
              }`}
            >
              <strong className="block text-[0.78rem] text-ink">
                {opcao.titulo}
              </strong>
              <span className="mt-1 block text-[0.68rem] leading-snug text-muted">
                {opcao.automatico ? "progresso automático" : "controle manual"}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
        <label className="text-[0.74rem] font-semibold text-muted">
          Nome da meta
          <input
            value={titulo}
            onChange={(evento) => setTitulo(evento.target.value)}
            maxLength={120}
            className="mt-1.5 block w-full rounded-[11px] border border-hairline bg-surface px-3.5 py-2.5 text-[0.84rem] font-normal text-ink outline-none focus:border-brand-300"
          />
        </label>
        {tipo !== "subtopicos" && (
          <label className="text-[0.74rem] font-semibold text-muted">
            Alvo em {configuracao.unidade}
            <input
              type="number"
              min={1}
              max={tipo === "foco" ? 10000 : 1000}
              value={alvo}
              onChange={(evento) => setAlvo(Number(evento.target.value))}
              className="mt-1.5 block w-full rounded-[11px] border border-hairline bg-surface px-3.5 py-2.5 text-[0.84rem] font-normal text-ink outline-none focus:border-brand-300"
            />
          </label>
        )}
      </div>

      {tipo === "subtopicos" && (
        <label className="mt-4 block text-[0.74rem] font-semibold text-muted">
          Subtópicos · um por linha
          <textarea
            value={subtopicos}
            onChange={(evento) => setSubtopicos(evento.target.value)}
            rows={6}
            maxLength={4800}
            placeholder={"Conceito e classificação\nRequisitos\nExceções\nQuestões práticas"}
            className="mt-1.5 block w-full resize-y rounded-[11px] border border-hairline bg-surface px-3.5 py-3 text-[0.84rem] leading-relaxed font-normal text-ink outline-none focus:border-brand-300"
          />
          <span className="mt-1 block font-normal text-muted">
            Até 30 itens. Os já concluídos são preservados ao editar pelo mesmo texto.
          </span>
        </label>
      )}

      <p className="mt-3 text-[0.72rem] leading-relaxed text-muted">
        {configuracao.descricao}
      </p>
      {erro && (
        <p role="alert" className="mt-3 text-[0.76rem] text-vinho-600">
          {erro}
        </p>
      )}
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => void salvar()}
          disabled={salvando}
          className="rounded-full bg-brand-700 px-5 py-2.5 text-[0.8rem] font-semibold text-white disabled:opacity-50"
        >
          {salvando ? "Salvando…" : meta ? "Salvar alterações" : "Adicionar meta"}
        </button>
      </div>
    </div>
  );
}

export function MetasDoBloco({
  roadmapItemId,
  metasIniciais,
  aoAtualizarResumo,
}: {
  roadmapItemId: string;
  metasIniciais: MetaDoRoadmap[];
  aoAtualizarResumo?: (resumo: ResumoDeMetasDoBloco | null) => void;
}) {
  const [metas, setMetas] = useState(metasIniciais);
  const [formulario, setFormulario] = useState<
    MetaDoRoadmap | TipoDeMetaDoRoadmap | null
  >(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const resumo = resumoDasMetas(metas);

  async function recarregar() {
    const { data, error } = await supabaseNavegador().rpc("metas_do_bloco", {
      p_roadmap_item_id: roadmapItemId,
    });
    if (error) {
      setMensagem("A meta foi salva, mas não consegui atualizar o painel.");
      return;
    }
    const proximas = ((data ?? []) as Record<string, unknown>[]).map(metaDaLinha);
    setMetas(proximas);
    aoAtualizarResumo?.(resumoDasMetas(proximas));
    setFormulario(null);
    setMensagem("Metas atualizadas.");
  }

  async function progressoManual(meta: MetaDoRoadmap, progresso: number) {
    if (ocupado) return;
    setOcupado(meta.id);
    setMensagem(null);
    const { error } = await supabaseNavegador().rpc(
      "atualizar_progresso_manual_meta",
      { p_meta_id: meta.id, p_progresso: progresso },
    );
    if (error) setMensagem("Não consegui registrar esta revisão.");
    else await recarregar();
    setOcupado(null);
  }

  async function marcarSubtopico(
    meta: MetaDoRoadmap,
    subtopicoId: string,
    concluido: boolean,
  ) {
    if (ocupado) return;
    setOcupado(subtopicoId);
    setMensagem(null);
    setMetas((atuais) =>
      atuais.map((item) =>
        item.id === meta.id
          ? {
              ...item,
              progresso: item.progresso + (concluido ? 1 : -1),
              subtopicos: item.subtopicos.map((subtopico) =>
                subtopico.id === subtopicoId
                  ? { ...subtopico, concluido }
                  : subtopico,
              ),
            }
          : item,
      ),
    );
    const { error } = await supabaseNavegador().rpc("marcar_subtopico_meta", {
      p_subtopico_id: subtopicoId,
      p_concluido: concluido,
    });
    if (error) setMensagem("Não consegui atualizar o subtópico.");
    await recarregar();
    setOcupado(null);
  }

  async function excluir(meta: MetaDoRoadmap) {
    if (ocupado || !window.confirm(`Excluir a meta “${meta.titulo}”?`)) return;
    setOcupado(meta.id);
    setMensagem(null);
    const { error } = await supabaseNavegador().rpc("excluir_meta_roadmap", {
      p_meta_id: meta.id,
    });
    if (error) setMensagem("Não consegui excluir a meta.");
    else await recarregar();
    setOcupado(null);
  }

  const tiposUsados = metas.map((meta) => meta.tipo);
  const todosOsTiposUsados = tiposUsados.length === TIPOS_DE_META.length;

  return (
    <section className="superficie overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line bg-paper px-5 py-4 sm:px-6">
        <div>
          <span className="rotulo">Resultado verificável</span>
          <h2 className="mt-1 text-[1.2rem] font-bold text-ink">Metas deste bloco</h2>
          <p className="mt-1 max-w-[65ch] text-[0.8rem] leading-relaxed text-muted">
            O progresso automático vem da sua execução registrada. Atividades externas
            continuam sob seu controle.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {resumo && (
            <span className="rounded-full bg-brand-50 px-3 py-2 text-[0.76rem] font-bold text-brand-700">
              {resumo.percentual}% · {resumo.concluidas}/{resumo.total} concluídas
            </span>
          )}
          {!todosOsTiposUsados && formulario === null && (
            <button
              type="button"
              onClick={() => {
                setFormulario(
                  TIPOS_DE_META.find((tipo) => !tiposUsados.includes(tipo.id))
                    ?.id ?? "leitura",
                );
                setMensagem(null);
              }}
              className="rounded-full bg-brand-700 px-4 py-2 text-[0.78rem] font-semibold text-white"
            >
              + Adicionar meta
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 p-5 sm:p-6">
        {formulario && (
          <FormularioDeMeta
            key={typeof formulario === "string" ? formulario : formulario.id}
            roadmapItemId={roadmapItemId}
            meta={typeof formulario === "string" ? null : formulario}
            tipoInicial={
              typeof formulario === "string" ? formulario : undefined
            }
            tiposUsados={tiposUsados}
            aoSalvar={recarregar}
            aoCancelar={() => setFormulario(null)}
          />
        )}

        {metas.length === 0 && formulario === null ? (
          <div className="rounded-[16px] border border-dashed border-brand-200 bg-brand-50/45 p-5">
            <h3 className="text-[0.96rem] font-bold text-ink">
              “Estudar a matéria” ainda não diz quando parar.
            </h3>
            <p className="mt-1.5 max-w-[68ch] text-[0.8rem] leading-relaxed text-body">
              Escolha uma evidência: tempo focado, leituras, questões, uma síntese ou
              um checklist próprio. Você pode combinar várias metas no mesmo bloco.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {TIPOS_DE_META.slice(0, 4).map((tipo) => (
                <button
                  key={tipo.id}
                  type="button"
                  onClick={() => setFormulario(tipo.id)}
                  className="rounded-full border border-brand-200 bg-white px-3.5 py-2 text-[0.74rem] font-semibold text-brand-700"
                >
                  {tipo.titulo}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {metas.map((meta) => {
              const configuracao = configuracaoDaMeta(meta.tipo);
              const percentual = percentualDaMeta(meta);
              const concluida = meta.progresso >= meta.alvo;
              return (
                <article
                  key={meta.id}
                  className={`flex flex-col rounded-[16px] border p-4 ${
                    concluida
                      ? "border-brand-200 bg-brand-50/55"
                      : "border-hairline bg-paper"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-[0.64rem] font-bold tracking-[0.1em] text-brand-600 uppercase">
                        {meta.automatico ? "Automática" : "Manual"} · {configuracao.unidade}
                      </span>
                      <h3 className="mt-1 text-[0.94rem] font-bold text-ink">
                        {meta.titulo}
                      </h3>
                    </div>
                    {concluida && (
                      <span className="shrink-0 rounded-full bg-brand-600 px-2.5 py-1 text-[0.66rem] font-bold text-white">
                        ✓ concluída
                      </span>
                    )}
                  </div>

                  <div className="mt-4 flex items-end justify-between gap-3">
                    <strong className="text-[1.25rem] tracking-[-0.03em] text-brand-700">
                      {quantidade(meta, meta.progresso)}
                      <span className="text-[0.8rem] font-medium text-muted">
                        {" / "}{quantidade(meta, meta.alvo)}
                      </span>
                    </strong>
                    <span className="text-[0.72rem] font-semibold text-muted">{percentual}%</span>
                  </div>
                  <span className="mt-2 block h-2 overflow-hidden rounded-full bg-sunk">
                    <span
                      className={`block h-full rounded-full transition-[width] ${concluida ? "bg-brand-500" : "bg-ouro-400"}`}
                      style={{ width: `${percentual}%` }}
                    />
                  </span>

                  {meta.tipo === "subtopicos" && (
                    <div className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
                      {meta.subtopicos.map((subtopico) => (
                        <label
                          key={subtopico.id}
                          className="flex items-start gap-2.5 text-[0.78rem] leading-snug text-body"
                        >
                          <input
                            type="checkbox"
                            checked={subtopico.concluido}
                            disabled={ocupado === subtopico.id}
                            onChange={(evento) =>
                              void marcarSubtopico(
                                meta,
                                subtopico.id,
                                evento.target.checked,
                              )
                            }
                            className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
                          />
                          <span className={subtopico.concluido ? "text-muted line-through" : ""}>
                            {subtopico.texto}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}

                  {meta.tipo === "anotacoes" && (
                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                      <button
                        type="button"
                        onClick={() => void progressoManual(meta, meta.progresso + 1)}
                        disabled={Boolean(ocupado) || concluida}
                        className="rounded-full bg-brand-700 px-3.5 py-2 text-[0.72rem] font-semibold text-white disabled:opacity-40"
                      >
                        Registrar revisão
                      </button>
                      {meta.progresso > 0 && (
                        <button
                          type="button"
                          onClick={() => void progressoManual(meta, meta.progresso - 1)}
                          disabled={Boolean(ocupado)}
                          className="rounded-full px-3 py-2 text-[0.7rem] font-semibold text-muted"
                        >
                          Desfazer uma
                        </button>
                      )}
                    </div>
                  )}

                  <p className="mt-3 text-[0.69rem] leading-relaxed text-muted">
                    {configuracao.descricao}
                  </p>
                  <div className="mt-auto flex items-center gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setFormulario(meta);
                        setMensagem(null);
                      }}
                      className="text-[0.7rem] font-semibold text-brand-700"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void excluir(meta)}
                      disabled={ocupado === meta.id}
                      className="text-[0.7rem] font-semibold text-vinho-600 disabled:opacity-40"
                    >
                      Excluir
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {mensagem && (
          <p role="status" className="text-[0.74rem] text-muted">
            {mensagem}
          </p>
        )}
      </div>
    </section>
  );
}
