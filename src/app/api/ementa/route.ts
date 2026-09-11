import { NextResponse } from "next/server";
import { getDisciplinas } from "@/lib/content/queries";
import {
  montarPlanoDaEmenta,
  organizarEmenta,
  type TopicoDaEmenta,
} from "@/lib/ia/ementa";
import { ErroDeLimite, type ContextoSalvoDoPlano, type Mensagem } from "@/lib/ia/plano";
import { blocosDoPlano } from "@/lib/roadmap";
import { supabaseServidor } from "@/lib/supabase/servidor";

export const runtime = "nodejs";

// O deploy usa função com payload binário codificado em base64. Quatro MB
// deixam folga dentro do teto efetivo da plataforma, inclusive para o multipart.
const MAX_ARQUIVO = 4 * 1024 * 1024;
const MAX_TEXTO = 18_000;
const MAX_TOPICOS = 60;

class ErroDeEntrada extends Error {}

function textoDoCampo(valor: FormDataEntryValue | null, limite: number) {
  return typeof valor === "string" ? valor.replace(/\s+/g, " ").trim().slice(0, limite) : "";
}

function hojeEmBrasilia() {
  const partes = new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).formatToParts(new Date());
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((parte) => parte.type === tipo)?.value ?? "";
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

function diasEntreDatas(inicio: string, fim: string) {
  const [anoInicio, mesInicio, diaInicio] = inicio.split("-").map(Number);
  const [anoFim, mesFim, diaFim] = fim.split("-").map(Number);
  return Math.max(
    0,
    Math.round(
      (Date.UTC(anoFim, mesFim - 1, diaFim) -
        Date.UTC(anoInicio, mesInicio - 1, diaInicio)) /
        86_400_000,
    ),
  );
}

async function extrairEntrada(formulario: FormData) {
  const arquivo = formulario.get("arquivo");
  const textoDigitado = typeof formulario.get("texto") === "string"
    ? String(formulario.get("texto")).trim()
    : "";
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { texto: textoDigitado, paginas: null as number | null };
  }
  if (arquivo.size > MAX_ARQUIVO) throw new ErroDeEntrada("O PDF pode ter no máximo 4 MB.");
  const parecePdf =
    arquivo.type === "application/pdf" || arquivo.name.toLowerCase().endsWith(".pdf");
  if (!parecePdf) throw new ErroDeEntrada("Envie um arquivo PDF válido.");
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const assinatura = new TextDecoder("ascii").decode(bytes.slice(0, 5));
  if (assinatura !== "%PDF-") throw new ErroDeEntrada("O arquivo enviado não é um PDF válido.");
  const { extractText } = await import("unpdf");
  const extraido = await extractText(bytes, { mergePages: true });
  if (extraido.totalPages > 60) throw new ErroDeEntrada("O PDF pode ter no máximo 60 páginas.");
  return { texto: extraido.text.trim(), paginas: extraido.totalPages };
}

function lerTopicos(valor: FormDataEntryValue | null, disciplinasPermitidas: Set<string>) {
  if (typeof valor !== "string") return [];
  let bruto: unknown;
  try {
    bruto = JSON.parse(valor);
  } catch {
    return [];
  }
  if (!Array.isArray(bruto)) return [];
  const vistos = new Set<string>();
  const topicos: TopicoDaEmenta[] = [];
  for (const item of bruto.slice(0, MAX_TOPICOS)) {
    if (!item || typeof item !== "object") continue;
    const linha = item as Record<string, unknown>;
    const titulo = String(linha.titulo ?? "").replace(/\s+/g, " ").trim().slice(0, 180);
    const chave = titulo.toLocaleLowerCase("pt-BR");
    if (titulo.length < 3 || vistos.has(chave)) continue;
    vistos.add(chave);
    const disciplina = String(linha.disciplina ?? "").trim();
    topicos.push({
      titulo,
      disciplina: disciplinasPermitidas.has(disciplina) ? disciplina : null,
    });
  }
  return topicos;
}

export async function POST(request: Request) {
  const supabase = await supabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });

  let formulario: FormData;
  try {
    formulario = await request.formData();
  } catch {
    return NextResponse.json({ erro: "Não consegui ler os dados enviados." }, { status: 400 });
  }
  const acao = formulario.get("acao");
  const disciplinas = await getDisciplinas();

  if (acao === "organizar") {
    try {
      const entrada = await extrairEntrada(formulario);
      const textoLimpo = entrada.texto.replace(/\0/g, "").trim();
      if (textoLimpo.length < 20) {
        return NextResponse.json(
          { erro: "Não encontrei texto suficiente. Se o PDF for escaneado, cole a ementa como texto." },
          { status: 400 },
        );
      }
      const truncado = textoLimpo.length > MAX_TEXTO;
      const organizada = await organizarEmenta(
        textoLimpo.slice(0, MAX_TEXTO),
        disciplinas,
        textoDoCampo(formulario.get("titulo"), 120),
      );
      return NextResponse.json({ ...organizada, paginas: entrada.paginas, truncado });
    } catch (erro) {
      console.error("Falha ao organizar ementa:", erro);
      if (erro instanceof ErroDeLimite) {
        return NextResponse.json(
          { erro: "A IA atingiu o limite de uso. Tente novamente em um minuto." },
          { status: 429 },
        );
      }
      return NextResponse.json(
        {
          erro:
            erro instanceof ErroDeEntrada
              ? erro.message
              : "Não consegui ler e organizar a ementa. Se o PDF for escaneado, cole o texto manualmente.",
        },
        { status: 422 },
      );
    }
  }

  if (acao !== "gerar") {
    return NextResponse.json({ erro: "Ação inválida." }, { status: 400 });
  }

  const permitidas = new Set(disciplinas.map((disciplina) => disciplina.nome));
  const topicos = lerTopicos(formulario.get("topicos"), permitidas);
  const titulo = textoDoCampo(formulario.get("titulo"), 120) || "Plano da disciplina";
  const horasBrutas = Number(formulario.get("horas"));
  const horasPorSemana = Number.isFinite(horasBrutas)
    ? Math.min(60, Math.max(1, Math.round(horasBrutas * 2) / 2))
    : 5;
  const prazoBruto = textoDoCampo(formulario.get("prazo"), 10);
  const prazo = /^\d{4}-\d{2}-\d{2}$/.test(prazoBruto) ? prazoBruto : null;
  const hoje = hojeEmBrasilia();
  if (topicos.length === 0) {
    return NextResponse.json({ erro: "Confirme ao menos um tópico da ementa." }, { status: 400 });
  }
  if (prazo && prazo < hoje) {
    return NextResponse.json({ erro: "A data da prova precisa ser hoje ou uma data futura." }, { status: 400 });
  }
  const semanasDisponiveis = prazo
    ? Math.max(1, Math.ceil(diasEntreDatas(hoje, prazo) / 7))
    : Math.min(6, Math.max(1, Math.ceil(topicos.length / 4)));
  const plano = montarPlanoDaEmenta({
    titulo,
    topicos,
    horasPorSemana,
    semanasDisponiveis,
    prazo,
  });

  const { data: registro } = await supabase
    .from("planos_estudo")
    .select("conversa, versao_roadmap")
    .maybeSingle();
  const conversaAnterior = Array.isArray(registro?.conversa)
    ? (registro.conversa as Mensagem[])
    : [];
  const registroDaImportacao: Mensagem[] = [
    {
      papel: "pessoa",
      texto: `Importei a ementa “${titulo}” com ${topicos.length} tópicos e ${horasPorSemana}h por semana.`,
    },
    { papel: "assistente", texto: plano.diagnostico },
  ];
  const conversa: Mensagem[] = [...conversaAnterior, ...registroDaImportacao].slice(-20);
  const disciplinasDoAcervo = [...new Set(
    topicos.flatMap((topico) => (topico.disciplina ? [topico.disciplina] : [])),
  )];
  const contexto: ContextoSalvoDoPlano = {
    modo: "livre",
    disciplinas: disciplinasDoAcervo,
    prazo,
    origem: "ementa",
    ementa: { titulo, horasPorSemana, topicos },
  };
  const versaoRoadmap = (registro?.versao_roadmap ?? 0) + 1;
  const { error: erroPlano } = await supabase.from("planos_estudo").upsert(
    {
      user_id: user.id,
      plano,
      conversa,
      contexto,
      versao_roadmap: versaoRoadmap,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (erroPlano) {
    console.error("Falha ao salvar plano de ementa:", erroPlano);
    return NextResponse.json({ erro: "O plano foi montado, mas não consegui salvar." }, { status: 500 });
  }
  const { data: roadmap, error: erroRoadmap } = await supabase
    .from("roadmap_itens")
    .upsert(
      blocosDoPlano(plano).map((bloco) => ({
        user_id: user.id,
        versao: versaoRoadmap,
        ...bloco,
      })),
      { onConflict: "user_id,versao,semana,ordem" },
    )
    .select("id, semana, ordem, disciplina, objetivo, horas, estado");
  if (erroRoadmap) {
    console.error("Falha ao criar roadmap da ementa:", erroRoadmap);
    return NextResponse.json({
      plano,
      roadmap: [],
      aviso: "O plano foi salvo, mas o roadmap precisa ser criado novamente.",
    });
  }
  const { error: erroHistorico } = await supabase.rpc(
    "registrar_versao_roadmap",
    {
      p_versao: versaoRoadmap,
      p_origem: "ementa",
      p_motivo: `Ementa “${titulo}” importada com ${topicos.length} tópicos e ${horasPorSemana}h por semana.`.slice(0, 500),
      p_diagnostico: plano.diagnostico,
      p_plano: plano,
      p_contexto: contexto,
      p_versao_anterior: registro?.versao_roadmap || null,
    },
  );
  if (erroHistorico) {
    console.error("Falha ao detalhar histórico da ementa:", erroHistorico);
  }
  return NextResponse.json({ plano, roadmap: roadmap ?? [] });
}
