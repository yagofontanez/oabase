import type { Metadata } from "next";
import { RevisaoSemanal } from "@/components/app/revisao-semanal";
import {
  adicionarDias,
  hojeEmBrasilia,
  inicioDaSemana,
} from "@/lib/calendario";
import type {
  AcaoDaRevisao,
  MetricasDaSemana,
  RevisaoSalva,
} from "@/lib/revisao-semanal";
import { supabaseServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = {
  title: "Revisão semanal",
  robots: { index: false, follow: false },
};

function inicioPedido(valor: string | string[] | undefined, atual: string) {
  const candidato = typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor)
    ? inicioDaSemana(valor)
    : atual;
  return candidato > atual ? atual : candidato;
}

export default async function RevisaoSemanalPage({ searchParams }: PageProps<"/app/revisao-semanal">) {
  const consulta = await searchParams;
  const hoje = hojeEmBrasilia();
  const semanaAtual = inicioDaSemana(hoje);
  const inicio = inicioPedido(consulta.semana, semanaAtual);
  const supabase = await supabaseServidor();

  const [{ data: metricasBrutas, error }, { data: salvaBruta }] = await Promise.all([
    supabase.rpc("minha_revisao_semanal", { p_inicio: inicio }),
    supabase
      .from("revisoes_semanais")
      .select("metricas, reflexao, compromisso, acoes")
      .eq("inicio", inicio)
      .maybeSingle(),
  ]);
  if (error || !metricasBrutas) {
    throw new Error(
      `Não foi possível montar a revisão semanal: ${error?.message ?? "resposta vazia"}`,
    );
  }

  // Depois de fechada, uma semana passada precisa continuar mostrando a
  // fotografia que sustentou a decisão — sobretudo a fila de revisões, que
  // muda todos os dias. A semana atual segue viva até acabar.
  const metricas = (
    inicio < semanaAtual && salvaBruta?.metricas
      ? salvaBruta.metricas
      : metricasBrutas
  ) as MetricasDaSemana;
  const salva: RevisaoSalva | null = salvaBruta
    ? {
        reflexao: String(salvaBruta.reflexao ?? ""),
        compromisso: String(salvaBruta.compromisso ?? ""),
        acoes: (salvaBruta.acoes ?? []) as AcaoDaRevisao[],
      }
    : null;

  return (
    <RevisaoSemanal
      key={inicio}
      metricas={metricas}
      salvaInicial={salva}
      semanaAtual={semanaAtual}
      semanaAnterior={adicionarDias(inicio, -7)}
      proximaSemana={adicionarDias(inicio, 7)}
    />
  );
}
