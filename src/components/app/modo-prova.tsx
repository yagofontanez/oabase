"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Topico = { titulo: string; dificuldade: 1 | 2 | 3; materiais: string };

const DIFICULDADES = [
  { valor: 1 as const, rotulo: "Tranquilo", detalhe: "já domino" },
  { valor: 2 as const, rotulo: "Médio", detalhe: "preciso revisar" },
  { valor: 3 as const, rotulo: "Difícil", detalhe: "tenho dificuldade" },
];

export function ModoProva() {
  const router = useRouter();
  const [disciplina, setDisciplina] = useState("");
  const [avaliacao, setAvaliacao] = useState("Prova");
  const [prazo, setPrazo] = useState("");
  const [horas, setHoras] = useState(5);
  const [topicos, setTopicos] = useState<Topico[]>([
    { titulo: "", dificuldade: 2, materiais: "" },
  ]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function atualizar(indice: number, mudanca: Partial<Topico>) {
    setTopicos((atuais) => atuais.map((topico, i) => i === indice ? { ...topico, ...mudanca } : topico));
  }

  async function gerar() {
    if (enviando) return;
    const validos = topicos.filter((topico) => topico.titulo.trim().length >= 3);
    if (!disciplina.trim()) return setErro("Informe o nome da disciplina.");
    if (!prazo) return setErro("Informe a data da prova.");
    if (!validos.length) return setErro("Adicione ao menos um tópico válido.");
    setEnviando(true);
    setErro(null);
    const formulario = new FormData();
    formulario.set("acao", "gerar_prova");
    formulario.set("disciplina", disciplina);
    formulario.set("avaliacao", avaliacao);
    formulario.set("prazo", prazo);
    formulario.set("horas", String(horas));
    formulario.set("topicos", JSON.stringify(validos));
    try {
      const resposta = await fetch("/api/ementa", { method: "POST", body: formulario });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro ?? "Não consegui montar a prova.");
      router.push("/app/roadmap");
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Sem conexão com o servidor.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="painel-conteudo flex max-w-[1180px] flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-line pb-5">
        <div>
          <span className="rotulo">Estudo livre de Direito</span>
          <h1 className="mt-1 text-[clamp(1.8rem,3vw,2.45rem)] leading-none font-extrabold tracking-[-0.045em] text-ink">Modo prova da faculdade</h1>
          <p className="mt-2 max-w-[68ch] text-[0.94rem] leading-relaxed text-body">Monte um plano regressivo para uma avaliação específica. A sua percepção de dificuldade guia a prioridade — nenhum peso da OAB entra aqui.</p>
        </div>
        <button type="button" onClick={() => router.push("/app/ementa")} className="rounded-full border border-hairline bg-surface px-4 py-2 text-[0.82rem] font-semibold text-ink hover:border-brand-300 hover:text-brand-700">Importar ementa</button>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_310px]">
        <section className="superficie overflow-hidden">
          <div className="border-b border-line bg-paper px-5 py-4 sm:px-7">
            <span className="rotulo">Dados da avaliação</span>
            <h2 className="mt-1 text-[1.2rem] font-bold text-ink">O que você precisa preparar?</h2>
          </div>
          <div className="flex flex-col gap-5 p-5 sm:p-7">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-[0.82rem] font-semibold text-body">Disciplina<input value={disciplina} onChange={(e) => setDisciplina(e.target.value)} maxLength={120} placeholder="Ex.: Direito Civil III" className="h-12 rounded-[12px] border border-hairline bg-surface px-3.5 text-[0.92rem] font-normal text-ink outline-none focus:border-brand-300" /></label>
              <label className="flex flex-col gap-1.5 text-[0.82rem] font-semibold text-body">Nome ou tipo da avaliação<input value={avaliacao} onChange={(e) => setAvaliacao(e.target.value)} maxLength={120} placeholder="Ex.: Prova 2 — contratos" className="h-12 rounded-[12px] border border-hairline bg-surface px-3.5 text-[0.92rem] font-normal text-ink outline-none focus:border-brand-300" /></label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex min-w-0 flex-col gap-1.5 text-[0.82rem] font-semibold text-body">Data da prova<input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} className="h-12 w-full min-w-0 rounded-[12px] border border-hairline bg-surface px-3.5 text-[0.92rem] font-normal text-ink outline-none focus:border-brand-300" /></label>
              <label className="flex min-w-0 flex-col gap-1.5 text-[0.82rem] font-semibold text-body">Horas disponíveis por semana<span className="flex h-12 items-center rounded-[12px] border border-hairline bg-surface px-3.5 focus-within:border-brand-300"><input type="number" min={1} max={60} step={0.5} value={horas} onChange={(e) => setHoras(Number(e.target.value))} className="h-full w-full min-w-0 bg-transparent text-[0.92rem] font-normal text-ink outline-none" /><span className="text-[0.8rem] font-normal text-muted">horas</span></span></label>
            </div>

            <div className="border-t border-line pt-5">
              <div className="flex flex-wrap items-end justify-between gap-2"><div><span className="rotulo">Conteúdo</span><h2 className="mt-1 text-[1.1rem] font-bold text-ink">Tópicos que cairão na prova</h2></div><span className="text-[0.72rem] text-muted">{topicos.length}/60 tópicos</span></div>
              <p className="mt-1.5 text-[0.78rem] leading-relaxed text-muted">Diga o que precisa estudar, o quanto domina e onde pretende buscar o material.</p>
              <div className="mt-4 flex flex-col gap-3">
                {topicos.map((topico, indice) => (
                  <div key={indice} className="rounded-[16px] border border-hairline bg-paper p-4">
                    <div className="flex items-start gap-3"><span className="mt-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[0.72rem] font-bold text-brand-700">{indice + 1}</span><div className="min-w-0 flex-1"><input value={topico.titulo} onChange={(e) => atualizar(indice, { titulo: e.target.value })} maxLength={180} placeholder="Ex.: formação e extinção dos contratos" className="h-10 w-full rounded-[10px] border border-hairline bg-surface px-3 text-[0.86rem] font-semibold text-ink outline-none focus:border-brand-300" /><div className="mt-2 flex flex-wrap gap-1.5">{DIFICULDADES.map((item) => <button key={item.valor} type="button" onClick={() => atualizar(indice, { dificuldade: item.valor })} className={`rounded-full px-2.5 py-1.5 text-[0.68rem] font-semibold ${topico.dificuldade === item.valor ? item.valor === 3 ? "bg-vinho-100 text-vinho-700" : item.valor === 2 ? "bg-ouro-100 text-ouro-700" : "bg-brand-100 text-brand-700" : "bg-surface text-muted hover:text-body"}`}>{item.rotulo} · {item.detalhe}</button>)}</div></div><button type="button" onClick={() => setTopicos((atuais) => atuais.length > 1 ? atuais.filter((_, i) => i !== indice) : atuais)} title="Remover tópico" className="rounded-full p-1.5 text-muted hover:bg-vinho-50 hover:text-vinho-600">×</button></div>
                    <label className="mt-3 block pl-10 text-[0.72rem] font-semibold text-muted">Materiais indicados <span className="font-normal">(opcional, separados por vírgula)</span><input value={topico.materiais} onChange={(e) => atualizar(indice, { materiais: e.target.value })} maxLength={600} placeholder="Ex.: slides da aula, capítulos 4 e 5, lista do professor" className="mt-1.5 h-9 w-full rounded-[10px] border border-hairline bg-surface px-3 text-[0.76rem] font-normal text-ink outline-none focus:border-brand-300" /></label>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setTopicos((atuais) => atuais.length < 60 ? [...atuais, { titulo: "", dificuldade: 2, materiais: "" }] : atuais)} disabled={topicos.length >= 60} className="mt-4 rounded-full border border-dashed border-brand-200 px-4 py-2 text-[0.78rem] font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50">+ Adicionar tópico</button>
            </div>
            {erro && <p role="alert" className="rounded-[12px] bg-vinho-50 px-4 py-3 text-[0.82rem] text-vinho-700">{erro}</p>}
            <button type="button" onClick={() => void gerar()} disabled={enviando} className="self-start rounded-full bg-brand-700 px-6 py-3 text-[0.88rem] font-bold text-white hover:bg-brand-800 disabled:opacity-50">{enviando ? "Montando roadmap regressivo…" : "Montar roadmap da prova"}</button>
          </div>
        </section>

        <aside className="flex h-fit flex-col gap-4 lg:sticky lg:top-6">
          <section className="rounded-[18px] bg-brand-900 p-5 text-white"><span className="text-[0.7rem] font-bold tracking-[0.12em] text-ouro-200 uppercase">Como funciona</span><h2 className="mt-2 text-[1.08rem] font-bold text-white">O calendário anda de trás para frente.</h2><p className="mt-2 text-[0.8rem] leading-relaxed text-brand-100">Os tópicos difíceis recebem prioridade na primeira passada. A última semana fica protegida para revisão, exercícios e simulado da avaliação.</p><ol className="mt-4 flex flex-col gap-2 text-[0.76rem] text-white/80"><li><strong className="text-ouro-200">1.</strong> Conteúdo organizado</li><li><strong className="text-ouro-200">2.</strong> Dificuldade declarada</li><li><strong className="text-ouro-200">3.</strong> Revisão final reservada</li></ol></section>
          <section className="superficie p-5"><span className="rotulo">Importante</span><p className="mt-2 text-[0.8rem] leading-relaxed text-body">Este plano é seu. A percepção de dificuldade é uma informação sua, não uma classificação automática ou dado de incidência.</p></section>
        </aside>
      </div>
    </div>
  );
}
