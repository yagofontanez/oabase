import type { Metadata } from "next";
import Link from "next/link";
import { CalendarioEstudos } from "@/components/app/calendario-estudos";
import type {
  ItemDoCalendario,
  PreferenciasDoCalendario,
} from "@/lib/calendario";
import type { EstadoDoRoadmap } from "@/lib/roadmap";
import { supabaseServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = {
  title: "Calendário de estudos",
  robots: { index: false, follow: false },
};

type LinhaRoadmap = {
  id: string;
  semana: number;
  ordem: number;
  disciplina: string;
  objetivo: string;
  horas: number | string;
  estado: EstadoDoRoadmap;
  data_planejada: string | null;
  horario_planejado: string | null;
  concluido_em: string | null;
};

export default async function CalendarioPage() {
  const supabase = await supabaseServidor();
  const { data: registro } = await supabase
    .from("planos_estudo")
    .select("plano, versao_roadmap")
    .maybeSingle();

  if (!registro?.plano || !registro.versao_roadmap) {
    return (
      <div className="painel-conteudo flex max-w-[920px] flex-col gap-6">
        <header>
          <span className="rotulo">Agenda de execução</span>
          <h1 className="mt-1 text-[clamp(1.8rem,3vw,2.4rem)] leading-none font-extrabold tracking-[-0.045em] text-ink">
            Calendário de estudos
          </h1>
        </header>
        <section className="superficie flex flex-col items-start gap-3 p-7 sm:p-9">
          <h2 className="text-[1.2rem] font-bold text-ink">Seu calendário começa no roadmap</h2>
          <p className="max-w-[60ch] text-[0.9rem] leading-relaxed text-body">
            Monte o plano primeiro. Cada bloco será distribuído em dias reais sem criar uma segunda lista de tarefas.
          </p>
          <Link href="/app/plano" className="rounded-full bg-brand-600 px-5 py-2.5 text-[0.86rem] font-semibold text-white hover:bg-brand-700">
            Montar meu plano
          </Link>
        </section>
      </div>
    );
  }

  const [{ data: linhas }, { data: preferencia }] = await Promise.all([
    supabase
      .from("roadmap_itens")
      .select(
        "id, semana, ordem, disciplina, objetivo, horas, estado, data_planejada, horario_planejado, concluido_em",
      )
      .eq("versao", registro.versao_roadmap)
      .order("semana")
      .order("ordem"),
    supabase.from("calendario_preferencias").select("*").maybeSingle(),
  ]);
  const itens: ItemDoCalendario[] = ((linhas ?? []) as unknown as LinhaRoadmap[]).map(
    (linha) => ({
      id: linha.id,
      semana: linha.semana,
      ordem: linha.ordem,
      disciplina: linha.disciplina,
      objetivo: linha.objetivo,
      horas: Number(linha.horas),
      estado: linha.estado,
      dataPlanejada: linha.data_planejada,
      horarioPlanejado: linha.horario_planejado?.slice(0, 5) ?? null,
      concluidoEm: linha.concluido_em,
    }),
  );
  const preferencias: PreferenciasDoCalendario = {
    diasIndisponiveis: Array.isArray(preferencia?.dias_indisponiveis)
      ? preferencia.dias_indisponiveis.map(Number)
      : [],
    datasIndisponiveis: Array.isArray(preferencia?.datas_indisponiveis)
      ? preferencia.datas_indisponiveis.map(String)
      : [],
    horarioPreferido: String(preferencia?.horario_preferido ?? "19:00").slice(0, 5),
    lembreteEmail: Boolean(preferencia?.lembrete_email),
  };

  return (
    <CalendarioEstudos
      itensIniciais={itens}
      preferenciasIniciais={preferencias}
    />
  );
}
