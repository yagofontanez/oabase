// Vídeo de lançamento vertical (1080×1920, 30 fps, ~36 s).
//
// Cada quadro é uma função pura do tempo: a página expõe `render(t)` e o
// Playwright tira um screenshot por quadro. Nada de CSS transition/animation —
// elas correm no relógio de parede e sairiam diferentes a cada renderização.
// A trilha também é gerada, pelo ffmpeg (aevalsrc), com os cliques de
// digitação sincronizados com o texto que aparece na tela.
//
// Todo número na tela vem do acervo (ver a tabela em AGENTS.md) ou do código:
// 3.540 questões, 44 exames, 9.887 artigos de 42 leis, 3.524 comentários,
// a data do 48º Exame em `aplicacoes`, os nomes das ferramentas do servidor
// MCP e o plano "Experimentar" de `planos.ts`.

import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const W = 1080;
const H = 1920;
const FPS = 30;
const DURACAO = 36.5;
const saida = join(process.cwd(), "public", "videos", "oabase-launch.mp4");

// Dias até o 48º Exame, contados a partir de hoje, como a /proximo-exame faz.
const hoje = new Date();
const prova = new Date(2027, 0, 10);
const diasAteAProva = Math.max(
  0,
  Math.ceil((prova - new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())) / 864e5),
);

// Trechos digitados: a página desenha, a trilha estala uma tecla por caractere.
const DIGITACAO = [
  { id: "t-abertura", texto: `Faltam ${diasAteAProva} dias para a prova.`, inicio: 0.35, cps: 26, som: true },
  { id: "t-busca", texto: "furto", inicio: 15.0, cps: 9, som: true },
  { id: "t-find", texto: "gabarito", inicio: 21.0, cps: 12, som: true },
  { id: "t-chat", texto: "O que eu estudo agora?", inicio: 28.0, cps: 22, som: true },
];

// Cortes de cena — cada um ganha um "pop" na trilha.
const CORTES = [4.2, 8.2, 14.2, 20.2, 23.8, 27.4, 32.6];

const html = String.raw`<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400;1,8..60,600&display=block" rel="stylesheet">
<style>
  :root{
    --brand:#0f7a5f; --brand-700:#094c40; --brand-100:#cfe8df; --brand-50:#ebf5f1;
    --ouro:#e9a23b; --ouro-100:#fae9cc; --vinho:#7e2a44; --vinho-50:#f8edf1;
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
  #noite{position:absolute;inset:0;background:radial-gradient(120% 70% at 50% 0%,#0b4a3e 0%,var(--noite) 60%);opacity:0}
  #grade{position:absolute;inset:0;opacity:.5;
    background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);
    background-size:90px 90px;mask-image:radial-gradient(80% 60% at 50% 45%,#000 20%,transparent 75%)}

  /* cabeçalho fixo */
  .topo{position:absolute;top:84px;left:90px;right:90px;display:flex;justify-content:space-between;align-items:center;z-index:5}
  .marca{display:flex;align-items:center;gap:18px;font-weight:800;font-size:38px;letter-spacing:-1px}
  .tile{width:58px;height:58px;border-radius:15px;background:linear-gradient(135deg,var(--brand),var(--brand-700));
    display:grid;place-items:center;color:var(--paper);font-weight:800;font-size:27px;letter-spacing:-1.5px}
  .pill{font-size:24px;font-weight:700;padding:12px 24px;border-radius:999px;border:2px solid currentColor;color:var(--brand)}
  .barras{position:absolute;top:40px;left:90px;right:90px;display:flex;gap:10px;z-index:5}
  .barras i{flex:1;height:6px;border-radius:3px;background:#16201d1f;overflow:hidden}
  .barras b{display:block;height:100%;background:var(--ink);width:0}

  .cena{position:absolute;inset:0;padding:260px 90px 0;display:none}
  .kicker{font-size:28px;font-weight:800;letter-spacing:4px;text-transform:uppercase;color:var(--brand);margin-bottom:34px}
  h1{font-family:var(--serif);font-weight:600;font-size:112px;line-height:1.02;letter-spacing:-3.5px}
  h1 em{font-style:italic;color:var(--brand)}
  .sub{font-size:40px;line-height:1.35;color:var(--body);margin-top:36px}
  .caret{display:inline-block;width:6px;height:.9em;background:currentColor;margin-left:6px;vertical-align:-.08em}

  /* 1 — abertura */
  #chips{position:absolute;inset:0;z-index:3;pointer-events:none}
  .chip{position:absolute;left:0;top:0;display:flex;align-items:center;gap:16px;background:#fff;border:2px solid var(--line);
    border-radius:22px;padding:22px 30px;font-size:31px;font-weight:600;white-space:nowrap;box-shadow:0 24px 50px #16201d1a}
  .chip i{width:22px;height:22px;border-radius:6px;background:var(--c)}
  .chip s{color:var(--muted);font-weight:500;text-decoration:none;font-size:26px}

  /* 2 — apresentação */
  #logo-grande{position:absolute;left:50%;top:640px;width:260px;height:260px;margin-left:-130px;border-radius:66px;
    background:linear-gradient(135deg,var(--brand),var(--brand-700));display:grid;place-items:center;
    color:var(--paper);font-weight:800;font-size:122px;letter-spacing:-6px;box-shadow:0 40px 90px #0f7a5f55;z-index:4}
  #c-apresenta{text-align:center;padding-top:980px}
  #c-apresenta h1{font-size:150px}

  /* 3 — acervo */
  .num{display:flex;align-items:baseline;gap:30px;padding:40px 0;border-top:2px solid var(--line)}
  .num strong{font-family:var(--serif);font-weight:600;font-size:150px;letter-spacing:-5px;line-height:1;min-width:450px;font-variant-numeric:tabular-nums}
  .num span{font-size:36px;line-height:1.25;color:var(--body);font-weight:600}
  .carimbo{margin-top:40px;display:inline-flex;gap:16px;align-items:center;font-size:32px;font-weight:700;color:var(--brand);
    background:var(--brand-50);padding:20px 30px;border-radius:18px}

  /* 4 — busca */
  .caixa{margin-top:70px;display:flex;align-items:center;gap:24px;background:#fff;border:3px solid var(--brand);border-radius:30px;
    padding:34px 40px;font-size:52px;font-weight:600;box-shadow:0 30px 70px #0f7a5f22}
  .caixa svg{flex:none}
  .res{margin-top:28px;background:#fff;border:2px solid var(--line);border-radius:28px;padding:38px 42px;box-shadow:0 20px 50px #16201d10}
  .res .rot{font-size:26px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--brand)}
  .res h3{font-size:44px;font-weight:800;margin:10px 0 14px;letter-spacing:-1px}
  .res p{font-family:var(--serif);font-size:36px;line-height:1.4;color:var(--body)}
  .res mark{background:var(--ouro-100);color:inherit;padding:0 6px;border-radius:6px}
  .dica{margin-top:34px;font-size:32px;color:var(--muted);font-weight:600}

  /* 5 — inspetor */
  .devtools{margin-top:64px;background:#0d1512;border-radius:30px;overflow:hidden;box-shadow:0 40px 90px #0006;color:#cfe3db;font-family:var(--mono);font-size:32px}
  .dt-bar{display:flex;gap:12px;padding:24px 30px;background:#17221e;align-items:center}
  .dt-bar i{width:20px;height:20px;border-radius:50%;background:#3a4843}
  .dt-bar span{margin-left:18px;color:#7c8a85;font-size:26px}
  .find{display:flex;align-items:center;gap:18px;padding:22px 30px;border-bottom:2px solid #22302b;font-size:34px}
  .find .campo{flex:1;background:#1d2a25;border-radius:12px;padding:14px 20px;color:#fff}
  .find .zero{color:#ff8f8f;font-weight:700}
  .json{padding:30px 34px 38px;line-height:1.6;white-space:pre}
  .k{color:#8fd3b8}.s{color:#f2d095}.n{color:#a2b8ff}.cm{color:#6b7a75}
  #selo{position:absolute;right:70px;top:1330px;transform-origin:center;border:8px solid var(--vinho);color:var(--vinho);
    font-weight:800;font-size:46px;letter-spacing:2px;padding:20px 34px;border-radius:22px;background:#fffc;text-align:center;line-height:1.1;z-index:4}

  /* 6 — revisão */
  .questao{margin-top:60px;background:#fff;border:2px solid var(--line);border-radius:32px;padding:44px;box-shadow:0 30px 70px #16201d14}
  .q-rot{font-size:26px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--muted)}
  .linha{height:22px;border-radius:11px;background:var(--line);margin-top:22px}
  .alt{display:flex;align-items:center;gap:24px;border:3px solid var(--line);border-radius:22px;padding:22px 26px;margin-top:20px;font-weight:800;font-size:34px}
  .alt .linha{flex:1;margin:0;height:18px}
  .alt.errada{border-color:#c2415b;background:#fdecef;color:#a3203b}
  .alt.certa{border-color:var(--brand);background:var(--brand-50);color:var(--brand)}
  .cal{display:flex;gap:18px;margin-top:50px}
  .dia{flex:1;border-radius:24px;background:#fff;border:2px solid var(--line);padding:24px 0;text-align:center;font-size:24px;font-weight:800;color:var(--muted);letter-spacing:1px}
  .dia strong{display:block;font-size:56px;color:var(--ink);letter-spacing:-2px;margin-top:6px}
  .dia.quente{background:var(--ink);border-color:var(--ink);color:#fff9}
  .dia.quente strong{color:#fff}
  .dia em{display:block;width:16px;height:16px;border-radius:50%;background:var(--ouro);margin:12px auto 0}

  /* 7 — MCP */
  #c-mcp{color:#eef6f2}
  #c-mcp .kicker{color:var(--ouro)}
  #c-mcp h1 em{color:#62b39c}
  .chat{margin-top:70px;display:flex;flex-direction:column;gap:26px}
  .bolha{max-width:820px;font-size:40px;line-height:1.35;padding:30px 38px;border-radius:34px}
  .bolha.eu{align-self:flex-end;background:#eef6f2;color:var(--ink);border-bottom-right-radius:10px}
  .bolha.ia{align-self:flex-start;background:#ffffff14;border:2px solid #ffffff22;border-bottom-left-radius:10px}
  .tool{align-self:flex-start;display:flex;align-items:center;gap:18px;font-family:var(--mono);font-size:29px;color:#cfe8df;
    background:#0f7a5f33;border:2px solid #0f7a5f;border-radius:18px;padding:18px 26px}
  .tool .st{width:30px;height:30px;border-radius:50%;border:4px solid #62b39c;border-right-color:transparent}
  .tool .st.ok{border:none;background:#62b39c;display:grid;place-items:center;color:var(--noite);font-size:22px;font-weight:900;font-family:var(--sans)}
  .tool b{color:var(--muted);font-weight:400}

  /* 8 — fecho */
  #c-fim{text-align:center;padding-top:560px}
  #c-fim .tile{width:210px;height:210px;border-radius:54px;font-size:98px;letter-spacing:-5px;margin:0 auto 70px;box-shadow:0 40px 90px #0f7a5f55}
  #c-fim h1{font-size:170px}
  .cta{display:inline-flex;gap:18px;align-items:center;margin-top:70px;background:var(--ink);color:#fff;font-size:42px;font-weight:800;padding:34px 56px;border-radius:999px}
  .cta span{color:var(--ouro)}
  .url{margin-top:44px;font-size:36px;font-weight:700;color:var(--brand)}
</style></head><body><div id="film">
<div id="grade"></div><div id="noite"></div>
<div class="barras" id="barras"></div>
<div class="topo"><div class="marca"><div class="tile">OA</div><span>OABase</span></div><div class="pill" id="pill">Lançamento</div></div>

<section class="cena" id="c-abertura">
  <div class="kicker">48º Exame de Ordem</div>
  <h1><span id="t-abertura"></span><span class="caret" id="caret-abertura"></span></h1>
  <p class="sub" id="abertura-sub">E você com <b>quantas abas</b> abertas?</p>
</section>
<div id="chips"></div>

<div id="logo-grande">OA</div>
<section class="cena" id="c-apresenta">
  <div class="kicker">Apresentando</div>
  <h1>OABase</h1>
  <p class="sub">A prova da OAB, estudada<br>com <b>a própria prova</b>.</p>
</section>

<section class="cena" id="c-acervo">
  <div class="kicker">O acervo</div>
  <h1 style="margin-bottom:60px">Contado.<br><em>Não chutado.</em></h1>
  <div class="num"><strong data-alvo="3540">0</strong><span>questões oficiais<br>da FGV</span></div>
  <div class="num"><strong data-alvo="44">0</strong><span>exames, do 3º<br>ao 46º</span></div>
  <div class="num"><strong data-alvo="9887">0</strong><span>artigos de 42 leis,<br>direto do Planalto</span></div>
  <div class="num"><strong data-alvo="3524">0</strong><span>questões<br>comentadas</span></div>
</section>

<section class="cena" id="c-busca">
  <div class="kicker">Busca</div>
  <h1>Você lembra do <em>crime</em>.<br>Não do número.</h1>
  <div class="caixa">
    <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#0f7a5f" stroke-width="2.6" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
    <span id="t-busca"></span><span class="caret" id="caret-busca" style="color:var(--brand)"></span>
  </div>
  <div class="res" id="r1"><div class="rot">Código Penal · Art. 155</div><h3>Furto</h3><p><mark>Subtrair</mark>, para si ou para outrem, coisa alheia móvel.</p></div>
  <div class="res" id="r2"><div class="rot">Código Penal · Art. 157</div><h3>Roubo</h3><p><mark>Subtrair</mark> coisa móvel alheia, para si ou para outrem, mediante grave ameaça ou violência a pessoa…</p></div>
  <p class="dica" id="dica">Sem acento, sem “art.”, sem decorar número.</p>
</section>

<section class="cena" id="c-inspetor">
  <div class="kicker">Treino honesto</div>
  <h1>Abriu o inspetor<br>pra <em>colar</em>? 👀</h1>
  <div class="devtools">
    <div class="dt-bar"><i></i><i></i><i></i><span>Network · fila_de_questoes</span></div>
    <div class="find"><span>⌘F</span><div class="campo"><span id="t-find"></span><span class="caret" id="caret-find"></span></div><span class="zero" id="zero">0 de 0</span></div>
<div class="json">{
  <span class="k">"exame"</span>: <span class="n">46</span>,
  <span class="k">"disciplina"</span>: <span class="s">"Ética"</span>,
  <span class="k">"enunciado"</span>: <span class="s">"…"</span>,
  <span class="k">"alternativas"</span>: [<span class="s">"A"</span>, <span class="s">"B"</span>, <span class="s">"C"</span>, <span class="s">"D"</span>]
  <span class="cm">// e mais nada.</span>
}</div>
  </div>
</section>
<div id="selo" style="display:none">O GABARITO<br>NÃO SAI DO BANCO</div>

<section class="cena" id="c-revisao">
  <div class="kicker">Caderno de erros</div>
  <h1>Errou? <em>Ela volta<br>amanhã.</em></h1>
  <div class="questao" id="questao">
    <div class="q-rot">Questão · Processo Civil</div>
    <div class="linha" style="width:100%"></div><div class="linha" style="width:92%"></div><div class="linha" style="width:60%;margin-bottom:14px"></div>
    <div class="alt" id="altA">A<div class="linha" style="width:70%"></div></div>
    <div class="alt" id="altB">B<div class="linha"></div></div>
    <div class="alt" id="altC">C<div class="linha" style="width:55%"></div></div>
  </div>
  <div class="cal" id="cal">
    <div class="dia">HOJE<strong id="d0"></strong></div>
    <div class="dia" id="amanha">AMANHÃ<strong id="d1"></strong><em></em></div>
    <div class="dia"><span id="w2"></span><strong id="d2"></strong></div>
    <div class="dia"><span id="w3"></span><strong id="d3"></strong></div>
  </div>
  <p class="sub" id="revisao-sub" style="font-size:36px">Errar tem de doer no calendário,<br>não só no número.</p>
</section>

<section class="cena" id="c-mcp">
  <div class="kicker">Novo · Servidor MCP</div>
  <h1>Agora dentro do<br>seu <em>assistente</em>.</h1>
  <div class="chat">
    <div class="bolha eu" id="b-eu"><span id="t-chat"></span><span class="caret" id="caret-chat"></span></div>
    <div class="tool" id="tool1"><div class="st" id="st1"></div>o_que_estudar_agora <b>· oabase</b></div>
    <div class="tool" id="tool2"><div class="st" id="st2"></div>consultar_revisoes_pendentes <b>· oabase</b></div>
    <div class="bolha ia" id="b-ia">Comece pelas revisões que venceram hoje. Depois, questões do seu roadmap — com a lei aberta do lado.</div>
  </div>
</section>

<section class="cena" id="c-fim">
  <div class="tile">OA</div>
  <h1>OABase</h1>
  <p class="sub">Seu sistema de estudos em Direito.</p>
  <div class="cta">Experimente 7 dias por <span>R$ 1</span></div>
  <p class="url">oabase.com.br</p>
</section>
</div>
<script>
const DIGITACAO = ${JSON.stringify(DIGITACAO)};
const DURACAO = ${DURACAO};

const $ = (s) => document.querySelector(s);
const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const p = (t, a, b) => cl((t - a) / (b - a));
const eo = (x) => 1 - Math.pow(1 - x, 3);
const eio = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const back = (x) => { const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const mix = (a, b, x) => a + (b - a) * x;

// Cenas: [id, início, fim]. A entrada sobe e desfoca de leve; a saída some.
const CENAS = [
  ["c-abertura", 0, 4.2], ["c-apresenta", 4.2, 8.2], ["c-acervo", 8.2, 14.2],
  ["c-busca", 14.2, 20.2], ["c-inspetor", 20.2, 23.8], ["c-revisao", 23.8, 27.4],
  ["c-mcp", 27.4, 32.6], ["c-fim", 32.6, DURACAO],
];
document.getElementById("barras").innerHTML = CENAS.map(() => "<i><b></b></i>").join("");
const barras = [...document.querySelectorAll("#barras b")];

function cena(t, id, a, b) {
  const el = document.getElementById(id);
  if (t < a || t >= b) { el.style.display = "none"; return; }
  const ent = eo(p(t, a, a + 0.45));
  const sai = b >= DURACAO ? 0 : eio(p(t, b - 0.3, b));
  el.style.display = "block";
  el.style.opacity = ent * (1 - sai);
  el.style.transform = "translateY(" + ((1 - ent) * 60 - sai * 40) + "px)";
  el.style.filter = "blur(" + ((1 - ent) * 8 + sai * 10) + "px)";
}

function digita(t, id, caretId) {
  const d = DIGITACAO.find((x) => x.id === id);
  const n = Math.floor(cl((t - d.inicio) * d.cps, 0, d.texto.length));
  document.getElementById(id).textContent = d.texto.slice(0, n);
  const fim = d.inicio + d.texto.length / d.cps;
  // o cursor fica aceso enquanto digita e pisca depois
  if (caretId) document.getElementById(caretId).style.opacity = t < fim || Math.floor(t * 2.2) % 2 === 0 ? 1 : 0;
}

function aparece(el, t, a, dur = 0.45, dy = 40) {
  const x = eo(p(t, a, a + dur));
  el.style.opacity = x;
  el.style.transform = "translateY(" + (1 - x) * dy + "px)";
}

// Abas da abertura — o caos que o produto organiza.
const CHIPS = [
  ["Vade Mecum 2026.pdf", "1.412 págs", "#c2415b", 90, 900, -6],
  ["resumo_FINAL_v7_agora_vai.docx", "", "#2b6cb0", 190, 1050, 4],
  ["Grupo OAB 😵", "318 msgs", "#25a244", 120, 1210, -3],
  ["súmula 473… ou era 437?", "", "#e9a23b", 330, 1350, 7],
  ["cronograma (abandonado)", "", "#7e2a44", 100, 1490, -5],
  ["aula 1 de 212", "2h14", "#e53e3e", 460, 1630, 5],
  ["simulado_2019_sem_gabarito", "", "#6b46c1", 200, 1760, -2],
];
const chips = document.getElementById("chips");
chips.innerHTML = CHIPS.map(([a, b, cor]) =>
  '<div class="chip" style="--c:' + cor + '"><i></i>' + a + (b ? " <s>" + b + "</s>" : "") + "</div>").join("");
const chipEls = [...chips.children];

const numeros = [...document.querySelectorAll("#c-acervo .num")];

// Datas do calendário da revisão, a partir de hoje.
const semana = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const hj = new Date();
[0, 1, 2, 3].forEach((i) => {
  const d = new Date(hj.getFullYear(), hj.getMonth(), hj.getDate() + i);
  document.getElementById("d" + i).textContent = d.getDate();
  if (i > 1) document.getElementById("w" + i).textContent = semana[d.getDay()];
});

window.render = (t) => {
  CENAS.forEach(([id, a, b]) => cena(t, id, a, b));
  CENAS.forEach(([, a, b], i) => (barras[i].style.width = p(t, a, b) * 100 + "%"));

  // Fundo escuro só na cena do MCP.
  const noite = p(t, 27.1, 27.6) * (1 - p(t, 32.3, 32.8));
  $("#noite").style.opacity = noite;
  $("#grade").style.opacity = 0.5 * (1 - noite);
  const tinta = noite > 0.5;
  $(".marca").style.color = tinta ? "#eef6f2" : "";
  $("#pill").style.color = tinta ? "#e9a23b" : "";
  $("#pill").textContent = tinta ? "Novo" : "Lançamento";
  document.querySelectorAll("#barras i").forEach((i) => (i.style.background = tinta ? "#ffffff26" : ""));
  barras.forEach((b) => (b.style.background = tinta ? "#eef6f2" : ""));

  // 1 — abertura
  digita(t, "t-abertura", "caret-abertura");
  aparece($("#abertura-sub"), t, 1.9);
  chipEls.forEach((el, i) => {
    const [, , , x, y, r] = CHIPS[i];
    const pop = back(p(t, 2.1 + i * 0.22, 2.5 + i * 0.22));
    // Em 4,2 s as abas são sugadas para o centro, onde nasce o logo.
    const suga = eio(p(t, 4.0 + i * 0.03, 4.75 + i * 0.03));
    const cx = mix(x, 540 - el.offsetWidth / 2, suga);
    const cy = mix(y, 770 - el.offsetHeight / 2, suga);
    const tremida = Math.sin(t * 9 + i) * 3 * (1 - suga);
    el.style.opacity = pop > 0 ? 1 - p(suga, 0.75, 1) : 0;
    el.style.transform = "translate(" + cx + "px," + (cy + tremida) + "px) rotate(" + mix(r, r * 4, suga) + "deg) scale(" + pop * (1 - suga * 0.85) + ")";
  });

  // 2 — o logo nasce das abas e sobe para o lugar do título
  const lg = $("#logo-grande");
  const nasce = back(p(t, 4.55, 5.15));
  const someLogo = eio(p(t, 7.9, 8.2));
  lg.style.display = t > 4.5 && t < 8.2 ? "grid" : "none";
  lg.style.transform = "scale(" + nasce * (1 - someLogo) + ") rotate(" + (1 - nasce) * -30 + "deg)";
  // o texto só entra depois que as abas viraram logo
  [...document.querySelectorAll("#c-apresenta > *")].forEach((el, i) => aparece(el, t, 5.1 + i * 0.18, 0.5, 40));

  // 3 — números que rolam
  numeros.forEach((el, i) => {
    const a = 8.7 + i * 0.55;
    aparece(el, t, a, 0.5, 50);
    const alvo = +el.querySelector("strong").dataset.alvo;
    el.querySelector("strong").textContent = Math.round(alvo * eo(p(t, a, a + 1.3))).toLocaleString("pt-BR");
  });

  // 4 — busca
  digita(t, "t-busca", "caret-busca");
  aparece($("#r1"), t, 15.9, 0.5, 60);
  aparece($("#r2"), t, 16.25, 0.5, 60);
  aparece($("#dica"), t, 17.4);

  // 5 — inspetor
  digita(t, "t-find", "caret-find");
  const zero = p(t, 21.75, 21.8);
  $("#zero").style.opacity = zero;
  const selo = $("#selo");
  selo.style.display = t >= 22.1 && t < 23.8 ? "block" : "none";
  const bate = p(t, 22.1, 22.35);
  selo.style.opacity = eo(bate) * (1 - p(t, 23.5, 23.8));
  selo.style.transform = "rotate(-9deg) scale(" + mix(2.4, 1, eo(bate)) + ")";

  // 6 — revisão: escolhe C, erra, a certa acende, a questão vai para amanhã
  $("#altC").className = "alt" + (t > 24.7 ? " errada" : "");
  $("#altA").className = "alt" + (t > 25.1 ? " certa" : "");
  const treme = t > 24.7 && t < 25.05 ? Math.sin(t * 90) * 10 : 0;
  $("#altC").style.transform = "translateX(" + treme + "px)";
  const voa = eio(p(t, 25.5, 26.1));
  $("#questao").style.transform = "translate(" + voa * -20 + "px," + voa * 420 + "px) scale(" + (1 - voa * 0.85) + ")";
  $("#questao").style.opacity = 1 - p(voa, 0.7, 1);
  // Com a questão guardada em "amanhã", o calendário sobe para o vão que ela deixou.
  const sobe = eio(p(t, 26.1, 26.6)) * -330;
  aparece($("#cal"), t, 24.2);
  $("#cal").style.transform += " translateY(" + sobe + "px)";
  const quente = p(t, 25.95, 26.1);
  $("#amanha").className = "dia" + (quente > 0 ? " quente" : "");
  $("#amanha").style.transform = "scale(" + (1 + Math.sin(quente * Math.PI) * 0.12) + ")";
  aparece($("#revisao-sub"), t, 26.4, 0.4, 20);
  $("#revisao-sub").style.transform += " translateY(" + sobe + "px)";

  // 7 — MCP
  digita(t, "t-chat", "caret-chat");
  $("#caret-chat").style.display = t > 29.2 ? "none" : "inline-block";
  aparece($("#b-eu"), t, 27.8, 0.3, 20);
  aparece($("#tool1"), t, 29.35, 0.35, 20);
  aparece($("#tool2"), t, 29.95, 0.35, 20);
  [["#st1", 30.2], ["#st2", 30.8]].forEach(([s, ok]) => {
    const el = $(s);
    el.className = "st" + (t > ok ? " ok" : "");
    el.textContent = t > ok ? "✓" : "";
    el.style.transform = t > ok ? "scale(" + back(p(t, ok, ok + 0.3)) + ")" : "rotate(" + t * 720 + "deg)";
  });
  aparece($("#b-ia"), t, 31.1, 0.45, 30);

  // 8 — fecho
  const fim = document.querySelector("#c-fim .tile");
  fim.style.transform = "scale(" + back(p(t, 32.8, 33.4)) + ")";
  aparece(document.querySelector("#c-fim .cta"), t, 33.6, 0.5, 30);
  aparece(document.querySelector("#c-fim .url"), t, 33.9, 0.5, 20);
  document.getElementById("film").style.opacity = 1 - p(t, DURACAO - 0.5, DURACAO);
};
</script></body></html>`;

// Trilha: um acorde suave que muda na cena escura, um "pop" em cada corte e
// um clique curto por tecla digitada.
function trilha() {
  const nota = (f, a) => `${a}*sin(2*PI*${f}*t)`;
  const acorde = (fs) => fs.map(([f, a]) => nota(f, a)).join("+");
  const claro = acorde([[110, 0.5], [220, 1], [277.18, 0.75], [329.63, 0.7], [440, 0.25]]);
  const escuro = acorde([[92.5, 0.5], [185, 1], [220, 0.75], [277.18, 0.7], [369.99, 0.25]]);
  const pad = `0.045*(if(between(t,27.4,32.6),${escuro},${claro}))*(0.7+0.3*sin(2*PI*0.2*t))`;
  // max(t-T,0): antes do instante, exp(-k*(t-T)) estoura para infinito, e
  // infinito × 0 é NaN — que o encoder recusa.
  const desde = (T) => `max(t-${T},0)`;
  const pops = CORTES.map((c) => `0.22*sin(2*PI*(520+300*exp(-30*${desde(c)}))*${desde(c)})*exp(-18*${desde(c)})*gte(t,${c})`);
  const cliques = [];
  for (const d of DIGITACAO) {
    if (!d.som) continue;
    [...d.texto].forEach((ch, i) => {
      if (ch === " ") return;
      const T = (d.inicio + i / d.cps).toFixed(3);
      const f = 1800 + ((i * 373) % 700);
      cliques.push(`0.07*sin(2*PI*${f}*${desde(T)})*exp(-260*${desde(T)})*gte(t,${T})`);
    });
  }
  return [pad, ...pops, ...cliques].join("+");
}

// PREVIA="2,9.5,17" PREVIA_DIR=/tmp/x node scripts/render-launch-video.mjs
// tira só os quadros desses instantes, sem vídeo — para ajustar layout.
if (process.env.PREVIA) {
  const dir = process.env.PREVIA_DIR ?? join(process.cwd(), ".previa");
  mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  for (const t of process.env.PREVIA.split(",").map(Number)) {
    await page.evaluate((t) => window.render(t), t);
    await page.screenshot({ path: join(dir, `t${t.toFixed(1)}.png`) });
  }
  await browser.close();
  process.exit(0);
}

mkdirSync(join(process.cwd(), "public", "videos"), { recursive: true });

const ffmpeg = spawn(
  "ffmpeg",
  [
    "-y", "-loglevel", "error",
    "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
    "-f", "lavfi", "-i", `aevalsrc=exprs='${trilha()}':s=44100:d=${DURACAO}`,
    "-filter:a", `afade=t=in:d=0.8,afade=t=out:st=${DURACAO - 1.5}:d=1.5,lowpass=f=6000,volume=1.4`,
    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart",
    saida,
  ],
  { stdio: ["pipe", "inherit", "inherit"] },
);
const terminou = new Promise((ok, erro) =>
  ffmpeg.on("close", (c) => (c === 0 ? ok() : erro(new Error(`ffmpeg saiu com ${c}`)))),
);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: "networkidle" });
// A folha do Google declara as faces, mas só baixa o que a página usa:
// carregar as combinações explicitamente antes do primeiro quadro.
const fontes = await page.evaluate(async () => {
  await Promise.all(
    ['600 100px "Source Serif 4"', 'italic 600 100px "Source Serif 4"', '400 40px "Plus Jakarta Sans"',
     '600 40px "Plus Jakarta Sans"', '800 40px "Plus Jakarta Sans"'].map((f) => document.fonts.load(f, "Aã")),
  );
  await document.fonts.ready;
  return [
  document.fonts.check('600 100px "Source Serif 4"'),
  document.fonts.check('800 40px "Plus Jakarta Sans"'),
  ];
});
if (!fontes.every(Boolean)) console.warn("Fontes do Google não carregaram — usando as de sistema.");

const total = Math.round(DURACAO * FPS);
for (let f = 0; f < total; f++) {
  await page.evaluate((t) => window.render(t), f / FPS);
  const quadro = await page.screenshot({ type: "jpeg", quality: 94 });
  if (!ffmpeg.stdin.write(quadro)) await new Promise((r) => ffmpeg.stdin.once("drain", r));
  if (f % (FPS * 3) === 0) process.stdout.write(`\r${Math.round((f / total) * 100)}%`);
}
ffmpeg.stdin.end();
await browser.close();
await terminou;
console.log(`\r100% — ${saida}`);
