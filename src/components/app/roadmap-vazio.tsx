"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function RoadmapVazio({ temPlano }: { temPlano: boolean }) {
  const router = useRouter();
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function criar() {
    if (criando) return;
    setCriando(true);
    setErro(null);
    try {
      const resposta = await fetch("/api/roadmap", { method: "POST" });
      const dados = await resposta.json();
      if (!resposta.ok || !Array.isArray(dados.roadmap) || dados.roadmap.length === 0) {
        setErro(dados.erro ?? "Não consegui criar o roadmap agora.");
        return;
      }
      router.refresh();
    } catch {
      setErro("Sem conexão com o servidor. Tente novamente.");
    } finally {
      setCriando(false);
    }
  }

  return (
    <div className="painel-conteudo flex max-w-[980px] flex-col gap-6">
      <header>
        <span className="rotulo">Mesa de execução</span>
        <h1 className="mt-1 text-[clamp(1.8rem,3vw,2.35rem)] leading-none font-extrabold tracking-[-0.045em] text-ink">
          Seu roadmap
        </h1>
        <p className="mt-2 max-w-[60ch] text-[0.94rem] text-body">
          Organize o caminho, acompanhe o progresso e abra cada matéria com a leitura e as questões certas.
        </p>
      </header>

      <section className="superficie-alta overflow-hidden">
        <div className="relative overflow-hidden bg-brand-900 px-6 py-8 text-white sm:px-9 sm:py-10">
          <div aria-hidden="true" className="absolute -top-20 right-0 h-56 w-56 rounded-full bg-ouro-400/15 blur-2xl" />
          <div className="relative max-w-[62ch]">
            <span className="text-[0.74rem] font-bold tracking-[0.14em] text-ouro-200 uppercase">
              {temPlano ? "Plano encontrado" : "Primeiro passo"}
            </span>
            <h2 className="mt-3 text-[clamp(1.4rem,3vw,2rem)] font-extrabold tracking-[-0.035em] text-white">
              {temPlano
                ? "Seu cronograma ainda não virou um roadmap interativo"
                : "Monte um plano para liberar o roadmap"}
            </h2>
            <p className="mt-2 text-[0.92rem] leading-relaxed text-white/70">
              {temPlano
                ? "O cronograma está salvo. Falta apenas transformar os blocos em etapas que você pode iniciar, concluir e anotar."
                : "Diga o que quer estudar, quanto tempo tem e o prazo. O sistema monta o cronograma e cria as etapas automaticamente."}
            </p>
          </div>
        </div>

        <div className="grid gap-0 divide-y divide-line px-6 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-0">
          {[
            ["01", "Sequência", "Blocos ordenados por semana e prioridade."],
            ["02", "Execução", "Lei, questões e anotações na mesma tela."],
            ["03", "Progresso", "O que foi concluído permanece registrado."],
          ].map(([numero, titulo, texto]) => (
            <div key={numero} className="py-5 sm:px-6 sm:py-6">
              <span className="text-[0.72rem] font-extrabold text-ouro-600">{numero}</span>
              <h3 className="mt-1 text-[0.95rem] font-bold text-ink">{titulo}</h3>
              <p className="mt-1 text-[0.8rem] leading-relaxed text-muted">{texto}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-line bg-paper px-6 py-5 sm:px-9">
          {temPlano ? (
            <button
              type="button"
              onClick={() => void criar()}
              disabled={criando}
              className="rounded-full bg-brand-600 px-5 py-2.5 text-[0.9rem] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-55"
            >
              {criando ? "Criando roadmap…" : "Criar roadmap agora"}
            </button>
          ) : (
            <Link
              href="/app/plano"
              className="rounded-full bg-brand-600 px-5 py-2.5 text-[0.9rem] font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Montar meu plano
            </Link>
          )}
          <Link href="/app/hoje" className="text-[0.86rem] font-semibold text-brand-700 underline decoration-brand-200 underline-offset-4">
            Voltar para a sessão de hoje
          </Link>
          {erro && <p role="alert" className="w-full text-[0.84rem] text-vinho-600">{erro}</p>}
        </div>
      </section>
    </div>
  );
}
