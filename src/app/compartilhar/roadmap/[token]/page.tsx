import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type {
  BlocoCompartilhado,
  RoadmapCompartilhado,
} from "@/lib/compartilhamento-roadmap";
import { formatarData } from "@/lib/format";
import { supabaseAnon } from "@/lib/supabase/client";
import { Wordmark } from "@/components/wordmark";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Roadmap compartilhado",
  description: "Acompanhamento privado e somente para leitura de um roadmap de estudos.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
  referrer: "no-referrer",
};

const ESTADOS = {
  a_estudar: { rotulo: "A estudar", classe: "bg-sunk text-muted", ponto: "bg-hairline" },
  em_andamento: { rotulo: "Em andamento", classe: "bg-ouro-50 text-ouro-700", ponto: "bg-ouro-400" },
  concluido: { rotulo: "Concluído", classe: "bg-brand-50 text-brand-700", ponto: "bg-brand-500" },
} as const;

function duracao(minutos: number) {
  if (minutos < 60) return `${minutos}min`;
  const h = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto ? `${h}h ${resto}min` : `${h}h`;
}

function numero(valor: unknown) {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : 0;
}

function Bloco({ bloco, mostrarProgresso }: { bloco: BlocoCompartilhado; mostrarProgresso: boolean }) {
  const estado = ESTADOS[bloco.estado];
  return (
    <article className="relative grid gap-4 border-b border-line px-5 py-5 last:border-b-0 sm:grid-cols-[1fr_auto] sm:px-6">
      <span className={`absolute top-7 left-0 h-7 w-1 rounded-r-full ${estado.ponto}`} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[0.98rem] font-bold text-ink">{bloco.disciplina}</h3>
          <span className={`rounded-full px-2.5 py-1 text-[0.65rem] font-bold uppercase ${estado.classe}`}>{estado.rotulo}</span>
        </div>
        <p className="mt-1.5 max-w-[70ch] text-[0.84rem] leading-relaxed text-body">{bloco.objetivo}</p>
        {bloco.anotacao && (
          <aside className="mt-3 rounded-[12px] border-l-2 border-ouro-400 bg-ouro-50 px-3.5 py-3">
            <span className="text-[0.64rem] font-bold tracking-[0.1em] text-ouro-700 uppercase">Anotação compartilhada</span>
            <p className="mt-1 whitespace-pre-wrap text-[0.78rem] leading-relaxed text-body">{bloco.anotacao}</p>
          </aside>
        )}
      </div>
      <div className="flex flex-wrap gap-2 sm:max-w-56 sm:justify-end">
        <span className="h-fit rounded-full bg-paper px-3 py-1.5 text-[0.7rem] font-semibold text-body">{numero(bloco.horas).toLocaleString("pt-BR")}h planejadas</span>
        {mostrarProgresso && (
          <>
            <span className="h-fit rounded-full bg-paper px-3 py-1.5 text-[0.7rem] font-semibold text-body">{duracao(numero(bloco.minutosFoco))} de foco</span>
            <span className="h-fit rounded-full bg-paper px-3 py-1.5 text-[0.7rem] font-semibold text-body">{numero(bloco.questoesRespondidas)} questões</span>
            <span className="h-fit rounded-full bg-paper px-3 py-1.5 text-[0.7rem] font-semibold text-body">{numero(bloco.materiaisLidos)} materiais</span>
          </>
        )}
      </div>
    </article>
  );
}

export default async function RoadmapCompartilhadoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!/^[0-9a-f]{64}$/.test(token)) notFound();

  const { data, error } = await supabaseAnon().rpc("roadmap_compartilhado", {
    p_token: token,
  });
  if (error || !data) notFound();
  const roadmap = data as RoadmapCompartilhado;
  const semanas = [...new Set(roadmap.blocos.map((bloco) => bloco.semana))];
  const percentual = roadmap.resumo.blocos
    ? Math.round((roadmap.resumo.concluidos / roadmap.resumo.blocos) * 100)
    : 0;

  return (
    <main className="min-h-screen bg-paper">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-5 py-4 sm:px-7">
          <Link href="/" aria-label="OABase"><Wordmark /></Link>
          <span className="rounded-full border border-brand-100 bg-brand-50 px-3 py-1.5 text-[0.68rem] font-bold text-brand-700 uppercase">Somente leitura</span>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1180px] flex-col gap-6 px-5 py-7 sm:px-7 sm:py-10">
        <section className="overflow-hidden rounded-[26px] bg-brand-900 text-white shadow-[0_22px_60px_rgba(8,58,49,.16)]">
          <div className="grid lg:grid-cols-[1fr_330px]">
            <div className="p-6 sm:p-9">
              <span className="text-[0.7rem] font-bold tracking-[0.14em] text-ouro-200 uppercase">Acompanhamento privado</span>
              <h1 className="mt-3 max-w-[18ch] text-[clamp(2rem,5vw,3.4rem)] leading-[.98] font-extrabold tracking-[-0.055em] text-white">{roadmap.titulo}</h1>
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[0.78rem] text-brand-100">
                <span>Roadmap v{roadmap.versao}</span>
                {roadmap.prazo && <span>Prazo: <strong className="text-white">{formatarData(roadmap.prazo, { day: "2-digit", month: "long", year: "numeric" })}</strong></span>}
                <span>Acesso até {formatarData(roadmap.expiraEm.slice(0, 10))}</span>
              </div>
            </div>
            <div className="border-t border-white/10 bg-white/6 p-6 sm:p-8 lg:border-t-0 lg:border-l">
              <div className="flex items-baseline justify-between gap-4">
                <strong className="text-[2.6rem] leading-none text-white">{percentual}%</strong>
                <span className="text-right text-[0.72rem] text-brand-100">{roadmap.resumo.concluidos} de {roadmap.resumo.blocos}<br />blocos concluídos</span>
              </div>
              <span className="mt-4 block h-2 overflow-hidden rounded-full bg-white/15"><span className="block h-full rounded-full bg-ouro-400" style={{ width: `${percentual}%` }} /></span>
              <div className="mt-5 grid grid-cols-2 gap-2 text-[0.72rem]">
                <span className="rounded-[12px] bg-white/8 px-3 py-2.5"><strong className="block text-[0.95rem] text-white">{numero(roadmap.resumo.horasPlanejadas).toLocaleString("pt-BR")}h</strong><span className="text-brand-100">planejadas</span></span>
                <span className="rounded-[12px] bg-white/8 px-3 py-2.5"><strong className="block text-[0.95rem] text-white">{roadmap.resumo.emAndamento}</strong><span className="text-brand-100">em andamento</span></span>
                {roadmap.incluirProgresso && <>
                  <span className="rounded-[12px] bg-white/8 px-3 py-2.5"><strong className="block text-[0.95rem] text-white">{duracao(numero(roadmap.resumo.minutosFoco))}</strong><span className="text-brand-100">de foco</span></span>
                  <span className="rounded-[12px] bg-white/8 px-3 py-2.5"><strong className="block text-[0.95rem] text-white">{roadmap.resumo.questoesRespondidas ?? 0}</strong><span className="text-brand-100">questões</span></span>
                </>}
              </div>
            </div>
          </div>
        </section>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex flex-col gap-5">
            {semanas.map((semana) => {
              const blocos = roadmap.blocos.filter((bloco) => bloco.semana === semana);
              const concluidos = blocos.filter((bloco) => bloco.estado === "concluido").length;
              return (
                <section key={semana} className="overflow-hidden rounded-[20px] border border-hairline bg-surface shadow-[0_8px_25px_rgba(8,58,49,.04)]">
                  <header className="flex items-center justify-between gap-4 border-b border-line bg-paper px-5 py-3.5 sm:px-6">
                    <div><span className="text-[0.68rem] font-bold tracking-[0.12em] text-brand-700 uppercase">Semana {semana}</span><h2 className="mt-0.5 text-[1rem] font-bold text-ink">{blocos.length} {blocos.length === 1 ? "bloco planejado" : "blocos planejados"}</h2></div>
                    <span className="rounded-full bg-surface px-3 py-1.5 text-[0.7rem] font-semibold text-body">{concluidos}/{blocos.length} feitos</span>
                  </header>
                  {blocos.map((bloco) => <Bloco key={bloco.id} bloco={bloco} mostrarProgresso={roadmap.incluirProgresso} />)}
                </section>
              );
            })}
          </div>

          <aside className="flex flex-col gap-4 lg:sticky lg:top-5">
            <section className="rounded-[18px] border border-hairline bg-surface p-5">
              <span className="rotulo">Escopo deste acesso</span>
              <ul className="mt-3 flex flex-col gap-2 text-[0.76rem] leading-relaxed text-body">
                <li>✓ Roadmap da versão {roadmap.versao}</li>
                <li>{roadmap.incluirProgresso ? "✓" : "—"} Progresso de execução</li>
                <li>✓ {roadmap.blocos.filter((bloco) => bloco.anotacao).length} anotações selecionadas</li>
                <li>✓ {roadmap.revisoes.length} revisões selecionadas</li>
              </ul>
              <p className="mt-4 border-t border-line pt-4 text-[0.68rem] leading-relaxed text-muted">A identidade e os demais dados da conta não fazem parte desta página.</p>
            </section>
            <section className="rounded-[18px] bg-noite p-5 text-white">
              <span className="text-[0.65rem] font-bold tracking-[0.12em] text-ouro-200 uppercase">Para quem acompanha</span>
              <p className="mt-2 text-[0.78rem] leading-relaxed text-brand-100">Use o roteiro e os registros para uma conversa objetiva. Esta tela não permite alterar o plano da pessoa.</p>
            </section>
          </aside>
        </div>

        {roadmap.revisoes.length > 0 && (
          <section className="mt-2">
            <div><span className="rotulo">Contexto além dos números</span><h2 className="mt-1 text-[1.55rem] font-extrabold tracking-[-0.035em] text-ink">Revisões semanais escolhidas</h2></div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {roadmap.revisoes.map((revisao) => {
                const metricas = revisao.metricas;
                const planejadoMinutos = numero(metricas?.planejado?.horas) * 60;
                const executado = numero(metricas?.executado?.minutos);
                const aderencia = planejadoMinutos ? Math.round((executado / planejadoMinutos) * 100) : 0;
                return (
                  <article key={revisao.id} className="rounded-[20px] border border-hairline bg-surface p-5 sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-[0.88rem] text-ink">{formatarData(revisao.inicio)} a {formatarData(revisao.fim)}</strong><span className="rounded-full bg-brand-50 px-2.5 py-1 text-[0.68rem] font-bold text-brand-700">{aderencia}% da carga</span></div>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center"><span className="rounded-[10px] bg-paper p-2"><strong className="block text-[0.95rem] text-ink">{duracao(executado)}</strong><small className="text-[0.62rem] text-muted">foco</small></span><span className="rounded-[10px] bg-paper p-2"><strong className="block text-[0.95rem] text-ink">{numero(metricas?.questoes?.respondidas)}</strong><small className="text-[0.62rem] text-muted">questões</small></span><span className="rounded-[10px] bg-paper p-2"><strong className="block text-[0.95rem] text-ink">{numero(metricas?.roadmap?.concluidos)}</strong><small className="text-[0.62rem] text-muted">blocos</small></span></div>
                    {revisao.reflexao && <div className="mt-4"><span className="text-[0.64rem] font-bold text-muted uppercase">Reflexão</span><p className="mt-1 whitespace-pre-wrap text-[0.78rem] leading-relaxed text-body">{revisao.reflexao}</p></div>}
                    {revisao.compromisso && <div className="mt-4 rounded-[12px] border-l-2 border-ouro-400 bg-ouro-50 px-3.5 py-3"><span className="text-[0.64rem] font-bold text-ouro-700 uppercase">Compromisso</span><p className="mt-1 whitespace-pre-wrap text-[0.78rem] leading-relaxed text-body">{revisao.compromisso}</p></div>}
                  </article>
                );
              })}
            </div>
          </section>
        )}

        <footer className="mt-3 flex flex-col items-center gap-2 border-t border-line pt-6 text-center">
          <Wordmark />
          <p className="max-w-[56ch] text-[0.7rem] leading-relaxed text-muted">Roadmap compartilhado por link privado. O acesso pode expirar ou ser revogado pela pessoa que o criou.</p>
        </footer>
      </div>
    </main>
  );
}
