import type { Metadata } from "next";
import {
  Quadro,
  type CartaoSalvo,
  type LigacaoSalva,
  type QuestaoDisponivel,
} from "@/components/app/quadro";
import { supabaseServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = {
  title: "Anotações",
  robots: { index: false, follow: false },
};

type LinhaDoNo = {
  id: string;
  tipo: "nota" | "questao";
  questao_id: string | null;
  titulo: string;
  corpo: string;
  cor: CartaoSalvo["cor"];
  x: number;
  y: number;
  largura: number;
};

export default async function AnotacoesPage() {
  const supabase = await supabaseServidor();

  const [nosRes, ligacoesRes, assinaturaRes] = await Promise.all([
    supabase
      .from("quadro_nos")
      .select("id, tipo, questao_id, titulo, corpo, cor, x, y, largura"),
    supabase.from("quadro_ligacoes").select("id, origem, destino, rotulo"),
    supabase
      .from("assinaturas")
      .select("plano")
      .eq("status", "ativa")
      .limit(1),
  ]);

  const nos = (nosRes.data ?? []) as LinhaDoNo[];
  const temPlano = Boolean(assinaturaRes.data?.[0]);

  /* As questões respondidas alimentam o seletor. Sem assinatura a RLS de
     `questoes` devolve zero linhas — o quadro continua funcionando só com
     notas, e o seletor diz por que está vazio em vez de fingir que o acervo
     acabou. */
  const idsNoQuadro = nos
    .map((n) => n.questao_id)
    .filter((id): id is string => Boolean(id));

  const { data: respostas } = await supabase
    .from("respostas")
    .select("questao_id, acertou, respondido_em")
    .order("respondido_em", { ascending: false })
    .limit(400);

  // A última tentativa de cada questão é a que vale: é ela que diz se a
  // questão está resolvida ou ainda dói.
  const ultimaPorQuestao = new Map<string, boolean>();
  for (const r of respostas ?? []) {
    if (!ultimaPorQuestao.has(r.questao_id)) {
      ultimaPorQuestao.set(r.questao_id, r.acertou);
    }
  }
  const idsRespondidas = [...ultimaPorQuestao.keys()];

  let disponiveis: QuestaoDisponivel[] = [];
  if (idsRespondidas.length > 0) {
    const { data: questoes } = await supabase
      .from("questoes")
      .select("id, numero, enunciado, exames(edicao, slug), disciplinas(nome)")
      .in("id", idsRespondidas);

    type LinhaDaQuestao = {
      id: string;
      numero: number;
      enunciado: string;
      exames: { edicao: number; slug: string } | { edicao: number; slug: string }[] | null;
      disciplinas: { nome: string } | { nome: string }[] | null;
    };

    disponiveis = ((questoes ?? []) as unknown as LinhaDaQuestao[]).map((q) => {
      const exame = Array.isArray(q.exames) ? q.exames[0] : q.exames;
      const disciplina = Array.isArray(q.disciplinas)
        ? q.disciplinas[0]
        : q.disciplinas;
      return {
        id: q.id,
        numero: q.numero,
        // Só o bastante para reconhecer a questão no seletor e no cartão.
        // O enunciado inteiro transformaria o quadro num muro de texto.
        resumo: q.enunciado.slice(0, 220),
        edicao: exame?.edicao ?? 0,
        exameSlug: exame?.slug ?? "",
        disciplina: disciplina?.nome ?? null,
        acertou: ultimaPorQuestao.get(q.id) ?? null,
      };
    });
    disponiveis.sort((a, b) => b.edicao - a.edicao || a.numero - b.numero);
  }

  const porId = new Map(disponiveis.map((q) => [q.id, q]));

  const cartoes: CartaoSalvo[] = nos.map((n) => ({
    id: n.id,
    tipo: n.tipo,
    questaoId: n.questao_id,
    titulo: n.titulo,
    corpo: n.corpo,
    cor: n.cor,
    x: n.x,
    y: n.y,
    largura: n.largura,
    questao: n.questao_id ? (porId.get(n.questao_id) ?? null) : null,
  }));

  const ligacoes: LigacaoSalva[] = (ligacoesRes.data ?? []) as LigacaoSalva[];

  return (
    <Quadro
      cartoesIniciais={cartoes}
      ligacoesIniciais={ligacoes}
      questoesDisponiveis={disponiveis.filter(
        (q) => !idsNoQuadro.includes(q.id),
      )}
      temPlano={temPlano}
    />
  );
}
