import { PDFDocument, PDFFont, StandardFonts, rgb } from "pdf-lib";
import { getArtigosDaDisciplina, getDisciplinas, getLeis } from "@/lib/content/queries";
import { supabaseServidor } from "@/lib/supabase/servidor";
import type { Plano } from "@/lib/ia/plano";
import type { EstadoDoRoadmap, ItemRoadmap } from "@/lib/roadmap";
import { site } from "@/lib/site";

export const runtime = "nodejs";

const A4 = { largura: 595.28, altura: 841.89, margem: 46 };
const ARTIGOS_POR_DISCIPLINA = 4;
const QUESTOES_POR_DISCIPLINA = 5;

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
    if (fonte.widthOfTextAtSize(palavra, tamanho) > largura) {
      if (linha) linhas.push(linha);
      linha = "";
      let trecho = "";
      for (const caractere of palavra) {
        const candidato = `${trecho}${caractere}`;
        if (trecho && fonte.widthOfTextAtSize(candidato, tamanho) > largura) {
          linhas.push(trecho);
          trecho = caractere;
        } else {
          trecho = candidato;
        }
      }
      linha = trecho;
      continue;
    }
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

type QuestaoDoCaderno = {
  id: string;
  numero: number;
  enunciado: string;
  alternativas: Record<string, string>;
  exame_edicao: number;
};

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
    .select("id, semana, ordem, disciplina, objetivo, horas, estado, anotacao")
    .eq("versao", registro.versao_roadmap)
    .order("semana")
    .order("ordem");
  if (erroRoadmap) return new Response("Não consegui ler o roadmap.", { status: 500 });
  const roadmap = (data ?? []) as ItemRoadmap[];

  // Um caderno por disciplina, sem repetir o mesmo material em toda semana.
  // Questões vêm da função protegida: não há gabarito entre as colunas.
  const [disciplinas, leis] = await Promise.all([
    getDisciplinas().catch((erro) => {
      console.error("Falha ao carregar disciplinas para o PDF:", erro);
      return [];
    }),
    getLeis().catch((erro) => {
      console.error("Falha ao carregar leis para o PDF:", erro);
      return [];
    }),
  ]);
  const slugPorNome = new Map(disciplinas.map((disciplina) => [disciplina.nome, disciplina.slug]));
  const siglaPorLei = new Map(leis.map((lei) => [lei.slug, lei.sigla]));
  const nomesNoPlano = [...new Set(plano.semanas.flatMap((semana) =>
    semana.blocos.map((bloco) => bloco.disciplina),
  ))];
  const recursos = await Promise.all(
    nomesNoPlano.map(async (nome) => {
      const slug = slugPorNome.get(nome);
      if (!slug) return { nome, slug: null, artigos: [], questoes: [] };
      const [artigos, fila] = await Promise.all([
        getArtigosDaDisciplina(slug, ARTIGOS_POR_DISCIPLINA).catch((erro) => {
          console.error(`Falha ao carregar artigos de ${slug} para o PDF:`, erro);
          return [];
        }),
        supabase.rpc("fila_de_questoes", {
          p_modo: "novas",
          p_exame: null,
          p_disciplina: slug,
          p_limite: QUESTOES_POR_DISCIPLINA,
        }),
      ]);
      return {
        nome,
        slug,
        artigos,
        questoes: (fila.data ?? []) as QuestaoDoCaderno[],
      };
    }),
  );

  try {
    const pdf = await PDFDocument.create();
    pdf.setTitle("Guia de estudos personalizado — OABase");
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
      pagina.drawText("OABase  |  Guia de estudos personalizado", {
        x: A4.margem,
        y,
        size: 9,
        font: negrito,
        color: verde,
      });
      y -= 26;
    };
    const escreverTexto = (
      texto: string,
      fonte: PDFFont = regular,
      tamanho = 9,
      cor = tinta,
      larguraMaxima = A4.largura - A4.margem * 2,
      entrelinha = 4,
      recuo = 0,
    ) => {
      const partes = quebrar(texto, fonte, tamanho, larguraMaxima - recuo);
      for (const parte of partes) {
        if (y < A4.margem + 22) novaPagina();
        pagina.drawText(parte, {
          x: A4.margem + recuo,
          y,
          size: tamanho,
          font: fonte,
          color: cor,
        });
        y -= tamanho + entrelinha;
      }
    };
    const tituloDeSecao = (titulo: string, subtitulo: string) => {
      novaPagina();
      pagina.drawText(textoSeguro(titulo, negrito), {
        x: A4.margem,
        y,
        size: 23,
        font: negrito,
        color: tinta,
      });
      y -= 21;
      escreverTexto(subtitulo, regular, 10, cinza);
      y -= 17;
      pagina.drawRectangle({
        x: A4.margem,
        y,
        width: A4.largura - A4.margem * 2,
        height: 4,
        color: ouro,
      });
      y -= 25;
    };

    pagina.drawText("OABase", { x: A4.margem, y, size: 10, font: negrito, color: verde });
    y -= 31;
    pagina.drawText("Guia de estudos personalizado", { x: A4.margem, y, size: 23, font: negrito, color: tinta });
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

    escreverTexto("ESTRATÉGIA DO PLANO", negrito, 8, ouro);
    y -= 3;
    escreverTexto(plano.diagnostico, regular, 10, tinta, undefined, 5);
    if (plano.avisos.length > 0) {
      y -= 8;
      escreverTexto("PONTOS DE ATENÇÃO", negrito, 8, ouro);
      y -= 3;
      for (const aviso of plano.avisos) {
        escreverTexto(`• ${aviso}`, regular, 9, cinza, undefined, 4, 8);
        y -= 3;
      }
    }
    y -= 17;
    escreverTexto("PLANO DE EXECUÇÃO", negrito, 8, ouro);
    y -= 15;

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
        const anotacao = item?.anotacao?.trim()
          ? quebrar(`Anotação: ${item.anotacao}`, regular, 8, larguraBarra - 22)
          : [];
        const alturaBloco = 34 + objetivo.length * 13 + anotacao.length * 11;
        if (y - alturaBloco < A4.margem) novaPagina();
        pagina.drawRectangle({ x: A4.margem, y: y - alturaBloco + 4, width: larguraBarra, height: alturaBloco, color: rgb(0.965, 0.976, 0.969) });
        pagina.drawText(textoSeguro(bloco.disciplina, negrito), { x: A4.margem + 11, y: y - 13, size: 10, font: negrito, color: tinta });
        pagina.drawText(horas(bloco.horas), { x: A4.largura - A4.margem - 35, y: y - 13, size: 9, font: negrito, color: verde });
        objetivo.forEach((linha, indice) => {
          pagina.drawText(linha, { x: A4.margem + 11, y: y - 30 - indice * 13, size: 9, font: regular, color: cinza });
        });
        anotacao.forEach((linha, indice) => {
          pagina.drawText(linha, {
            x: A4.margem + 11,
            y: y - 30 - objetivo.length * 13 - indice * 11,
            size: 8,
            font: regular,
            color: verde,
          });
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

    tituloDeSecao(
      "Caderno de materiais",
      "Leitura legal e questões oficiais separadas pelas matérias do seu plano. O gabarito não aparece aqui: responda no OABase para registrar o resultado e alimentar sua revisão.",
    );
    pagina.drawText("ROTEIRO DE USO", {
      x: A4.margem,
      y,
      size: 8,
      font: negrito,
      color: ouro,
    });
    y -= 18;
    for (const passo of [
      "1. Leia os dispositivos legais e marque os conceitos que precisam de revisão.",
      "2. Faça as questões sem consultar o texto e registre sua alternativa no espaço indicado.",
      "3. Responda novamente dentro do OABase para conferir o gabarito e alimentar seu histórico.",
      "4. Feche a sessão anotando o erro principal e a ação concreta da próxima revisão.",
    ]) {
      escreverTexto(passo, regular, 9, tinta, undefined, 4, 8);
      y -= 3;
    }
    y -= 17;

    for (const recurso of recursos) {
      if (y < 170) novaPagina();
      pagina.drawText(textoSeguro(recurso.nome, negrito), {
        x: A4.margem,
        y,
        size: 18,
        font: negrito,
        color: verde,
      });
      y -= 17;
      escreverTexto(
        recurso.slug
          ? `Material priorizado pela incidência no acervo. Treino completo: ${site.url}/app/questoes?disciplina=${recurso.slug}`
          : "Matéria personalizada sem correspondência direta no acervo.",
        regular,
        8.5,
        cinza,
      );
      y -= 13;

      if (recurso.artigos.length > 0) {
        pagina.drawText("LEITURA RECOMENDADA", {
          x: A4.margem,
          y,
          size: 8,
          font: negrito,
          color: ouro,
        });
        y -= 18;
        for (const artigo of recurso.artigos) {
          if (y < 120) novaPagina();
          const rotulo = `Art. ${artigo.numero} ${siglaPorLei.get(artigo.leiSlug) ?? ""}`.trim();
          pagina.drawText(textoSeguro(rotulo, negrito), {
            x: A4.margem,
            y,
            size: 11,
            font: negrito,
            color: tinta,
          });
          y -= 15;
          escreverTexto(artigo.caput, regular, 9.5, tinta, undefined, 4);
          for (const paragrafo of artigo.paragrafos.slice(0, 2)) {
            y -= 4;
            escreverTexto(paragrafo, regular, 9, cinza, undefined, 4, 8);
          }
          if (artigo.comentario[0]) {
            y -= 6;
            escreverTexto(`Comentário OABase: ${artigo.comentario[0]}`, regular, 8.5, verde, undefined, 4, 8);
          }
          y -= 5;
          escreverTexto(
            `Fonte no acervo: ${site.url}/legislacao/${artigo.leiSlug}/${artigo.slug}`,
            regular,
            7.5,
            cinza,
          );
          y -= 5;
          escreverTexto(
            "[  ] leitura integral   [  ] termos destacados   [  ] resumo concluído",
            negrito,
            7.5,
            verde,
          );
          y -= 16;
        }
      } else {
        escreverTexto(
          "Ainda não há dispositivo legal associado a esta matéria no acervo. Use os materiais indicados pelo professor e registre a fonte nas anotações do bloco.",
          regular,
          9,
          cinza,
        );
        y -= 15;
      }

      if (recurso.questoes.length > 0) {
        if (y < 110) novaPagina();
        pagina.drawText("QUESTÕES PARA RESOLVER", {
          x: A4.margem,
          y,
          size: 8,
          font: negrito,
          color: ouro,
        });
        y -= 20;
        for (const [indice, questao] of recurso.questoes.entries()) {
          if (y < 145) novaPagina();
          pagina.drawText(
            textoSeguro(`${indice + 1}. ${questao.exame_edicao}º Exame - questão ${questao.numero}`, negrito),
            { x: A4.margem, y, size: 10, font: negrito, color: tinta },
          );
          y -= 16;
          escreverTexto(questao.enunciado, regular, 9.2, tinta, undefined, 4);
          y -= 5;
          for (const letra of ["A", "B", "C", "D"]) {
            const alternativa = questao.alternativas[letra];
            if (!alternativa) continue;
            escreverTexto(`${letra}) ${alternativa}`, regular, 8.7, cinza, undefined, 3, 8);
            y -= 2;
          }
          y -= 8;
          pagina.drawText("Minha resposta:  (   ) A   (   ) B   (   ) C   (   ) D", {
            x: A4.margem + 8,
            y,
            size: 8.5,
            font: negrito,
            color: verde,
          });
          y -= 24;
        }
      } else {
        escreverTexto(
          "Nenhuma questão nova desta matéria está disponível para esta conta neste momento.",
          regular,
          9,
          cinza,
        );
        y -= 15;
      }

      if (y < 120) novaPagina();
      pagina.drawText("ANOTAÇÕES DA MATÉRIA", {
        x: A4.margem,
        y,
        size: 8,
        font: negrito,
        color: ouro,
      });
      y -= 16;
      for (let linha = 0; linha < 4; linha += 1) {
        pagina.drawLine({
          start: { x: A4.margem, y },
          end: { x: A4.largura - A4.margem, y },
          thickness: 0.5,
          color: rgb(0.84, 0.88, 0.86),
        });
        y -= 18;
      }
      y -= 20;
    }

    tituloDeSecao(
      "Fechamento semanal",
      "Use estas páginas para comparar o que estava planejado com o que realmente foi executado. As respostas podem orientar o próximo ajuste do plano.",
    );
    for (const semana of plano.semanas) {
      if (y < 210) novaPagina();
      pagina.drawText(`Semana ${semana.numero} - ${textoSeguro(semana.foco, negrito)}`, {
        x: A4.margem,
        y,
        size: 13,
        font: negrito,
        color: verde,
      });
      y -= 24;
      for (const pergunta of [
        "O que eu concluí?",
        "Onde encontrei dificuldade?",
        "O que precisa voltar para a próxima semana?",
      ]) {
        pagina.drawText(pergunta, { x: A4.margem, y, size: 9, font: negrito, color: tinta });
        y -= 14;
        for (let linha = 0; linha < 3; linha += 1) {
          pagina.drawLine({
            start: { x: A4.margem, y },
            end: { x: A4.largura - A4.margem, y },
            thickness: 0.5,
            color: rgb(0.84, 0.88, 0.86),
          });
          y -= 16;
        }
        y -= 8;
      }
      y -= 12;
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
        "Content-Disposition": 'attachment; filename="guia-de-estudos-oabase.pdf"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (erro) {
    console.error("Falha ao gerar PDF do roadmap:", erro);
    return new Response("Não consegui gerar o PDF.", { status: 500 });
  }
}
