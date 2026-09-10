"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { TopicoDaEmenta } from "@/lib/ia/ementa";
import type { ContextoSalvoDoPlano } from "@/lib/ia/plano";

type Origem = "texto" | "pdf" | "manual";
type Etapa = "entrada" | "revisao";
type TopicoEditavel = TopicoDaEmenta & { chave: string };

const ORIGENS: { chave: Origem; rotulo: string; detalhe: string }[] = [
  { chave: "texto", rotulo: "Colar ementa", detalhe: "Texto do plano de ensino" },
  { chave: "pdf", rotulo: "Enviar PDF", detalhe: "Até 4 MB e 60 páginas" },
  { chave: "manual", rotulo: "Lista manual", detalhe: "Um tópico por linha" },
];

export function ImportadorEmenta({
  disciplinas,
  temPlano,
  contextoInicial,
}: {
  disciplinas: string[];
  temPlano: boolean;
  contextoInicial: ContextoSalvoDoPlano | null;
}) {
  const router = useRouter();
  const arquivoRef = useRef<HTMLInputElement>(null);
  const ementaInicial =
    contextoInicial?.origem === "ementa" ? contextoInicial.ementa : null;
  const [etapa, setEtapa] = useState<Etapa>(ementaInicial ? "revisao" : "entrada");
  const [origem, setOrigem] = useState<Origem>("texto");
  const [titulo, setTitulo] = useState(ementaInicial?.titulo ?? "");
  const [texto, setTexto] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [prazo, setPrazo] = useState(contextoInicial?.prazo ?? "");
  const [horas, setHoras] = useState(ementaInicial?.horasPorSemana ?? 5);
  const [topicos, setTopicos] = useState<TopicoEditavel[]>(
    (ementaInicial?.topicos ?? []).map((topico, indice) => ({
      ...topico,
      chave: `inicial-${indice}`,
    })),
  );
  const [analisando, setAnalisando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function organizar() {
    if (analisando) return;
    if (origem === "pdf" && !arquivo) {
      setErro("Escolha o PDF da ementa.");
      return;
    }
    if (origem !== "pdf" && texto.trim().length < 20) {
      setErro("Cole a ementa ou escreva ao menos dois tópicos.");
      return;
    }
    setAnalisando(true);
    setErro(null);
    setAviso(null);
    const formulario = new FormData();
    formulario.set("acao", "organizar");
    formulario.set("origem", origem);
    formulario.set("titulo", titulo);
    if (origem === "pdf" && arquivo) formulario.set("arquivo", arquivo);
    else formulario.set("texto", texto);
    try {
      const resposta = await fetch("/api/ementa", { method: "POST", body: formulario });
      const dados = await resposta.json();
      if (!resposta.ok) {
        setErro(dados.erro ?? "Não consegui organizar a ementa.");
        return;
      }
      setTitulo(String(dados.titulo ?? titulo));
      setTopicos(
        ((dados.topicos ?? []) as TopicoDaEmenta[]).map((topico) => ({
          ...topico,
          chave: crypto.randomUUID(),
        })),
      );
      if (dados.truncado) {
        setAviso("O documento era muito longo. A análise usou os primeiros 18 mil caracteres; confira se algum tópico final ficou de fora.");
      } else if (dados.paginas) {
        setAviso(`${dados.paginas} ${dados.paginas === 1 ? "página analisada" : "páginas analisadas"}. O arquivo não foi armazenado.`);
      }
      setEtapa("revisao");
    } catch {
      setErro("Sem conexão com o servidor. Tente novamente.");
    } finally {
      setAnalisando(false);
    }
  }

  function atualizar(indice: number, mudanca: Partial<TopicoDaEmenta>) {
    setTopicos((atuais) =>
      atuais.map((topico, atual) => (atual === indice ? { ...topico, ...mudanca } : topico)),
    );
  }

  function mover(indice: number, direcao: -1 | 1) {
    const destino = indice + direcao;
    if (destino < 0 || destino >= topicos.length) return;
    setTopicos((atuais) => {
      const copia = [...atuais];
      [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
      return copia;
    });
  }

  async function gerar() {
    const confirmados = topicos.filter((topico) => topico.titulo.trim().length >= 3);
    if (confirmados.length === 0 || gerando) {
      setErro("Mantenha ao menos um tópico válido.");
      return;
    }
    setGerando(true);
    setErro(null);
    const formulario = new FormData();
    formulario.set("acao", "gerar");
    formulario.set("titulo", titulo);
    formulario.set("prazo", prazo);
    formulario.set("horas", String(horas));
    formulario.set("topicos", JSON.stringify(confirmados));
    try {
      const resposta = await fetch("/api/ementa", { method: "POST", body: formulario });
      const dados = await resposta.json();
      if (!resposta.ok) {
        setErro(dados.erro ?? "Não consegui gerar o roadmap.");
        return;
      }
      router.push("/app/roadmap");
    } catch {
      setErro("Sem conexão com o servidor. Tente novamente.");
    } finally {
      setGerando(false);
    }
  }

  const vinculados = topicos.filter((topico) => topico.disciplina).length;

  return (
    <div className="painel-conteudo flex max-w-[1180px] flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-line pb-5">
        <div>
          <span className="rotulo">Estudo livre de Direito</span>
          <h1 className="mt-1 text-[clamp(1.8rem,3vw,2.4rem)] leading-none font-extrabold tracking-[-0.045em] text-ink">
            Importar ementa
          </h1>
          <p className="mt-2 max-w-[66ch] text-[0.94rem] text-body">
            Traga o plano de ensino da faculdade. Você revisa os tópicos antes de qualquer mudança no roadmap.
          </p>
        </div>
        <ol className="flex items-center gap-2 text-[0.76rem] font-semibold">
          {[
            ["entrada", "1", "Entrada"],
            ["revisao", "2", "Revisão"],
            ["final", "3", "Roadmap"],
          ].map(([chave, numero, rotulo], indice) => {
            const ativa = chave === etapa;
            const concluida = etapa === "revisao" && indice === 0;
            return (
              <li key={chave} className={`flex items-center gap-1.5 ${ativa || concluida ? "text-brand-700" : "text-muted"}`}>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full ${ativa ? "bg-brand-700 text-white" : concluida ? "bg-brand-100 text-brand-700" : "bg-sunk"}`}>
                  {concluida ? "✓" : numero}
                </span>
                <span className="hidden sm:inline">{rotulo}</span>
                {indice < 2 && <span className="mx-1 h-px w-5 bg-hairline" />}
              </li>
            );
          })}
        </ol>
      </header>

      {etapa === "entrada" ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_310px]">
          <section className="superficie overflow-hidden">
            <div className="grid border-b border-line sm:grid-cols-3">
              {ORIGENS.map((item) => (
                <button
                  key={item.chave}
                  type="button"
                  onClick={() => {
                    setOrigem(item.chave);
                    setErro(null);
                  }}
                  className={`border-b border-line px-5 py-4 text-left last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0 ${origem === item.chave ? "bg-brand-50" : "bg-surface hover:bg-paper"}`}
                >
                  <span className={`block text-[0.88rem] font-bold ${origem === item.chave ? "text-brand-700" : "text-ink"}`}>{item.rotulo}</span>
                  <span className="mt-0.5 block text-[0.74rem] text-muted">{item.detalhe}</span>
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-5 p-5 sm:p-7">
              <label className="flex flex-col gap-1.5 text-[0.82rem] font-semibold text-body">
                Nome da disciplina ou avaliação <span className="font-normal text-muted">(opcional)</span>
                <input
                  value={titulo}
                  onChange={(evento) => setTitulo(evento.target.value)}
                  maxLength={120}
                  placeholder="Ex.: Direito Civil III — Prova 2"
                  className="rounded-[12px] border border-hairline bg-surface px-3.5 py-3 text-[0.92rem] font-normal text-ink outline-none focus:border-brand-300"
                />
              </label>

              {origem === "pdf" ? (
                <>
                  <button
                    type="button"
                    onClick={() => arquivoRef.current?.click()}
                    className="group flex min-h-48 flex-col items-center justify-center rounded-[18px] border border-dashed border-brand-200 bg-brand-50/50 px-6 py-8 text-center transition-colors hover:border-brand-400 hover:bg-brand-50"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-brand-700 shadow-[var(--shadow-baixa)]">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-6 w-6" aria-hidden="true">
                        <path d="M12 16V4M7.5 8.5 12 4l4.5 4.5M5 13v6h14v-6" />
                      </svg>
                    </span>
                    <strong className="mt-4 text-[0.96rem] text-ink">{arquivo ? arquivo.name : "Escolher PDF da ementa"}</strong>
                    <span className="mt-1 text-[0.8rem] text-muted">{arquivo ? `${(arquivo.size / 1024 / 1024).toFixed(2)} MB · clique para trocar` : "O arquivo é lido e descartado após a extração"}</span>
                  </button>
                  <input
                    ref={arquivoRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="sr-only"
                    onChange={(evento) => {
                      const escolhido = evento.target.files?.[0] ?? null;
                      if (escolhido && escolhido.size > 4 * 1024 * 1024) {
                        setArquivo(null);
                        setErro("O PDF pode ter no máximo 4 MB.");
                        evento.target.value = "";
                        return;
                      }
                      setErro(null);
                      setArquivo(escolhido);
                    }}
                  />
                </>
              ) : (
                <label className="flex flex-col gap-1.5 text-[0.82rem] font-semibold text-body">
                  {origem === "manual" ? "Tópicos da disciplina" : "Texto da ementa"}
                  <textarea
                    value={texto}
                    onChange={(evento) => setTexto(evento.target.value)}
                    rows={origem === "manual" ? 12 : 15}
                    maxLength={30_000}
                    placeholder={
                      origem === "manual"
                        ? "Teoria geral dos contratos\nFormação e extinção dos contratos\nResponsabilidade contratual"
                        : "Cole aqui os objetivos, unidades e conteúdos previstos no plano de ensino…"
                    }
                    className="resize-y rounded-[14px] border border-hairline bg-surface px-4 py-3 text-[0.92rem] leading-relaxed font-normal text-ink outline-none focus:border-brand-300"
                  />
                  <span className="self-end text-[0.72rem] font-normal text-muted">{texto.length.toLocaleString("pt-BR")}/30.000</span>
                </label>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-[0.82rem] font-semibold text-body">
                  Data da prova <span className="font-normal text-muted">(opcional)</span>
                  <input type="date" value={prazo} onChange={(evento) => setPrazo(evento.target.value)} className="rounded-[12px] border border-hairline bg-surface px-3.5 py-3 text-[0.92rem] font-normal text-ink" />
                </label>
                <label className="flex flex-col gap-1.5 text-[0.82rem] font-semibold text-body">
                  Horas disponíveis por semana
                  <span className="flex items-center rounded-[12px] border border-hairline bg-surface px-3.5">
                    <input type="number" min={1} max={60} step={0.5} value={horas} onChange={(evento) => setHoras(Number(evento.target.value))} className="w-full bg-transparent py-3 text-[0.92rem] font-normal text-ink outline-none" />
                    <span className="text-[0.8rem] font-normal text-muted">horas</span>
                  </span>
                </label>
              </div>

              {erro && <p role="alert" className="rounded-[12px] bg-vinho-50 px-4 py-3 text-[0.86rem] text-vinho-700">{erro}</p>}
              <button
                type="button"
                onClick={() => void organizar()}
                disabled={analisando}
                className="self-start rounded-full bg-brand-600 px-5 py-3 text-[0.9rem] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-55"
              >
                {analisando ? "Organizando tópicos…" : "Organizar e revisar tópicos"}
              </button>
            </div>
          </section>

          <aside className="flex h-fit flex-col gap-4 lg:sticky lg:top-6">
            <section className="rounded-[18px] bg-brand-900 p-5 text-white">
              <span className="text-[0.72rem] font-bold tracking-[0.12em] text-ouro-200 uppercase">O que a IA faz</span>
              <h2 className="mt-2 text-[1.05rem] font-bold text-white">Organiza, não ensina</h2>
              <ul className="mt-3 flex flex-col gap-2.5 text-[0.82rem] leading-relaxed text-white/70">
                <li>• separa unidades e tópicos;</li>
                <li>• preserva a ordem da ementa;</li>
                <li>• aproxima do acervo quando houver correspondência;</li>
                <li>• não cria explicações ou conteúdo jurídico.</li>
              </ul>
            </section>
            <section className="superficie p-5">
              <span className="rotulo">Privacidade</span>
              <p className="mt-2 text-[0.84rem] leading-relaxed text-muted">O PDF não é salvo no banco ou no armazenamento. Só os tópicos que você confirmar entram no plano.</p>
            </section>
          </aside>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_310px]">
          <section className="superficie overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-paper px-5 py-4 sm:px-6">
              <div>
                <span className="rotulo">Revise antes de gerar</span>
                <h2 className="mt-1 text-[1.18rem] font-bold text-ink">{topicos.length} tópicos encontrados</h2>
              </div>
              <button type="button" onClick={() => setEtapa("entrada")} className="text-[0.82rem] font-semibold text-brand-700 underline decoration-brand-200 underline-offset-4">Trocar documento</button>
            </div>
            {aviso && <p className="border-b border-ouro-100 bg-ouro-50 px-5 py-3 text-[0.82rem] text-ouro-700 sm:px-6">{aviso}</p>}
            <ol className="divide-y divide-line">
              {topicos.map((topico, indice) => (
                <li key={topico.chave} className="grid gap-3 px-5 py-4 sm:grid-cols-[38px_minmax(0,1fr)_220px_auto] sm:items-center sm:px-6">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sunk text-[0.76rem] font-bold text-muted">{indice + 1}</span>
                  <input
                    value={topico.titulo}
                    onChange={(evento) => atualizar(indice, { titulo: evento.target.value })}
                    maxLength={180}
                    aria-label={`Tópico ${indice + 1}`}
                    className="min-w-0 rounded-[10px] border border-transparent bg-transparent px-2 py-2 text-[0.88rem] font-semibold text-ink outline-none hover:border-hairline focus:border-brand-300 focus:bg-surface"
                  />
                  <select
                    value={topico.disciplina ?? ""}
                    onChange={(evento) => atualizar(indice, { disciplina: evento.target.value || null })}
                    aria-label={`Disciplina do tópico ${indice + 1}`}
                    className="min-w-0 rounded-[10px] border border-hairline bg-surface px-2.5 py-2 text-[0.78rem] text-body"
                  >
                    <option value="">Material externo</option>
                    {disciplinas.map((disciplina) => <option key={disciplina} value={disciplina}>{disciplina}</option>)}
                  </select>
                  <span className="flex items-center justify-end gap-1">
                    <button type="button" onClick={() => mover(indice, -1)} disabled={indice === 0} title="Mover para cima" className="rounded-full p-2 text-muted hover:bg-sunk hover:text-ink disabled:opacity-25">↑</button>
                    <button type="button" onClick={() => mover(indice, 1)} disabled={indice === topicos.length - 1} title="Mover para baixo" className="rounded-full p-2 text-muted hover:bg-sunk hover:text-ink disabled:opacity-25">↓</button>
                    <button type="button" onClick={() => setTopicos((atuais) => atuais.filter((_, atual) => atual !== indice))} title="Remover tópico" className="rounded-full p-2 text-muted hover:bg-vinho-50 hover:text-vinho-600">×</button>
                  </span>
                </li>
              ))}
            </ol>
            <button
              type="button"
              onClick={() => setTopicos((atuais) => [...atuais, { titulo: "Novo tópico", disciplina: null, chave: crypto.randomUUID() }])}
              disabled={topicos.length >= 60}
              className="m-5 rounded-full border border-dashed border-brand-200 px-4 py-2 text-[0.82rem] font-semibold text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-45 sm:mx-6"
            >
              {topicos.length >= 60 ? "Limite de 60 tópicos" : "+ Adicionar tópico"}
            </button>
          </section>

          <aside className="flex h-fit flex-col gap-4 lg:sticky lg:top-6">
            <section className="superficie flex flex-col gap-4 p-5">
              <div>
                <span className="rotulo">Plano confirmado</span>
                <label className="mt-2 block text-[0.72rem] font-semibold text-muted">
                  Nome do plano
                  <input value={titulo} onChange={(evento) => setTitulo(evento.target.value)} maxLength={120} className="mt-1 w-full rounded-[10px] border border-hairline px-3 py-2 text-[0.86rem] font-semibold text-ink" />
                </label>
              </div>
              <dl className="grid grid-cols-2 gap-3">
                <div className="rounded-[12px] bg-paper p-3"><dd className="text-[1.2rem] font-extrabold text-brand-700">{topicos.length}</dd><dt className="text-[0.72rem] text-muted">tópicos</dt></div>
                <div className="rounded-[12px] bg-paper p-3"><dd className="text-[1.2rem] font-extrabold text-brand-700">{vinculados}</dd><dt className="text-[0.72rem] text-muted">ligados ao acervo</dt></div>
              </dl>
              <label className="flex flex-col gap-1 text-[0.78rem] font-semibold text-body">Data da prova <span className="font-normal text-muted">(opcional)</span><input type="date" value={prazo} onChange={(evento) => setPrazo(evento.target.value)} className="rounded-[10px] border border-hairline px-3 py-2 text-[0.86rem] font-normal text-ink" /></label>
              <label className="flex flex-col gap-1 text-[0.78rem] font-semibold text-body">Horas por semana<input type="number" min={1} max={60} step={0.5} value={horas} onChange={(evento) => setHoras(Number(evento.target.value))} className="rounded-[10px] border border-hairline px-3 py-2 text-[0.86rem] font-normal text-ink" /></label>
              {temPlano && <p className="rounded-[10px] bg-ouro-50 px-3 py-2.5 text-[0.76rem] leading-relaxed text-ouro-700">O roadmap atual será substituído. O progresso da versão anterior continua preservado no banco.</p>}
              {erro && <p role="alert" className="rounded-[10px] bg-vinho-50 px-3 py-2.5 text-[0.8rem] text-vinho-700">{erro}</p>}
              <button type="button" onClick={() => void gerar()} disabled={gerando || topicos.length === 0} className="rounded-full bg-brand-600 px-5 py-3 text-[0.88rem] font-semibold text-white hover:bg-brand-700 disabled:opacity-55">
                {gerando ? "Gerando roadmap…" : "Confirmei — gerar roadmap"}
              </button>
              <p className="text-center text-[0.72rem] leading-relaxed text-muted">Somente os tópicos desta lista serão usados.</p>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
