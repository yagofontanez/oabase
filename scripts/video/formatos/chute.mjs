// "Na dúvida, chuta C." — cada questão oficial vira uma bolinha que cai na
// coluna da sua resposta certa. A crença popular abre o vídeo; a contagem
// fecha. E a conclusão é a honesta: a diferença entre as letras é pequena
// demais para ser estratégia — estratégia é saber o que cai.
//
// Versão do acervo inteiro e uma por prova (80 bolinhas). Só sai contagem
// agregada do banco (ver `distribuicaoDeGabarito` em dados.mjs).

import { pagina, trilha, escapa } from "../motor.mjs";
import { fmt } from "../dados.mjs";

const LETRAS = ["A", "B", "C", "D"];
const CORES = { A: "#62b39c", B: "#e9a23b", C: "#dc6b8f", D: "#8fb3ff" };
const pct = (n, t) => ((100 * n) / t).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const chute = {
  id: "chute",
  nome: "Chuta C?",
  ordemFixa: true,
  pool(d) {
    if (!d.gabarito) return [];
    const { porExame, total, anuladas } = d.gabarito;
    const provas = Object.keys(porExame).filter((k) => k !== "total").sort((a, b) => Number(b) - Number(a));
    // Tamanho do acervo contado, não escrito: número fixo em texto envelhece.
    const acervo = LETRAS.reduce((s, l) => s + total[l], 0) + anuladas;
    return [
      { rotulo: null, contagem: total, anuladas, provas: provas.length, acervo },
      ...provas.map((p) => ({ rotulo: `${p}º Exame`, contagem: porExame[p], anuladas: 0, provas: 1, acervo })),
    ];
  },

  roteiro({ rotulo, contagem, anuladas, provas, acervo }) {
    const total = LETRAS.reduce((s, l) => s + contagem[l], 0);
    const ordem = [...LETRAS].sort((a, b) => contagem[b] - contagem[a]);
    const campea = ordem[0];
    const menor = ordem.at(-1);
    const distancia = (100 * (contagem[campea] - contagem[menor])) / total;
    const cTexto = campea === "C" ? "O C ganhou — mas por pouco." : `C nem é a campeã: deu ${campea}.`;

    const H = 2.4; // fim do gancho
    const CHUVA = [H + 0.3, H + 4.2];
    const R = CHUVA[1] + 1.2; // revelação
    const M = R + 3.4; // moral
    const F = M + 3.8; // fecho
    const FIM = F + 3.6;

    const escopo = rotulo ? `do ${rotulo}` : `de ${provas} provas da OAB`;
    const corpo = `
<section class="cena" id="gancho" style="padding-top:520px">
  <div class="kicker">${rotulo ? escapa(rotulo) : "Mito de prova"}</div>
  <h1 style="font-size:150px">Na dúvida,<br><span id="chuta">chuta <em>C</em>.</span></h1>
  <p class="sub" id="sera">Será? Contamos as ${fmt(total)} respostas oficiais ${escapa(escopo)}.</p>
</section>
<section class="cena" id="palco" style="padding-top:250px">
  <div class="kicker" id="titulo-palco">Cada bolinha é uma questão oficial</div>
  <h1 id="manchete" style="font-size:92px;min-height:200px"></h1>
</section>
<canvas id="chuva" width="1080" height="1920"></canvas>
<div id="colunas">${LETRAS.map((l) => `
  <div class="col" data-l="${l}" style="--c:${CORES[l]}">
    <div class="num" id="n${l}">0</div>
    <div class="pc" id="p${l}">${pct(contagem[l], total)}%</div>
    <div class="letra">${l}</div>
  </div>`).join("")}
</div>
<section class="cena" id="moral" style="padding-top:560px">
  <div class="kicker">O que isso significa</div>
  <h1 style="font-size:104px">Entre a letra que mais e a que menos saiu: <em>${distancia.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} pontos</em>.</h1>
  <p class="sub">Chutar letra não é estratégia.<br><b>Saber o que cai é.</b></p>
</section>
<section class="cena" id="fecho" style="padding-top:560px;text-align:center">
  <div class="tile" style="width:190px;height:190px;border-radius:48px;font-size:90px;margin:0 auto 60px">OA</div>
  <h1 style="font-size:150px">OABase</h1>
  <p class="sub">${fmt(acervo)} questões oficiais da OAB,<br>com gabarito e comentário.</p>
  <div style="margin-top:56px"><span class="cta">Treine com a prova de verdade</span></div>
</section>`;

    const css = `
  #chuva{position:absolute;inset:0;z-index:2;pointer-events:none}
  /* Tudo acima de y=1540: abaixo disso a legenda do TikTok cobre. */
  #colunas{position:absolute;left:90px;right:90px;top:1275px;display:grid;grid-template-columns:repeat(4,1fr);gap:24px;z-index:3}
  .col{text-align:center}
  .num{font-family:var(--serif);font-weight:600;font-size:58px;color:#eef6f2;font-variant-numeric:tabular-nums;line-height:1}
  .pc{font-size:30px;font-weight:800;color:var(--c);margin-top:8px;opacity:0}
  .letra{margin-top:14px;font-size:64px;font-weight:800;color:var(--c);border-top:4px solid var(--c);padding-top:10px}
  .col.apaga{opacity:.28}
  #chuta{position:relative;display:inline-block}
  #chuta::after{content:"";position:absolute;left:-4%;top:52%;height:12px;background:#dc6b8f;border-radius:6px;width:var(--risco,0%)}`;

    const dados = { contagem, total, cores: CORES, letras: LETRAS, campea, anuladas };
    const js = `
const FIM = ${FIM};
const D = ${JSON.stringify(dados)};
const CH = [${CHUVA}];
// Sorteio fixo: o mesmo vídeo a cada renderização.
let semente = 7;
const rnd = () => ((semente = (semente * 1103515245 + 12345) % 2147483648) / 2147483648);

// Cada coluna ocupa 1/4 da largura útil; as bolinhas empilham de baixo para
// cima, da primeira a pousar à última. O tamanho se ajusta à quantidade.
const x0 = 90, largura = 900, gap = 24, larguraCol = (largura - 3 * gap) / 4;
const maior = Math.max(...D.letras.map((l) => D.contagem[l]));
const alturaMax = 700, base = 1255;
let passo = 26; while (Math.ceil(maior / Math.floor(larguraCol / passo)) * passo > alturaMax) passo -= 1;
const porLinha = Math.floor(larguraCol / passo), raio = Math.max(2.2, passo * 0.36);

const bolas = [];
D.letras.forEach((l, c) => {
  for (let k = 0; k < D.contagem[l]; k++) bolas.push({ l, c });
});
for (let i = bolas.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [bolas[i], bolas[j]] = [bolas[j], bolas[i]]; }
const ocupado = [0, 0, 0, 0];
bolas.forEach((b, i) => {
  b.t0 = CH[0] + (i / bolas.length) * (CH[1] - CH[0] - 0.8) + rnd() * 0.25;
  b.dur = 0.55 + rnd() * 0.35;
  b.xi = 60 + rnd() * 960; b.yi = -40 - rnd() * 380;
  const k = ocupado[b.c]++;
  b.xf = x0 + b.c * (larguraCol + gap) + (k % porLinha) * passo + passo / 2 + (larguraCol - porLinha * passo) / 2;
  b.yf = base - Math.floor(k / porLinha) * passo - passo / 2;
});

// Um sprite com brilho por cor: desenhar 3.500 sombras por quadro seria lento.
const sprites = {};
for (const l of D.letras) {
  const s = document.createElement("canvas"); const r = Math.ceil(raio * 3); s.width = s.height = r * 2;
  const g = s.getContext("2d"); const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, D.cores[l]); grad.addColorStop(0.33, D.cores[l]); grad.addColorStop(0.36, D.cores[l] + "66"); grad.addColorStop(1, D.cores[l] + "00");
  g.fillStyle = grad; g.fillRect(0, 0, r * 2, r * 2); sprites[l] = s;
}
const ctx = $("#chuva").getContext("2d");
const bounce = (x) => { const n = 7.5625, d = 2.75; if (x < 1 / d) return n * x * x; if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75; if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375; return n * (x -= 2.625 / d) * x + 0.984375; };

window.render = (t) => {
  cena(t, "#gancho", 0, ${H}, FIM);
  $("#chuta").style.setProperty("--risco", 108 * eo(p(t, 1.3, 1.7)) + "%");
  aparece("#sera", t, 1.5, 0.4, 20);
  cena(t, "#palco", ${H}, ${M}, FIM);

  const visivel = t >= ${H} && t < ${M};
  $("#chuva").style.opacity = visivel ? 1 - p(t, ${M} - 0.4, ${M}) : 0;
  $("#colunas").style.opacity = visivel ? eo(p(t, ${H}, ${H} + 0.5)) * (1 - p(t, ${M} - 0.4, ${M})) : 0;
  ctx.clearRect(0, 0, 1080, 1920);
  const pousadas = [0, 0, 0, 0];
  if (visivel) for (const b of bolas) {
    if (t < b.t0) continue;
    const q = p(t, b.t0, b.t0 + b.dur);
    if (q >= 1) pousadas[b.c]++;
    const x = mix(b.xi, b.xf, eo(q)), y = mix(b.yi, b.yf, bounce(q));
    const r = sprites[b.l].width / 2;
    ctx.globalAlpha = t >= ${R} && b.l !== D.campea ? 0.28 + 0.72 * (1 - p(t, ${R}, ${R} + 0.5)) : 1;
    ctx.drawImage(sprites[b.l], x - r, y - r);
  }
  ctx.globalAlpha = 1;
  D.letras.forEach((l, c) => {
    $("#n" + l).textContent = Math.round(t >= CH[1] + 0.8 ? D.contagem[l] : pousadas[c]).toLocaleString("pt-BR");
    const el = document.querySelector('.col[data-l="' + l + '"]');
    el.classList.toggle("apaga", t >= ${R} && l !== D.campea);
    $("#p" + l).style.opacity = p(t, ${R} - 0.6, ${R} - 0.2);
    el.style.transform = t >= ${R} && l === D.campea ? "scale(" + (1 + 0.12 * Math.sin(p(t, ${R}, ${R} + 0.5) * Math.PI)) + ")" : "";
  });
  const man = $("#manchete");
  man.innerHTML = t < ${R} ? "" : ${JSON.stringify(escapa(cTexto))};
  man.style.opacity = eo(p(t, ${R}, ${R} + 0.35));
  $("#titulo-palco").textContent = t < ${R} ? "Cada bolinha é uma questão oficial" : "Resposta certa, por letra";

  cena(t, "#moral", ${M}, ${F}, FIM);
  cena(t, "#fecho", ${F}, FIM, FIM);
};`;

    // Chuva de estalos acelerando, e um "ding" na revelação.
    const ticks = Array.from({ length: 34 }, (_, i) => [CHUVA[0] + 0.3 + (CHUVA[1] - CHUVA[0]) * Math.pow(i / 34, 0.8), 900 + ((i * 97) % 700)]);
    const titulo = rotulo ? `No ${rotulo}` : "Na OAB";
    return {
      slug: `chute-${rotulo ? rotulo.replace(/\D/g, "") + "-exame" : "acervo"}`,
      duracao: FIM,
      html: pagina({ corpo, css, js, pill: rotulo ?? "Mito de prova", duracao: FIM, escuro: true }),
      audio: trilha({ duracao: FIM, acorde: [196, 246.94, 293.66], cortes: [H, M, F], ticks, dings: [R] }),
      legenda: [
        `${titulo}, a letra que mais foi resposta certa NÃO é a C 👀`,
        `Contamos ${fmt(total)} gabaritos oficiais. Spoiler: chutar letra não é estratégia.`,
        "",
        "Treine com as provas de verdade: oabase.com.br",
      ].join("\n"),
      hashtags: ["#dicasoab", "#estudos"],
      comentario: "Qual letra VOCÊ chuta na dúvida? 👇",
    };
  },
};
