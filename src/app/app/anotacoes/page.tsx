import type { Metadata } from "next";
import {
  Quadro,
  type CartaoSalvo,
  type DispositivoDoQuadro,
  type LigacaoSalva,
  type QuestaoDisponivel,
} from "@/components/app/quadro";
import { getLeis } from "@/lib/content/queries";
import { supabaseServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = {
  title: "Anotações",
  robots: { index: false, follow: false },
};

type LinhaDoNo = {
  id: string;
  tipo: CartaoSalvo["tipo"];
  questao_id: string | null;
  artigo_id: string | null;
  sumula_id: string | null;
  titulo: string;
  corpo: string;
  cor: CartaoSalvo["cor"];
  x: number;
  y: number;
  largura: number;
};

export default async function AnotacoesPage() {
  const supabase = await supabaseServidor();

  // Duas rodadas, não cinco. Quadro, ligações, plano e respostas não
  // dependem um do outro; questões, artigos e súmulas dependem só da primeira
  // rodada — e iam um depois do outro, cada um uma viagem até o banco.
  const [nosRes, ligacoesRes, assinaturaRes, leis, respostasRes] = await Promise.all([
    supabase
      .from("quadro_nos")
      .select(
        "id, tipo, questao_id, artigo_id, sumula_id, titulo, corpo, cor, x, y, largura",
      ),
    supabase.from("quadro_ligacoes").select("id, origem, destino, rotulo"),
    supabase
      .from("assinaturas")
      .select("plano")
      .eq("status", "ativa")
      .limit(1),
    getLeis(),
    supabase
      .from("respostas")
      .select("questao_id, acertou, respondido_em")
      .order("respondido_em", { ascending: false })
      .limit(400),
  ]);

  const nos = (nosRes.data ?? []) as LinhaDoNo[];
  const respostas = respostasRes.data;
  const temPlano = Boolean(assinaturaRes.data?.[0]);

  /* As questões respondidas alimentam o seletor. Sem assinatura a RLS de
     `questoes` devolve zero linhas — o quadro continua funcionando só com
     notas, e o seletor diz por que está vazio em vez de fingir que o acervo
     acabou. */
  const idsNoQuadro = nos
    .map((n) => n.questao_id)
    .filter((id): id is string => Boolean(id));

  // A última tentativa de cada questão é a que vale: é ela que diz se a
  // questão está resolvida ou ainda dói.
  const ultimaPorQuestao = new Map<string, boolean>();
  for (const r of respostas ?? []) {
    if (!ultimaPorQuestao.has(r.questao_id)) {
      ultimaPorQuestao.set(r.questao_id, r.acertou);
    }
  }
  const idsRespondidas = [...ultimaPorQuestao.keys()];

  const idsArtigos = nos
    .map((n) => n.artigo_id)
    .filter((id): id is string => Boolean(id));
  const idsSumulas = nos
    .map((n) => n.sumula_id)
    .filter((id): id is string => Boolean(id));

  const vazio = Promise.resolve({ data: [] as unknown[] });
  const [questoesRes, artigosRes, sumulasRes] = await Promise.all([
    idsRespondidas.length > 0
      ? supabase
          .from("questoes")
          .select("id, numero, enunciado, exames(edicao, slug), disciplinas(nome)")
          .in("id", idsRespondidas)
      : vazio,
    idsArtigos.length > 0
      ? supabase
          .from("artigos")
          .select("id, numero, slug, caput, comentario, leis(slug, sigla)")
          .in("id", idsArtigos)
      : vazio,
    idsSumulas.length > 0
      ? supabase
          .from("sumulas")
          .select("id, numero, slug, texto, comentario, vinculante")
          .in("id", idsSumulas)
      : vazio,
  ]);

  let disponiveis: QuestaoDisponivel[] = [];
  if (idsRespondidas.length > 0) {
    const questoes = questoesRes.data;

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

  /* Dispositivos presos ao quadro. `artigos` e `sumulas` são leitura aberta,
     então isto vale para quem tem plano e para quem não tem — o cartão de
     lei não é produto pago, é a regra que a pessoa anotou. */
  const dispositivos = new Map<string, DispositivoDoQuadro>();

  if (idsArtigos.length > 0) {
    const data = artigosRes.data;

    type LinhaArtigo = {
      id: string;
      numero: string;
      slug: string;
      caput: string;
      comentario: string[] | null;
      leis:
        | { slug: string; sigla: string }
        | { slug: string; sigla: string }[]
        | null;
    };

    for (const a of (data ?? []) as unknown as LinhaArtigo[]) {
      const lei = Array.isArray(a.leis) ? a.leis[0] : a.leis;
      if (!lei) continue;
      dispositivos.set(a.id, {
        id: a.id,
        tipo: "artigo",
        rotulo: `Art. ${a.numero} ${lei.sigla}`,
        resumo:
          a.caput.length > 260 ? `${a.caput.slice(0, 260)}…` : a.caput,
        href: `/legislacao/${lei.slug}/${a.slug}`,
        comentado: (a.comentario ?? []).length > 0,
      });
    }
  }

  if (idsSumulas.length > 0) {
    const data = sumulasRes.data;

    for (const s of (data ?? []) as {
      id: string;
      numero: number;
      slug: string;
      texto: string;
      comentario: string[] | null;
      vinculante: boolean;
    }[]) {
      dispositivos.set(s.id, {
        id: s.id,
        tipo: "sumula",
        rotulo: s.vinculante
          ? `SV ${s.numero}`
          : `Súmula ${s.numero} do STF`,
        resumo: s.texto,
        href: `/sumulas/${s.slug}`,
        comentado: (s.comentario ?? []).length > 0,
      });
    }
  }

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
    dispositivo:
      dispositivos.get(n.artigo_id ?? n.sumula_id ?? "") ?? null,
  }));

  const ligacoes: LigacaoSalva[] = (ligacoesRes.data ?? []) as LigacaoSalva[];

  return (
    <Quadro
      cartoesIniciais={cartoes}
      ligacoesIniciais={ligacoes}
      questoesDisponiveis={disponiveis.filter(
        (q) => !idsNoQuadro.includes(q.id),
      )}
      leis={leis.map((l) => ({ slug: l.slug, sigla: l.sigla }))}
      temPlano={temPlano}
    />
  );
}
