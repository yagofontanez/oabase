import { PDFDocument, PDFFont, StandardFonts, rgb } from "pdf-lib";
import { supabaseServidor } from "@/lib/supabase/servidor";
import type { Plano } from "@/lib/ia/plano";
import type { EstadoDoRoadmap, ItemRoadmap } from "@/lib/roadmap";

export const runtime = "nodejs";

const A4 = { largura: 595.28, altura: 841.89, margem: 46 };

function horas(valor: number) {
  if (valor % 1 === 0) return `${valor}h`;
  return `${Math.floor(valor)}h${String(Math.round((valor % 1) * 60)).padStart(2, "0")}`;
}

function estado(estadoAtual: EstadoDoRoadmap) {
  return {
    a_estudar: "A estudar",
    em_andamento: "Em andamento",
    concluido: "Concluído",
  }[estadoAtual];
}

/** Helvetica usa WinAnsi. Troca pontuação tipográfica e remove somente o
 * caractere que a fonte realmente não consegue codificar; assim um emoji
 * eventual da IA não derruba o documento inteiro. */
function textoSeguro(texto: string, fonte: PDFFont) {
  const normalizado = texto
    .normalize("NFC")
    .replace(/[—–]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return [...normalizado]
    .map((caractere) => {
      try {
        fonte.encodeText(caractere);
        return caractere;
      } catch {
        return "";
      }
    })
    .join("");
}

function quebrar(texto: string, fonte: PDFFont, tamanho: number, largura: number) {
  const palavras = textoSeguro(texto, fonte).split(" ");
  const linhas: string[] = [];
  let linha = "";
  for (const palavra of palavras) {
    const candidata = linha ? `${linha} ${palavra}` : palavra;
    if (!linha || fonte.widthOfTextAtSize(candidata, tamanho) <= largura) {
      linha = candidata;
    } else {
      linhas.push(linha);
      linha = palavra;
    }
  }
  if (linha) linhas.push(linha);
  return linhas;
}

export async function GET() {
  const supabase = await supabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Sessão expirada.", { status: 401 });

  const { data: registro, error: erroPlano } = await supabase
    .from("planos_estudo")
    .select("plano, versao_roadmap")
    .maybeSingle();
  if (erroPlano || !registro?.plano) {
    return new Response("Monte um plano antes de baixar o PDF.", { status: 404 });
  }
  const plano = registro.plano as Plano;
  const { data, error: erroRoadmap } = await supabase
    .from("roadmap_itens")
    .select("id, semana, ordem, disciplina, objetivo, horas, estado")
    .eq("versao", registro.versao_roadmap)
    .order("semana")
    .order("ordem");
  if (erroRoadmap) return new Response("Não consegui ler o roadmap.", { status: 500 });
  const roadmap = (data ?? []) as ItemRoadmap[];

  try {
    const pdf = await PDFDocument.create();
    pdf.setTitle("Roadmap de estudos — OABase");
    pdf.setAuthor("OABase");
    pdf.setCreator("OABase");
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
    const tinta = rgb(0.086, 0.125, 0.114);
    const verde = rgb(0.043, 0.384, 0.314);
    const verdeClaro = rgb(0.922, 0.961, 0.945);
    const ouro = rgb(0.914, 0.635, 0.231);
    const cinza = rgb(0.486, 0.541, 0.522);
    let pagina = pdf.addPage([A4.largura, A4.altura]);
    let y = A4.altura - A4.margem;

    const novaPagina = () => {
      pagina = pdf.addPage([A4.largura, A4.altura]);
      y = A4.altura - A4.margem;
      pagina.drawText("OABase  |  Roadmap de estudos", {
        x: A4.margem,
        y,
        size: 9,
        font: negrito,
        color: verde,
      });
      y -= 26;
    };

    pagina.drawText("OABase", { x: A4.margem, y, size: 10, font: negrito, color: verde });
    y -= 31;
    pagina.drawText("Roadmap de estudos", { x: A4.margem, y, size: 25, font: negrito, color: tinta });
    y -= 17;
    pagina.drawText("Plano acionável, com o progresso registrado até agora.", {
      x: A4.margem,
      y,
      size: 10,
      font: regular,
      color: cinza,
    });
    y -= 28;

    const concluidos = roadmap.filter((item) => item.estado === "concluido");
    const horasConcluidas = concluidos.reduce((total, item) => total + Number(item.horas), 0);
    const horasPlanejadas = plano.semanas.reduce(
      (total, semana) => total + semana.blocos.reduce((soma, bloco) => soma + bloco.horas, 0),
      0,
    );
    pagina.drawRectangle({
      x: A4.margem,
      y: y - 54,
      width: A4.largura - A4.margem * 2,
      height: 54,
      color: verdeClaro,
    });
    const resumo = [
      [`${concluidos.length}/${roadmap.length}`, "blocos concluídos"],
      [horas(horasConcluidas), "horas concluídas"],
      [horas(horasPlanejadas), "horas planejadas"],
    ];
    resumo.forEach(([valor, rotulo], indice) => {
      const x = A4.margem + 15 + indice * 160;
      pagina.drawText(valor, { x, y: y - 20, size: 15, font: negrito, color: verde });
      pagina.drawText(rotulo, { x, y: y - 37, size: 8, font: regular, color: cinza });
    });
    y -= 72;
    const larguraBarra = A4.largura - A4.margem * 2;
    pagina.drawRectangle({ x: A4.margem, y, width: larguraBarra, height: 7, color: rgb(0.84, 0.88, 0.86) });
    pagina.drawRectangle({
      x: A4.margem,
      y,
      width: larguraBarra * (roadmap.length ? concluidos.length / roadmap.length : 0),
      height: 7,
      color: ouro,
    });
    y -= 29;

    for (const semana of plano.semanas) {
      if (y < 135) novaPagina();
      pagina.drawRectangle({ x: A4.margem, y: y - 5, width: 4, height: 29, color: ouro });
      pagina.drawText(`SEMANA ${semana.numero}`, { x: A4.margem + 13, y: y + 10, size: 8, font: negrito, color: verde });
      const foco = quebrar(semana.foco, negrito, 14, larguraBarra - 13)[0] ?? `Semana ${semana.numero}`;
      pagina.drawText(foco, { x: A4.margem + 13, y: y - 6, size: 14, font: negrito, color: tinta });
      y -= 36;

      for (const [ordem, bloco] of semana.blocos.entries()) {
        const item = roadmap.find((atual) => atual.semana === semana.numero && atual.ordem === ordem);
        const estadoAtual = item?.estado ?? "a_estudar";
        const objetivo = quebrar(bloco.objetivo, regular, 9, larguraBarra - 110);
        const alturaBloco = 34 + objetivo.length * 13;
        if (y - alturaBloco < A4.margem) novaPagina();
        pagina.drawRectangle({ x: A4.margem, y: y - alturaBloco + 4, width: larguraBarra, height: alturaBloco, color: rgb(0.965, 0.976, 0.969) });
        pagina.drawText(textoSeguro(bloco.disciplina, negrito), { x: A4.margem + 11, y: y - 13, size: 10, font: negrito, color: tinta });
        pagina.drawText(horas(bloco.horas), { x: A4.largura - A4.margem - 35, y: y - 13, size: 9, font: negrito, color: verde });
        objetivo.forEach((linha, indice) => {
          pagina.drawText(linha, { x: A4.margem + 11, y: y - 30 - indice * 13, size: 9, font: regular, color: cinza });
        });
        pagina.drawText(estado(estadoAtual), {
          x: A4.largura - A4.margem - 88,
          y: y - alturaBloco + 14,
          size: 7.5,
          font: negrito,
          color: estadoAtual === "concluido" ? verde : estadoAtual === "em_andamento" ? rgb(0.55, 0.33, 0.06) : cinza,
        });
        y -= alturaBloco + 7;
      }
      y -= 10;
    }

    const paginas = pdf.getPages();
    paginas.forEach((folha, indice) => {
      folha.drawText(`Página ${indice + 1} de ${paginas.length}`, {
        x: A4.largura - A4.margem - 58,
        y: 22,
        size: 8,
        font: regular,
        color: cinza,
      });
    });
    const bytes = new Uint8Array(await pdf.save());
    const corpo = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    return new Response(corpo, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="roadmap-de-estudos-oabase.pdf"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (erro) {
    console.error("Falha ao gerar PDF do roadmap:", erro);
    return new Response("Não consegui gerar o PDF.", { status: 500 });
  }
}
