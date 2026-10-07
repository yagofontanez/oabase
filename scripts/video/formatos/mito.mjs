// "Mito ou verdade da OAB" — um conselho de corredor por vídeo, conferido no
// acervo e narrado. Os números são contagens do banco, recontadas na hora
// (`medidasDaProva` e `distribuicaoDeGabarito`); nada sai além de agregado.
//
// Estrutura curta, por medição: no TikTok a maioria saía em 0:01 e quase
// ninguém chegava ao fim de 30 s. Então: a pergunta (falando com quem vê) já
// inteira no quadro zero, sem marca; o resultado; o carimbo; fecho. ~20 s.
//
// A fala usa número por extenso e arredondado; a tela mostra o exato.

import { pagina, trilha, escapa } from "../motor.mjs";
import { fmt } from "../dados.mjs";
import { extenso, narrar } from "../voz.mjs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const pct = (n, t) => (100 * n) / t;
const pctTela = (x) => x.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
const ORDINAIS = { 3: "terceiro", 7: "sétimo", 8: "oitavo", 19: "décimo nono", 46: "quadragésimo sexto" };
const ordinal = (n) => ORDINAIS[n] ?? `${n}º`;

function mitos(d) {
  const m = d.medidas, g = d.gabarito;
  if (!m) return [];
  const lista = [];

  const longa = pct(m.certaMaisLonga, m.validas), curta = pct(m.certaMaisCurta, m.validas);
  lista.push({
    slug: "alternativa-mais-longa",
    gancho: "Você marca a alternativa mais longa quando não sabe?",
    afirmacao: "Na dúvida, marque a mais longa.",
    abre: "Você marca a alternativa mais longa quando não sabe a resposta?",
    barras: [
      { rotulo: "A certa era a mais longa", valor: longa, tela: pctTela(longa) },
      { rotulo: "A certa era a mais curta", valor: curta, tela: pctTela(curta) },
    ],
    linha: { valor: 25, rotulo: "puro acaso: 25%" },
    resultadoFala: `Em ${extenso(m.validas, true)} questões oficiais, a certa foi a mais longa em ${extenso(Math.round(longa))} por cento. Menos que o acaso.`,
    veredito: "MITO",
    moralFala: "Mito. Quem decide é o conteúdo.",
    legenda: "Você marca a alternativa MAIS LONGA quando não sabe? 🤔",
    comentario: "Qual mito de prova vocês querem que a gente confira no próximo? 👇",
  });

  if (g?.total) {
    const letras = ["A", "B", "C", "D"], tot = letras.reduce((s, l) => s + g.total[l], 0);
    const campea = [...letras].sort((a, b) => g.total[b] - g.total[a])[0];
    const pc = pct(g.total.C, tot);
    lista.push({
      slug: "chuta-c",
      gancho: "Você ainda chuta C na OAB?",
      afirmacao: "Na dúvida, chuta C.",
      abre: "Você ainda chuta C na OAB?",
      barras: letras.map((l) => ({ rotulo: `Letra ${l}`, valor: pct(g.total[l], tot), tela: pctTela(pct(g.total[l], tot)), destaque: l === "C" })),
      linha: { valor: 25, rotulo: "puro acaso: 25%" },
      resultadoFala: campea === "C"
        ? `Em ${extenso(tot, true)} respostas oficiais, a C até ganha. Por um ou dois pontos.`
        : `Em ${extenso(tot, true)} respostas oficiais, a que mais saiu foi a ${campea}. A C ficou com ${extenso(Math.round(pc))} por cento.`,
      veredito: campea === "C" ? "QUASE NADA" : "MITO",
      moralFala: "Chutar letra não é estratégia.",
      legenda: "Você ainda chuta C na OAB? 👀",
      comentario: "Qual letra VOCÊ chuta na dúvida? 👇",
    });
  }

  lista.push({
    slug: "prova-mais-longa",
    gancho: "Sentiu que a prova da OAB tá maior?",
    afirmacao: "A prova da OAB ficou mais longa.",
    abre: "Sentiu que a prova da OAB tá maior?",
    barras: [
      { rotulo: `Do ${m.edicoes.min}º ao ${m.edicoes.min + 4}º Exame`, valor: m.enunciadoInicio, tela: `${fmt(m.enunciadoInicio)} caracteres` },
      { rotulo: `Do ${m.edicoes.max - 4}º ao ${m.edicoes.max}º Exame`, valor: m.enunciadoFim, tela: `${fmt(m.enunciadoFim)} caracteres`, destaque: true },
    ],
    linha: null,
    resultadoFala: `O enunciado médio foi de ${extenso(m.enunciadoInicio)} pra ${extenso(m.enunciadoFim)} caracteres. Quase o dobro.`,
    veredito: "VERDADE",
    moralFala: "Verdade. Treinar leitura também é estudar.",
    legenda: "Sentiu que a prova da OAB tá maior? Medimos 44 provas 📏",
    comentario: "Vocês sentiram a prova mais longa? 👇",
  });

  if (m.corridas) {
    const c = m.corridas;
    lista.push({
      slug: "tres-letras-seguidas",
      gancho: "Já marcou três C seguidas e ficou com medo?",
      afirmacao: "A banca não repete a mesma letra 3 vezes.",
      abre: "Já marcou três C seguidas e ficou com medo de estar errado?",
      barras: [3, 4, 5, 6].filter((k) => c[k]).map((k) => ({ rotulo: `${k} seguidas`, valor: c[k], tela: `${c[k]}×`, destaque: k === 6 })),
      linha: null,
      resultadoFala: `Nas ${extenso(m.provas, true)} provas, a mesma letra saiu três vezes seguidas ou mais ${extenso(m.corridas3, true)} vezes. No ${ordinal(m.maiorCorrida.edicao)} exame, ${extenso(m.maiorCorrida.tam, true)} seguidas.`,
      veredito: "MITO",
      moralFala: "Mito. Se você sabe a resposta, marca.",
      legenda: "Três C seguidas na prova da OAB? Contamos 44 provas 👀",
      comentario: "Qual foi a maior sequência que vocês já marcaram? 👇",
    });
  }

  if (m.provasExatas !== undefined) {
    const md = m.maiorDesequilibrio;
    lista.push({
      slug: "vinte-de-cada-letra",
      gancho: "Você conta quantas A, B, C e D marcou?",
      afirmacao: "Toda prova tem 20 de cada letra.",
      abre: "Você conta quantas A, B, C e D já marcou, pra fechar vinte de cada?",
      barras: [
        { rotulo: "Provas com 20 de cada letra", valor: m.provasExatas, tela: `${m.provasExatas}` },
        { rotulo: "Provas desequilibradas", valor: m.provas - m.provasExatas, tela: `${m.provas - m.provasExatas}`, destaque: true },
      ],
      linha: null,
      resultadoFala: `De ${extenso(m.provas, true)} provas, só ${extenso(m.provasExatas, true)} tiveram vinte de cada letra. No ${ordinal(md.edicao)} exame, uma letra saiu ${extenso(md.min)} vezes, e outra, ${extenso(md.max)}.`,
      veredito: "MITO",
      moralFala: "Mito. Contar letra não acerta questão.",
      legenda: "Toda prova da OAB tem 20 respostas de cada letra? 🤔",
      comentario: "Vocês já mudaram resposta pra 'equilibrar' as letras? 👇",
    });
  }

  if (m.anuladas !== undefined) {
    lista.push({
      slug: "fgv-anula-muito",
      gancho: "Torcendo pra FGV anular aquela questão?",
      afirmacao: "A FGV anula muita questão.",
      abre: "Torcendo pra FGV anular aquela questão que você errou?",
      barras: [
        { rotulo: "Provas sem nenhuma anulada", valor: m.provasSemAnulada, tela: `${m.provasSemAnulada}` },
        { rotulo: "Provas com anulada", valor: m.provas - m.provasSemAnulada, tela: `${m.provas - m.provasSemAnulada}`, destaque: true },
      ],
      linha: null,
      resultadoFala: `Em ${extenso(m.questoes, true)} questões, foram só ${extenso(m.anuladas, true)} anuladas. Menos de meio por cento.`,
      veredito: "MITO",
      moralFala: "Mito. Contar com anulação é contar com a sorte.",
      legenda: "A FGV anula muita questão na OAB? Contamos todas 📋",
      comentario: "Já teve questão que vocês tinham CERTEZA que ia ser anulada? 👇",
    });
  }
  return lista;
}

export const mito = {
  id: "mito",
  nome: "Mito ou verdade",
  ordemFixa: true,
  pool: mitos,

  async roteiro(item, { dia }) {
    const narracao = await narrar(
      [
        { id: "abre", fala: item.abre, min: 2.4 },
        { id: "resultado", fala: item.resultadoFala, min: 4.6 },
        { id: "veredito", fala: item.moralFala, min: 2.6 },
        { id: "fecho", fala: "O quadragésimo sexto exame tá de graça. Link no perfil.", min: 2.6 },
      ],
      join(tmpdir(), `oabase-mito-${item.slug}-${dia.getTime()}`),
    );
    const C = narracao.cenas, FIM = narracao.duracao;
    const escala = Math.max(...item.barras.map((b) => b.valor), item.linha?.valor ?? 0) * 1.18;
    const cor = item.veredito === "VERDADE" ? "#62b39c" : "#dc6b8f";
    const tamGancho = item.gancho.length <= 28 ? 170 : item.gancho.length <= 42 ? 140 : 118;

    const corpo = `
<section class="cena" id="abre" style="padding-top:470px">
  <div class="kicker">Mito ou verdade?</div>
  <h1 id="gancho" style="font-size:${tamGancho}px">${escapa(item.gancho)}</h1>
</section>
<section class="cena" id="resultado" style="padding-top:300px">
  <div class="kicker">${escapa(item.afirmacao)} Contamos:</div>
  <div id="grafico">
    ${item.linha ? `<div id="linha" style="bottom:${(100 * item.linha.valor) / escala}%"></div>` : ""}
    ${item.barras.map((b, i) => `
    <div class="barra${b.destaque ? " destaque" : ""}">
      <div class="coluna"><i id="b${i}" style="--h:${(100 * b.valor) / escala}%"><span class="valor" id="v${i}">${escapa(b.tela)}</span></i></div>
      <div class="rot">${escapa(b.rotulo)}</div>
    </div>`).join("")}
  </div>
  ${item.linha ? `<p id="ref"><i></i>${escapa(item.linha.rotulo)}</p>` : ""}
</section>
<section class="cena" id="veredito" style="padding-top:520px;text-align:center">
  <div class="kicker">${escapa(item.afirmacao)}</div>
  <div id="carimbo" style="--cor:${cor}">${escapa(item.veredito)}</div>
</section>
<section class="cena" id="fecho" style="padding-top:560px;text-align:center">
  <div class="tile" style="width:190px;height:190px;border-radius:48px;font-size:90px;margin:0 auto 60px">OA</div>
  <h1 style="font-size:124px">46º Exame<br><em>de graça.</em></h1>
  <div style="margin-top:56px"><span class="cta">Link no perfil</span></div>
</section>`;

    const css = `
  #gancho{transform-origin:0 50%}
  #grafico{position:relative;margin-top:50px;height:820px;display:flex;align-items:flex-end;justify-content:space-around;gap:26px;padding:0 10px;border-bottom:3px solid #ffffff33}
  .barra{position:relative;flex:1;max-width:260px;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;text-align:center}
  .coluna{width:100%;height:100%;display:flex;align-items:flex-end}
  /* O número fica preso no topo da barra, fora da altura dela: assim a barra
     e a linha de referência são medidas na mesma régua. */
  .coluna i{position:relative;display:block;width:100%;height:0;border-radius:22px 22px 0 0;background:linear-gradient(#62b39c,#0f7a5f)}
  .barra.destaque .coluna i{background:linear-gradient(#f2c06c,#e9a23b)}
  .valor{position:absolute;bottom:100%;left:50%;transform:translateX(-50%);margin-bottom:14px;font-style:normal;background:#041f1c;padding:0 14px;border-radius:14px;font-family:var(--serif);font-weight:600;font-size:56px;color:#eef6f2;opacity:0;white-space:nowrap}
  .rot{position:absolute;bottom:-86px;width:inherit;font-size:26px;font-weight:700;color:#cfe3db;line-height:1.2}
  #linha{position:absolute;left:0;right:0;border-top:4px dashed #e9a23b;z-index:0;opacity:0}
  #ref{margin-top:130px;display:flex;align-items:center;gap:16px;font-size:30px;font-weight:800;color:#e9a23b;opacity:0}
  #ref i{display:block;width:70px;border-top:4px dashed #e9a23b}
  #carimbo{display:inline-block;margin-top:40px;font-size:${item.veredito.length > 6 ? 130 : 190}px;font-weight:800;letter-spacing:6px;color:var(--cor);border:14px solid var(--cor);border-radius:36px;padding:10px 50px;opacity:0}`;

    const js = `
const FIM = ${FIM};
const C = ${JSON.stringify(Object.fromEntries(Object.entries(C).map(([k, v]) => [k, [v.inicio, v.fim]])))};
const N = ${item.barras.length};
window.render = (t) => {
  cena(t, "#abre", C.abre[0], C.abre[1], FIM);
  // Legível no quadro zero (é a capa), mas já em movimento: entra grande e
  // assenta, com um balanço leve até a fala acabar.
  const k = eo(p(t, 0, 0.55));
  $("#gancho").style.transform = "scale(" + (1.1 - 0.1 * k + 0.012 * Math.sin(t * 3.2) * k) + ")";

  cena(t, "#resultado", C.resultado[0], C.resultado[1], FIM);
  for (let i = 0; i < N; i++) {
    const a = C.resultado[0] + 0.3 + i * 0.3;
    $("#b" + i).style.height = "calc(var(--h) * " + eo(p(t, a, a + 0.8)) + ")";
    $("#v" + i).style.opacity = p(t, a + 0.6, a + 0.9);
  }
  const l = $("#linha"); if (l) { l.style.opacity = p(t, C.resultado[0] + 1.4, C.resultado[0] + 1.8); $("#ref").style.opacity = l.style.opacity; }
  cena(t, "#veredito", C.veredito[0], C.veredito[1], FIM);
  const c = p(t, C.veredito[0] + 0.15, C.veredito[0] + 0.45);
  const car = $("#carimbo");
  car.style.opacity = c;
  car.style.transform = "rotate(" + (-8 * c) + "deg) scale(" + (1.8 - 0.8 * back(c)) + ")";
  cena(t, "#fecho", C.fecho[0], FIM, FIM);
};`;

    return {
      slug: `mito-${item.slug}`,
      duracao: FIM,
      html: pagina({ corpo, css, js, pill: "Mito ou verdade", duracao: FIM, escuro: true, marcaApos: C.abre.fim }),
      audio: {
        // O "tum" no quadro zero é o primeiro corte; o ding acompanha o carimbo.
        ...trilha({ duracao: FIM, acorde: [196, 246.94, 293.66], cortes: [0.02, C.resultado.inicio, C.fecho.inicio], dings: [C.veredito.inicio + 0.35] }),
        voz: narracao.arquivo,
      },
      legenda: [item.legenda, "", "Contamos nas provas oficiais, com o gabarito da banca. O 46º Exame inteiro está de graça no link do perfil."].join("\n"),
      hashtags: ["#dicasoab", "#estudos"],
      comentario: item.comentario,
    };
  },
};
