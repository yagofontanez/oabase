import type { Metadata } from "next";
import Link from "next/link";
import { CompartilharRoadmap } from "@/components/app/compartilhar-roadmap";
import { getProximoExame } from "@/lib/content/queries";
import type {
  OpcaoDeAnotacao,
  OpcaoDeRevisao,
} from "@/lib/compartilhamento-roadmap";
import { linkDaLinha } from "@/lib/compartilhamento-roadmap";
import type { ContextoSalvoDoPlano } from "@/lib/ia/plano";
import { supabaseServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = {
  title: "Compartilhar roadmap",
  robots: { index: false, follow: false },
};

export default async function CompartilharRoadmapPage() {
  const [supabase, proximoExame] = await Promise.all([
    supabaseServidor(),
    getProximoExame(),
  ]);
  const { data: plano, error: erroPlano } = await supabase
    .from("planos_estudo")
    .select("versao_roadmap, contexto")
    .maybeSingle();

  if (erroPlano) {
    throw new Error(`Não foi possível abrir o compartilhamento: ${erroPlano.message}`);
  }

  if (!plano?.versao_roadmap) {
    return (
      <div className="painel-conteudo flex max-w-[900px] flex-col gap-5">
        <span className="rotulo">Acompanhamento privado</span>
        <h1 className="text-[2rem] font-extrabold text-ink">Compartilhar roadmap</h1>
        <section className="superficie p-7">
          <h2 className="text-[1.2rem] font-bold text-ink">Primeiro, monte seu roadmap.</h2>
          <p className="mt-2 max-w-[60ch] text-[0.9rem] leading-relaxed text-body">
            O link é criado a partir da versão atual, então precisa existir um roteiro antes de você escolher o que mostrar.
          </p>
          <Link href="/app/plano" className="mt-5 inline-block rounded-full bg-brand-700 px-5 py-2.5 text-[0.82rem] font-semibold text-white">
            Montar plano
          </Link>
        </section>
      </div>
    );
  }

  const [anotacoesRes, revisoesRes, linksRes] = await Promise.all([
    supabase
      .from("roadmap_itens")
      .select("id, semana, disciplina, objetivo, anotacao")
      .eq("versao", plano.versao_roadmap)
      .neq("anotacao", "")
      .order("semana")
      .order("ordem"),
    supabase
      .from("revisoes_semanais")
      .select("id, inicio, fim, compromisso")
      .order("inicio", { ascending: false })
      .limit(12),
    supabase
      .from("roadmap_compartilhamentos")
      .select("id, titulo, versao, incluir_progresso, anotacoes_itens, revisoes_ids, expira_em, revogado_em, acessos, ultimo_acesso_em, criado_em")
      .order("criado_em", { ascending: false })
      .limit(20),
  ]);

  if (anotacoesRes.error || revisoesRes.error || linksRes.error) {
    throw new Error(
      `Não foi possível carregar as opções: ${anotacoesRes.error?.message ?? revisoesRes.error?.message ?? linksRes.error?.message}`,
    );
  }

  const contexto = (plano.contexto ?? {}) as ContextoSalvoDoPlano;
  const prazo = contexto.modo === "livre" ? contexto.prazo : proximoExame.data;
  const anotacoes = (anotacoesRes.data ?? []).map(
    (linha): OpcaoDeAnotacao => ({
      id: String(linha.id),
      semana: Number(linha.semana),
      disciplina: String(linha.disciplina),
      objetivo: String(linha.objetivo),
      anotacao: String(linha.anotacao),
    }),
  );
  const revisoes = (revisoesRes.data ?? []).map(
    (linha): OpcaoDeRevisao => ({
      id: String(linha.id),
      inicio: String(linha.inicio),
      fim: String(linha.fim),
      compromisso: String(linha.compromisso ?? ""),
    }),
  );

  return (
    <CompartilharRoadmap
      versao={Number(plano.versao_roadmap)}
      prazo={prazo ?? null}
      anotacoes={anotacoes}
      revisoes={revisoes}
      linksIniciais={(linksRes.data ?? []).map((linha) =>
        linkDaLinha(linha as Record<string, unknown>),
      )}
    />
  );
}
