// Motor dos vídeos verticais: página → Playwright quadro a quadro → ffmpeg.
//
// Regra única: todo quadro é função pura do tempo. A página expõe
// `window.render(t)`; nada de CSS transition/animation, que correm no relógio
// de parede e saem diferentes a cada renderização.
//
// Área segura do TikTok/Reels: a legenda e os botões cobrem ~380px embaixo e
// ~150px à direita. Conteúdo que importa fica entre y=240 e y=1520.

import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

export const W = 1080;
export const H = 1920;
export const FPS = 30;

export const escapa = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// Paleta e tipografia de src/app/globals.css.
export const CSS_BASE = `
  :root{
    --brand:#0f7a5f; --brand-700:#094c40; --brand-300:#62b39c; --brand-100:#cfe8df; --brand-50:#ebf5f1;
    --ouro:#e9a23b; --ouro-100:#fae9cc; --vinho:#7e2a44; --vinho-50:#f8edf1; --erro:#c2415b;
    --ink:#16201d; --body:#4c5a55; --muted:#7c8a85; --line:#e3eae6;
    --paper:#f5f8f6; --noite:#041f1c;
    --sans:"Plus Jakarta Sans",system-ui,sans-serif;
    --serif:"Source Serif 4",Georgia,serif;
    --mono:ui-monospace,"SF Mono",Menlo,monospace;
  }
  *{box-sizing:border-box;margin:0}
  html,body{width:${W}px;height:${H}px;overflow:hidden;background:var(--paper)}
  body{font-family:var(--sans);color:var(--ink);-webkit-font-smoothing:antialiased}
  #film{position:relative;width:100%;height:100%;overflow:hidden;background:var(--paper)}
  #film.escuro{background:radial-gradient(120% 70% at 50% 0%,#0b4a3e 0%,var(--noite) 60%);color:#eef6f2}
  .grade{position:absolute;inset:0;opacity:.5;
    background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);
    background-size:90px 90px;mask-image:radial-gradient(80% 60% at 50% 45%,#000 20%,transparent 75%)}
  .escuro .grade{opacity:.06}
  .topo{position:absolute;top:84px;left:90px;right:90px;display:flex;justify-content:space-between;align-items:center;z-index:5}
  .marca{display:flex;align-items:center;gap:18px;font-weight:800;font-size:38px;letter-spacing:-1px}
  .tile{width:58px;height:58px;border-radius:15px;background:linear-gradient(135deg,var(--brand),var(--brand-700));
    display:grid;place-items:center;color:var(--paper);font-weight:800;font-size:27px;letter-spacing:-1.5px}
  .pill{font-size:24px;font-weight:700;padding:12px 24px;border-radius:999px;border:2px solid currentColor;color:var(--brand)}
  .escuro .pill{color:var(--ouro)}
  .progresso{position:absolute;top:40px;left:90px;right:90px;height:6px;border-radius:3px;background:#16201d1f;overflow:hidden;z-index:5}
  .escuro .progresso{background:#ffffff26}
  .progresso b{display:block;height:100%;width:0;background:currentColor}
  .rodape{position:absolute;left:90px;right:90px;top:1560px;text-align:center;font-size:32px;font-weight:700;color:var(--brand);z-index:5}
  .escuro .rodape{color:var(--brand-300)}
  .cena{position:absolute;inset:0;padding:250px 90px 0;display:none}
  .kicker{font-size:28px;font-weight:800;letter-spacing:4px;text-transform:uppercase;color:var(--brand);margin-bottom:30px}
  .escuro .kicker{color:var(--ouro)}
  h1{font-family:var(--serif);font-weight:600;font-size:108px;line-height:1.03;letter-spacing:-3.5px}
  h1 em{font-style:italic;color:var(--brand)}
  .escuro h1 em{color:var(--brand-300)}
  .sub{font-size:40px;line-height:1.35;color:var(--body);margin-top:34px}
  .escuro .sub{color:#cfe3db}
  .lei{font-family:var(--serif);font-size:48px;line-height:1.42;color:var(--ink)}
  .cartao{background:#fff;border:2px solid var(--line);border-radius:32px;padding:46px;box-shadow:0 30px 70px #16201d14}
  .caret{display:inline-block;width:6px;height:.9em;background:currentColor;margin-left:6px;vertical-align:-.08em}
  .fonte{font-size:26px;color:var(--muted);font-weight:600;margin-top:26px}
  .relogio{width:150px;height:150px;position:relative;margin:0 auto}
  .relogio svg{position:absolute;inset:0;transform:rotate(-90deg)}
  .relogio circle{fill:none;stroke-width:12}
  .relogio .trilho{stroke:var(--line)}
  .escuro .relogio .trilho{stroke:#ffffff22}
  .relogio .arco{stroke:var(--brand);stroke-linecap:round}
  .relogio span{position:absolute;inset:0;display:grid;place-items:center;font-family:var(--serif);font-weight:600;font-size:76px}
  .cta{display:inline-block;font-size:38px;font-weight:800;background:var(--ink);color:#fff;padding:24px 40px;border-radius:999px}
  .escuro .cta{background:#eef6f2;color:var(--ink)}
`;

/** Contagem de 3 s: anel que esvazia + número. Animado por `relogio()`. */
export const relogioHTML = (id) =>
  `<div class="relogio" id="${id}"><svg viewBox="0 0 150 150"><circle class="trilho" cx="75" cy="75" r="62"/><circle class="arco" cx="75" cy="75" r="62"/></svg><span>3</span></div>`;

// Funções de animação disponíveis em toda página. `aparece` e `palavras`
// escrevem só opacidade/transform — quem chama decide o resto.
export const JS_BASE = `
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const p = (t, a, b) => cl((t - a) / (b - a));
const eo = (x) => 1 - Math.pow(1 - x, 3);
const eio = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const back = (x) => { const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const mix = (a, b, x) => a + (b - a) * x;

function cena(t, el, a, b, fim) {
  if (typeof el === "string") el = $(el);
  if (t < a || t >= b) { el.style.display = "none"; return; }
  // A cena que abre o vídeo já está inteira no quadro zero: é o quadro que
  // vira capa e o que decide se a pessoa rola o dedo. Fade ali era tela
  // escura no primeiro segundo — o defeito que segurava os vídeos em 300 views.
  const ent = a <= 0 ? 1 : eo(p(t, a, a + 0.45));
  const sai = b >= fim ? 0 : eio(p(t, b - 0.3, b));
  el.style.display = "block";
  el.style.opacity = ent * (1 - sai);
  el.style.transform = "translateY(" + ((1 - ent) * 60 - sai * 40) + "px)";
  el.style.filter = "blur(" + ((1 - ent) * 8 + sai * 10) + "px)";
}
function aparece(el, t, a, dur = 0.45, dy = 40) {
  if (typeof el === "string") el = $(el);
  const x = eo(p(t, a, a + dur));
  el.style.opacity = x;
  el.style.transform = "translateY(" + (1 - x) * dy + "px)";
  return x;
}
function digita(t, d) {
  const n = Math.floor(cl((t - d.inicio) * d.cps, 0, d.texto.length));
  document.getElementById(d.id).textContent = d.texto.slice(0, n);
  const caret = document.getElementById(d.id + "-caret");
  if (caret) caret.style.opacity = t < d.inicio + d.texto.length / d.cps || Math.floor(t * 2.2) % 2 === 0 ? 1 : 0;
}
// Texto que entra palavra a palavra: prepara uma vez, depois só ajusta opacidade.
function preparaPalavras(el) {
  el.innerHTML = el.textContent.trim().split(/\\s+/).map((w) => "<span class=w>" + w + "</span>").join(" ");
}
function palavras(el, t, a, wps) {
  el.querySelectorAll(".w").forEach((w, i) => {
    const x = eo(p(t, a + i / wps, a + i / wps + 0.25));
    w.style.opacity = 0.12 + 0.88 * x;
  });
}
function relogio(id, t, a, n = 3) {
  const el = document.getElementById(id);
  const C = 2 * Math.PI * 62;
  const arco = el.querySelector(".arco");
  arco.style.strokeDasharray = C;
  arco.style.strokeDashoffset = C * p(t, a, a + n);
  el.querySelector("span").textContent = Math.max(1, n - Math.max(0, Math.floor(t - a)));
}
// Centraliza a cena na área segura (y 250–1520) quando o conteúdo é curto:
// caput de 40 caracteres não pode deixar meia tela vazia embaixo.
function centralizar(sel) {
  const el = $(sel);
  const antes = el.style.display;
  el.style.display = "block";
  el.style.paddingTop = "0px";
  // a cena é inset:0, então scrollHeight é sempre a tela: mede os filhos
  const altura = Math.max(...[...el.children].map((c) => c.offsetTop + c.offsetHeight));
  el.style.paddingTop = Math.max(250, 250 + (1270 - altura) / 2) + "px";
  el.style.display = antes;
}
// Diminui a fonte até o bloco caber na altura — caput de lei tem de 40 a 400 caracteres.
function caber(el, alturaMax, min = 30) {
  let tam = parseFloat(getComputedStyle(el).fontSize);
  while (el.scrollHeight > alturaMax && tam > min) { tam -= 2; el.style.fontSize = tam + "px"; }
}
`;

// `marcaApos`: até esse segundo, o vídeo não mostra logo, selo, barra de
// progresso nem endereço — só o gancho. Primeiro quadro com cara de anúncio é
// dedo rolando: no tutorial, 2,87 s de média e "a maioria parou em 0:01".
export function pagina({ corpo, css = "", js, pill, duracao, escuro = false, rodape = "oabase.com.br", marcaApos = 0 }) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400;1,8..60,600&display=block" rel="stylesheet">
<style>${CSS_BASE}${css}</style></head><body>
<div id="film"${escuro ? ' class="escuro"' : ""}><div class="grade"></div>
<div class="progresso"><b id="prog"></b></div>
<div class="topo"><div class="marca"><div class="tile">OA</div><span>OABase</span></div><div class="pill">${escapa(pill)}</div></div>
${corpo}
${rodape ? `<div class="rodape" id="rodape">${escapa(rodape)}</div>` : ""}
</div><script>
const DURACAO = ${duracao};
const MARCA_APOS = ${marcaApos};
${JS_BASE}
${js}
const _render = window.render;
window.render = (t) => {
  _render(t);
  $("#prog").style.width = (t / DURACAO) * 100 + "%";
  const marca = MARCA_APOS > 0 ? p(t, MARCA_APOS, MARCA_APOS + 0.4) : 1;
  for (const s of [".topo", ".progresso", "#rodape"]) { const el = $(s); if (el) el.style.opacity = marca; }
  $("#film").style.opacity = 1 - p(t, DURACAO - 0.4, DURACAO);
};
</script></body></html>`;
}

// Trilha gerada pelo ffmpeg. `max(t-T,0)` evita exp(+∞)·0 = NaN antes de cada
// evento, que o encoder AAC recusa.
export function trilha({ duracao, acorde = [220, 277.18, 329.63], cortes = [], digitacao = [], ticks = [], dings = [] }) {
  const desde = (T) => `max(t-${T},0)`;
  const [a, b, c] = acorde;
  const pad = `0.045*(0.5*sin(2*PI*${a / 2}*t)+sin(2*PI*${a}*t)+0.75*sin(2*PI*${b}*t)+0.7*sin(2*PI*${c}*t)+0.25*sin(2*PI*${a * 2}*t))*(0.7+0.3*sin(2*PI*0.2*t))`;
  const partes = [pad];
  for (const T of cortes)
    partes.push(`0.22*sin(2*PI*(520+300*exp(-30*${desde(T)}))*${desde(T)})*exp(-18*${desde(T)})*gte(t,${T})`);
  for (const d of digitacao)
    [...d.texto].forEach((ch, i) => {
      if (ch === " " || i > 60) return;
      const T = (d.inicio + i / d.cps).toFixed(3);
      partes.push(`0.07*sin(2*PI*${1800 + ((i * 373) % 700)}*${desde(T)})*exp(-260*${desde(T)})*gte(t,${T})`);
    });
  for (const [T, f = 1320] of ticks)
    partes.push(`0.16*sin(2*PI*${f}*${desde(T)})*exp(-40*${desde(T)})*gte(t,${T})`);
  for (const T of dings)
    partes.push(`0.16*(sin(2*PI*1046.5*${desde(T)})+0.6*sin(2*PI*1568*${desde(T)}))*exp(-5*${desde(T)})*gte(t,${T})`);
  return {
    fonte: `aevalsrc=exprs='${partes.join("+")}':s=44100:d=${duracao}`,
    filtro: `afade=t=in:d=0.6,afade=t=out:st=${duracao - 1}:d=1,lowpass=f=6000,volume=1.4`,
  };
}

async function abrir(browser, html) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "networkidle" });
  // A folha do Google declara as faces, mas só baixa o que a página usa.
  const ok = await page.evaluate(async () => {
    const faces = ['600 100px "Source Serif 4"', 'italic 600 100px "Source Serif 4"', '400 40px "Source Serif 4"',
      '400 40px "Plus Jakarta Sans"', '600 40px "Plus Jakarta Sans"', '800 40px "Plus Jakarta Sans"'];
    await Promise.all(faces.map((f) => document.fonts.load(f, "Aã")));
    await document.fonts.ready;
    // Imagens grandes (as telas gravadas) só decodificam quando aparecem: sem
    // esperar aqui, o primeiro quadro em que surgem sai branco.
    await Promise.all([...document.images].map((i) => i.decode().catch(() => {})));
    if (window.preparar) await window.preparar();
    return faces.every((f) => document.fonts.check(f));
  });
  if (!ok) console.warn("  ! fontes do Google não carregaram — usando as de sistema");
  return page;
}

/** Tira só alguns quadros em PNG — para ajustar layout sem renderizar o vídeo. */
export async function previa({ html, tempos, dir, prefixo = "t" }) {
  mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await abrir(browser, html);
  for (const t of tempos) {
    await page.evaluate((t) => window.render(t), t);
    await page.screenshot({ path: join(dir, `${prefixo}${t.toFixed(1)}.png`) });
  }
  await browser.close();
}

export async function renderizar({ html, duracao, audio, saida, browser: externo }) {
  mkdirSync(dirname(saida), { recursive: true });
  const ffmpeg = spawn(
    "ffmpeg",
    [
      "-y", "-loglevel", "error",
      "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
      "-f", "lavfi", "-i", audio.fonte,
      // Com voz gravada (formato "ouvir"), a trilha vira fundo: a voz entra
      // por cima, no volume dela, e a trilha é abaixada para não disputar.
      ...(audio.voz
        ? ["-i", audio.voz, "-filter_complex",
           `[1:a]${audio.filtro},volume=0.35[fundo];[2:a]aresample=44100,volume=1.1[voz];[fundo][voz]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.7:level=false[a]`,
           "-map", "0:v", "-map", "[a]"]
        : ["-filter:a", audio.filtro]),
      "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart",
      saida,
    ],
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  const terminou = new Promise((ok, erro) =>
    ffmpeg.on("close", (c) => (c === 0 ? ok() : erro(new Error(`ffmpeg saiu com ${c}`)))),
  );
  ffmpeg.stdin.on("error", () => {}); // o erro real chega pelo `close`

  const browser = externo ?? (await chromium.launch({ headless: true }));
  const page = await abrir(browser, html);
  const total = Math.round(duracao * FPS);
  for (let f = 0; f < total; f++) {
    await page.evaluate((t) => window.render(t), f / FPS);
    const quadro = await page.screenshot({ type: "jpeg", quality: 94 });
    if (!ffmpeg.stdin.write(quadro)) await new Promise((r) => ffmpeg.stdin.once("drain", r));
  }
  ffmpeg.stdin.end();
  await page.close();
  if (!externo) await browser.close();
  await terminou;
}
