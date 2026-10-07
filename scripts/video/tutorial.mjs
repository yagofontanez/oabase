// Tutorial gravado no site de verdade: "como fazer a prova da OAB de maio de
// graça". O Playwright navega em oabase.com.br num celular, com uma conta sem
// plano, e tira as telas; o motor monta as telas dentro de um celular
// desenhado, com o toque, a legenda de cada passo e a narração da Luciana.
//
//   node --env-file=.env.local scripts/video/tutorial.mjs --email <conta> --senha-arquivo <arquivo>
//
// A conta tem de ser **sem plano**: o vídeo mostra o que quem chega pelo
// TikTok vê. E responde a primeira questão nova da fila — numa conta que já
// a respondeu, a fila começa por outra, e o toque procura a alternativa pelo
// gabarito informado em --gabarito.

import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { pagina, renderizar, trilha, FPS } from "./motor.mjs";
import { falar, vozDescricao } from "./voz.mjs";

const { values: args } = parseArgs({
  options: {
    email: { type: "string" },
    "senha-arquivo": { type: "string" },
    gabarito: { type: "string", default: "C" },
    site: { type: "string", default: "https://oabase.com.br" },
    saida: { type: "string", default: "videos/tutorial-prova-gratis.mp4" },
  },
});
const SITE = args.site;
const senha = args["senha-arquivo"] ? readFileSync(args["senha-arquivo"], "utf8").trim() : process.env.DEMO_SENHA;
if (!senha) throw new Error("Falta a senha da conta demo: DEMO_SENHA no .env.local ou --senha-arquivo");
const pasta = join(tmpdir(), `oabase-tutorial-${Date.now()}`);
mkdirSync(pasta, { recursive: true });

// ---------------------------------------------------------------------------
// 1. Gravar as telas
// ---------------------------------------------------------------------------

const VW = 390, VH = 700; // celular, em pixels CSS
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: "pt-BR" });
const page = await ctx.newPage();

/** Página inteira em JPEG, mais a posição (em px CSS da página) do que interessa. */
async function tela(nome, alvos = {}) {
  await page.waitForTimeout(900);
  // O painel (/app) rola dentro de um contêiner de altura fixa, e não no
  // documento: a captura de "página inteira" pegaria só os 700px visíveis.
  // Solta quem rola e quem prende a altura, para a página ter o tamanho real.
  await page.evaluate(() => {
    for (const el of document.querySelectorAll("body *")) {
      const cs = getComputedStyle(el);
      if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1) {
        el.style.overflow = "visible";
        el.style.height = "auto";
        el.style.maxHeight = "none";
        for (let pai = el.parentElement; pai && pai !== document.body; pai = pai.parentElement) {
          pai.style.height = "auto";
          pai.style.maxHeight = "none";
          pai.style.overflow = "visible";
        }
      }
    }
    document.documentElement.style.overflow = document.body.style.overflow = "visible";
    document.documentElement.style.height = document.body.style.height = "auto";
  });
  const arquivo = join(pasta, `${nome}.jpg`);
  await page.screenshot({ path: arquivo, fullPage: true, type: "jpeg", quality: 88 });
  const caixas = {};
  for (const [k, loc] of Object.entries(alvos)) {
    const c = await loc.boundingBox();
    const rolagem = await page.evaluate(() => window.scrollY);
    if (c) caixas[k] = { x: c.x + c.width / 2, y: c.y + rolagem + c.height / 2, topo: c.y + rolagem, h: c.height };
  }
  const altura = await page.evaluate(() => document.documentElement.scrollHeight);
  console.log(`  tela ${nome} (${altura}px)`, Object.keys(caixas).join(", "));
  return { img: `data:image/jpeg;base64,${readFileSync(arquivo).toString("base64")}`, altura, caixas };
}

console.log("Gravando em", SITE, "· voz:", vozDescricao);
await page.goto(SITE + "/", { waitUntil: "networkidle" });
const home = await tela("home", { criar: page.getByRole("link", { name: "Criar conta" }).first() });

await page.goto(SITE + "/criar-conta", { waitUntil: "networkidle" });
const criar = await tela("criar", { google: page.getByRole("button", { name: /Google/ }).first() });

await page.goto(SITE + "/entrar?proximo=/app/questoes", { waitUntil: "networkidle" });
await page.fill("input[type=email]", args.email);
await page.fill("input[type=password]", senha);
await page.click("button[type=submit]");
await page.waitForURL((u) => u.pathname === "/app/questoes", { timeout: 30000 });
await page.waitForLoadState("networkidle");
await page.evaluate(() => window.scrollTo(0, 0));
const alternativa = page.locator("main button").filter({ hasText: new RegExp(`^\\s*${args.gabarito}\\s*[^a-zà-ú\\s]`) }).first();
const responder = page.getByRole("button", { name: "Responder" });
const fila = await tela("fila", { faixa: page.getByText(/de graça/).first(), questao: page.getByText(/Exame · questão/).first(), alt: alternativa, responder });

await alternativa.click();
const marcada = await tela("marcada", { alt: alternativa, responder });

await responder.click();
await page.waitForResponse((r) => r.url().includes("/api/responder"), { timeout: 30000 }).catch(() => {});
const comentarioLoc = page.getByText(/coment/i).last();
const respondida = await tela("respondida", { alt: alternativa, comentario: comentarioLoc });
await browser.close();

// ---------------------------------------------------------------------------
// 2. Narração: um trecho por cena, gravado separado para saber onde cai
// ---------------------------------------------------------------------------

const CENAS = [
  { id: "gancho", fala: "Olha como fazer a prova da OAB de maio inteira, de graça." },
  { id: "home", passo: "1", titulo: "Entre em oabase.com.br", fala: "Entra no oabase ponto com ponto br, e toca em criar conta." },
  { id: "criar", passo: "2", titulo: "Crie a conta grátis", fala: "Cria a conta com o Google ou com e-mail. Não pede cartão." },
  { id: "fila", passo: "3", titulo: "O 46º já está liberado", fala: "Pronto: as oitenta questões do quadragésimo sexto exame já estão liberadas." },
  { id: "responde", passo: "4", titulo: "Escolha e responda", fala: "Escolhe a alternativa, e responde." },
  { id: "resultado", passo: "5", titulo: "Gabarito e comentário na hora", fala: "O gabarito oficial e o comentário aparecem na hora, e a questão volta na sua revisão." },
  { id: "fecho", fala: "O link tá no perfil. Bons estudos!" },
];
const MIN = { gancho: 2.6, home: 3.4, criar: 3.4, fila: 4.6, responde: 4.1, resultado: 5.2, fecho: 3.2 };
const duracaoDe = (arq) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", arq], { encoding: "utf8" }));

let t = 0;
const wavs = [];
for (const [i, c] of CENAS.entries()) {
  const wav = await falar(c.fala, join(pasta, `v${i}.wav`));
  c.voz = duracaoDe(wav);
  c.inicio = t;
  c.fim = t + Math.max(MIN[c.id], c.voz + 0.75);
  wavs.push({ wav, em: c.inicio + 0.25 });
  t = c.fim;
}
const FIM = t;
const voz = join(pasta, "voz.wav");
execFileSync("ffmpeg", [
  "-loglevel", "error", "-y", ...wavs.flatMap((w) => ["-i", w.wav]),
  "-filter_complex",
  wavs.map((w, i) => `[${i}:a]adelay=${Math.round(w.em * 1000)}[d${i}]`).join(";") + ";" + wavs.map((_, i) => `[d${i}]`).join("") + `amix=inputs=${wavs.length}:normalize=0,apad=whole_dur=${FIM}[s]`,
  "-map", "[s]", "-ar", "44100", "-ac", "1", voz,
]);

// ---------------------------------------------------------------------------
// 3. Montagem: o celular, as telas, o toque e as legendas
// ---------------------------------------------------------------------------

const C = Object.fromEntries(CENAS.map((c) => [c.id, c]));
const PW = 600, S = PW / VW, PH = Math.round(VH * S); // tela do celular, em px do vídeo
// Rolagem que deixa um ponto da página a uma altura confortável da tela.
const mira = (y, h, fracao = 0.42) => Math.max(0, Math.min(h - VH, y - VH * fracao));

const T_TOQUE_ALT = C.responde.inicio + 1.6, T_TOQUE_RESP = C.responde.inicio + 2.9;
const plano = {
  telas: { home, criar, fila, marcada, respondida },
  // Qual tela aparece, e onde a página está rolada, em cada trecho.
  trechos: [
    { de: C.home.inicio, ate: C.home.fim, tela: "home", y0: 0, y1: 0 },
    { de: C.criar.inicio, ate: C.criar.fim, tela: "criar", y0: 0, y1: mira(criar.caixas.google?.y ?? 0, criar.altura, 0.55) },
    // A faixa do 46º primeiro; depois desce até o enunciado, para a questão
    // de verdade aparecer — não só as alternativas.
    { de: C.fila.inicio, ate: C.fila.inicio + 1.8, tela: "fila", y0: 0, y1: 0 },
    { de: C.fila.inicio + 1.8, ate: C.fila.fim, tela: "fila", y0: 0, y1: Math.max(0, (fila.caixas.questao?.topo ?? 0) - 24) },
    { de: C.responde.inicio, ate: T_TOQUE_ALT, tela: "fila", y0: Math.max(0, (fila.caixas.questao?.topo ?? 0) - 24), y1: mira(fila.caixas.alt.y, fila.altura, 0.45) },
    { de: T_TOQUE_ALT, ate: T_TOQUE_RESP + 0.5, tela: "marcada", y0: mira(marcada.caixas.alt.y, marcada.altura, 0.45), y1: mira(marcada.caixas.responder.y, marcada.altura, 0.6) },
    { de: T_TOQUE_RESP + 0.5, ate: C.resultado.inicio + 0.6, tela: "respondida", y0: mira(respondida.caixas.alt.y, respondida.altura, 0.45), y1: mira(respondida.caixas.alt.y, respondida.altura, 0.45) },
    { de: C.resultado.inicio + 0.6, ate: C.resultado.fim, tela: "respondida", y0: mira(respondida.caixas.alt.y, respondida.altura, 0.45), y1: mira(respondida.caixas.comentario?.y ?? respondida.caixas.alt.y + 300, respondida.altura, 0.3) },
  ],
  toques: [
    { em: C.home.inicio + 1.9, tela: "home", alvo: "criar", trecho: 0 },
    { em: T_TOQUE_ALT, tela: "fila", alvo: "alt", trecho: 4 },
    { em: T_TOQUE_RESP, tela: "marcada", alvo: "responder", trecho: 5 },
  ],
  passos: CENAS.filter((c) => c.passo).map((c) => ({ de: c.inicio, ate: c.fim, passo: c.passo, titulo: c.titulo })),
};

const corpo = `
<section class="cena" id="gancho" style="padding-top:500px">
  <div class="kicker">Tutorial · 46º Exame</div>
  <h1 style="font-size:132px">A prova da OAB de maio, <em>de graça.</em></h1>
</section>
<div id="legenda"><span id="num"></span><span id="txt"></span></div>
<div id="celular"><div id="tela">${Object.entries(plano.telas).map(([k, v]) => `<img id="t-${k}" src="${v.img}">`).join("")}<div id="toque"></div></div></div>
<section class="cena" id="fecho" style="padding-top:520px;text-align:center">
  <div class="tile" style="width:190px;height:190px;border-radius:48px;font-size:90px;margin:0 auto 60px">OA</div>
  <h1 style="font-size:124px">80 questões.<br><em>R$ 0.</em></h1>
  <div style="margin-top:56px"><span class="cta">Link no perfil</span></div>
</section>`;

const css = `
  #legenda{position:absolute;top:200px;left:90px;right:90px;display:flex;align-items:center;gap:26px;z-index:6;opacity:0}
  #num{flex-shrink:0;width:96px;height:96px;border-radius:50%;background:var(--ouro);color:var(--noite);display:grid;place-items:center;font-size:52px;font-weight:800}
  #txt{font-family:var(--serif);font-weight:600;font-size:64px;line-height:1.05;letter-spacing:-2px;color:#eef6f2}
  #celular{position:absolute;left:${(1080 - PW) / 2 - 18}px;top:380px;width:${PW + 36}px;height:${PH + 36}px;border-radius:64px;background:#0a0f0e;padding:18px;
    box-shadow:0 0 0 3px #ffffff22,0 50px 120px #000a;opacity:0;z-index:4}
  #tela{position:relative;width:${PW}px;height:${PH}px;border-radius:48px;overflow:hidden;background:#fff}
  #tela img{position:absolute;left:0;top:0;width:${PW}px;opacity:0}
  #toque{position:absolute;width:84px;height:84px;margin:-42px 0 0 -42px;border-radius:50%;background:#e9a23b55;border:5px solid #e9a23b;opacity:0;z-index:3}`;

const js = `
const FIM = ${FIM};
const P = ${JSON.stringify({ trechos: plano.trechos, toques: plano.toques, passos: plano.passos, alturas: Object.fromEntries(Object.entries(plano.telas).map(([k, v]) => [k, v.altura])), caixas: Object.fromEntries(Object.entries(plano.telas).map(([k, v]) => [k, v.caixas])) })};
const S = ${S};
const CEL = [${C.home.inicio}, ${C.resultado.fim}];
window.render = (t) => {
  cena(t, "#gancho", 0, ${C.gancho.fim}, FIM);
  cena(t, "#fecho", ${C.fecho.inicio}, FIM, FIM);

  const cel = $("#celular");
  const dentro = t >= CEL[0] && t < CEL[1];
  const ent = eo(p(t, CEL[0], CEL[0] + 0.5)), sai = p(t, CEL[1] - 0.35, CEL[1]);
  cel.style.opacity = dentro ? ent * (1 - sai) : 0;
  cel.style.transform = "translateY(" + ((1 - ent) * 120) + "px) scale(" + (0.96 + 0.04 * ent) + ")";

  // Tela da vez: troca seca no toque (é o que acontece no celular), rolagem suave dentro do trecho.
  let atual = null;
  for (const tr of P.trechos) if (t >= tr.de && t < tr.ate) atual = tr;
  if (!atual) atual = t < CEL[0] ? P.trechos[0] : P.trechos[P.trechos.length - 1];
  const y = mix(atual.y0, atual.y1, eio(p(t, atual.de + 0.3, atual.ate - 0.2)));
  $$("#tela img").forEach((img) => {
    const ativa = img.id === "t-" + atual.tela;
    img.style.opacity = ativa ? 1 : 0;
    if (ativa) img.style.transform = "translateY(" + (-y * S) + "px)";
  });

  // O toque: aparece, aperta e some em cima do alvo, na rolagem daquele trecho.
  const toque = $("#toque");
  toque.style.opacity = 0;
  for (const k of P.toques) {
    if (t < k.em - 0.45 || t > k.em + 0.35) continue;
    const c = P.caixas[k.tela][k.alvo]; if (!c) continue;
    const tr = P.trechos[k.trecho];
    const yy = mix(tr.y0, tr.y1, eio(p(Math.min(t, tr.ate), tr.de + 0.3, tr.ate - 0.2)));
    toque.style.left = c.x * S + "px";
    toque.style.top = (c.y - yy) * S + "px";
    const aperta = Math.sin(p(t, k.em - 0.1, k.em + 0.15) * Math.PI);
    toque.style.opacity = p(t, k.em - 0.45, k.em - 0.25) * (1 - p(t, k.em + 0.15, k.em + 0.35));
    toque.style.transform = "scale(" + (1 - 0.3 * aperta) + ")";
  }

  // Legenda do passo.
  const leg = $("#legenda");
  const passo = P.passos.find((s) => t >= s.de && t < s.ate);
  if (passo) {
    $("#num").textContent = passo.passo;
    $("#txt").textContent = passo.titulo;
    const e = eo(p(t, passo.de, passo.de + 0.35));
    leg.style.opacity = e * (1 - p(t, passo.ate - 0.2, passo.ate));
    leg.style.transform = "translateY(" + (1 - e) * 24 + "px)";
  } else leg.style.opacity = 0;
};`;

const toquesAudio = plano.toques.map((k) => [k.em, 1500]);
console.log(`Montando ${FIM.toFixed(1)}s, ${Math.round(FIM * FPS)} quadros…`);
const browser2 = await chromium.launch();
await renderizar({
  html: pagina({ corpo, css, js, pill: "Tutorial", duracao: FIM, escuro: true, marcaApos: C.gancho.fim }),
  duracao: FIM,
  audio: { ...trilha({ duracao: FIM, acorde: [220, 277.18, 329.63], cortes: [C.gancho.fim, C.resultado.fim], ticks: toquesAudio, dings: [T_TOQUE_RESP + 0.5] }), voz },
  saida: args.saida,
  browser: browser2,
});
await browser2.close();

writeFileSync(
  args.saida.replace(/\.mp4$/, ".txt"),
  [
    "── LEGENDA ──",
    "Como fazer a prova da OAB de maio (46º Exame) inteira, de graça 👇",
    "Cria a conta, as 80 questões já estão liberadas — com gabarito oficial e comentário. Sem cartão.",
    "",
    "Link no perfil 🔗",
    "",
    "#oab #exameoab #examedeordem #direito #estudantededireito #provaoab #tutorial",
    "",
    "── COMENTÁRIO PARA FIXAR ──",
    "Testa e me conta: quantas você acertou das 80? 👇",
    "",
  ].join("\n"),
);
console.log("→", args.saida);
