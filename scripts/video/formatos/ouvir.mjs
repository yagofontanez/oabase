// "A lei, lida pra você" — um artigo lido em voz alta, dentro de um celular,
// com o trecho que está sendo falado aceso na tela e a onda do áudio real
// embaixo. É o recurso de ouvir a lei do site, mostrado funcionando.
//
// A voz é a Luciana do macOS (`say`), e o texto falado passa pelas mesmas
// regras do botão do site (src/lib/leitura-da-lei.ts): "§ 1º" vira
// "parágrafo primeiro", nota de redação não é lida. O vídeo diz exatamente o
// que o site diz. Só roda em Mac — é onde o `say` existe.

import { falar } from "../voz.mjs";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pagina, trilha, escapa, FPS } from "../motor.mjs";
import { daLei, limpar, tomLeve } from "../dados.mjs";
import { trechosParaFalar } from "../../../src/lib/leitura-da-lei.ts";

const VELOCIDADE = 188; // palavras por minuto
const LIMITE_FALA = 330; // caracteres falados: ~22 s de voz — vídeo em ~30 s
const INICIO_VOZ = 2.3;
const PAUSA = 0.32;

/** Trechos do artigo que cabem no tempo, inteiros, parando antes de revogação. */
function selecionar(partes) {
  const escolhidas = [];
  let total = 0;
  for (const parte of partes) {
    if (/\(Revogad/i.test(parte)) break;
    const fala = trechosParaFalar([parte]).map((t) => t.fala).join(" ");
    if (!fala) continue;
    // Trecho que termina em dois-pontos pede o seguinte: parar em "nos
    // termos seguintes:" soa como frase cortada. Aceita passar um pouco.
    const pedeContinuacao = escolhidas.length > 0 && /:\s*$/.test(limpar(escolhidas.at(-1)));
    if (total + fala.length > LIMITE_FALA + (pedeContinuacao ? 120 : 0)) break;
    escolhidas.push(parte);
    total += fala.length;
  }
  return escolhidas;
}

const duracaoDe = (arq) =>
  Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", arq], { encoding: "utf8" }));

/**
 * Grava a fala trecho a trecho e devolve o arquivo final, o momento de cada
 * trecho e o volume de cada quadro (para a onda). Gravar separado é o que dá
 * a sincronia: o `say` não informa onde cada frase começa num áudio único.
 */
async function gravarVoz(pedacos, pasta) {
  let t = INICIO_VOZ;
  const tempos = [];
  const arquivos = [];
  for (const [i, p] of pedacos.entries()) {
    const wav = join(pasta, `t${i}.wav`);
    await falar(p.fala, wav, { velocidadeSay: VELOCIDADE });
    const d = duracaoDe(wav);
    tempos.push({ ...p, inicio: t, fim: t + d });
    arquivos.push(wav);
    t += d + PAUSA;
  }

  // Silêncio de abertura + trechos com pausa entre eles, num wav só.
  const final = join(pasta, "voz.wav");
  const entradas = arquivos.flatMap((a) => ["-i", a]);
  const filtros =
    arquivos.map((_, i) => `[${i}:a]apad=pad_dur=${PAUSA}[p${i}]`).join(";") +
    ";" + arquivos.map((_, i) => `[p${i}]`).join("") + `concat=n=${arquivos.length}:v=0:a=1,adelay=${Math.round(INICIO_VOZ * 1000)}[s]`;
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", ...entradas, "-filter_complex", filtros, "-map", "[s]", "-ar", "44100", "-ac", "1", final]);

  // Envelope: volume médio de cada quadro do vídeo, para as barras da onda.
  const bruto = execFileSync("ffmpeg", ["-loglevel", "error", "-i", final, "-f", "s16le", "-ac", "1", "-ar", "8000", "-"], { maxBuffer: 1 << 28 });
  const amostras = new Int16Array(bruto.buffer, bruto.byteOffset, bruto.length / 2);
  const porQuadro = 8000 / FPS;
  const envelope = [];
  for (let q = 0; q * porQuadro < amostras.length; q++) {
    let soma = 0;
    const ini = Math.floor(q * porQuadro), fim = Math.min(amostras.length, Math.floor((q + 1) * porQuadro));
    for (let k = ini; k < fim; k++) soma += amostras[k] * amostras[k];
    envelope.push(Math.sqrt(soma / Math.max(1, fim - ini)) / 32768);
  }
  const pico = Math.max(...envelope, 1e-6);
  return { arquivo: final, tempos, envelope: envelope.map((v) => Math.round((v / pico) * 100) / 100), duracao: t - PAUSA };
}

export const ouvir = {
  id: "ouvir",
  nome: "A lei, lida pra você",
  pool: (d) =>
    d.artigos.filter(tomLeve).filter((a) => {
      const s = selecionar(a.partes);
      // Texto curto deixa meia tela vazia no celular — e tela vazia não
      // segura ninguém. Só artigo que preenche.
      return s.length > 0 && trechosParaFalar(s).reduce((n, t) => n + t.fala.length, 0) >= 200;
    }),

  async roteiro(a, { dia }) {
    const partes = selecionar(a.partes);
    const titulo = `Art. ${a.numero} ${daLei(a.lei)}.`;
    const pedacos = [
      ...trechosParaFalar([titulo]).map((t) => ({ fala: t.fala, parte: null })),
      ...trechosParaFalar(partes).map((t) => ({ fala: t.fala, parte: t.parte })),
    ];

    const pasta = join(tmpdir(), `oabase-voz-${a.lei.slug}-${a.slug}-${dia.getTime()}`);
    rmSync(pasta, { recursive: true, force: true });
    mkdirSync(pasta, { recursive: true });
    const voz = await gravarVoz(pedacos, pasta);

    const C = voz.duracao + 0.6; // chamada final
    const FIM = C + 3.4;

    const corpo = `
<section class="cena" id="gancho" style="padding-top:560px">
  <div class="kicker">Lei seca no fone 🎧</div>
  <h1 style="font-size:132px">Sem tempo pra ler a lei?</h1>
  <p class="sub">Deixa que a gente lê.</p>
</section>
<div id="rotulo"><span class="ponto"></span> Ouvindo · ${escapa(a.lei.sigla)} art. ${escapa(a.numero)}</div>
<div id="celular">
  <div class="tela">
    <div class="barra-url">oabase.com.br/legislacao/${escapa(a.lei.slug)}</div>
    <div class="rolagem" id="rolagem">
      <div class="k">${escapa(a.lei.nome)}</div>
      <h2>Art. ${escapa(a.numero)}</h2>
      ${partes.map((p, i) => `<p class="trecho" data-p="${i}"><span>${escapa(limpar(p))}</span></p>`).join("")}
    </div>
    <div class="player">
      <div class="botao">❚❚</div>
      <div class="onda" id="onda">${Array.from({ length: 34 }, () => "<i></i>").join("")}</div>
      <div class="tempo" id="tempo">0:00</div>
    </div>
  </div>
</div>
<section class="cena" id="fecho" style="padding-top:560px;text-align:center">
  <div class="kicker">Qualquer artigo, em voz alta</div>
  <h1 style="font-size:124px">Estude a lei seca <em>ouvindo</em>.</h1>
  <p class="sub">No ônibus, na academia, lavando a louça.</p>
  <div style="margin-top:56px"><span class="cta">oabase.com.br</span></div>
</section>`;

    const css = `
  #rotulo{position:absolute;left:0;right:0;top:250px;text-align:center;font-size:34px;font-weight:800;color:#eef6f2;z-index:4;letter-spacing:.5px}
  #rotulo .ponto{display:inline-block;width:18px;height:18px;border-radius:50%;background:#dc6b8f;margin-right:12px;vertical-align:1px}
  #celular{position:absolute;left:170px;width:740px;top:350px;height:1170px;border-radius:78px;background:#0c1512;padding:22px;
    box-shadow:0 60px 120px #000a, inset 0 0 0 3px #2a3a35;z-index:3}
  .tela{position:relative;height:100%;border-radius:58px;background:var(--paper);overflow:hidden;display:flex;flex-direction:column}
  .barra-url{margin:30px 36px 0;padding:14px 22px;border-radius:999px;background:#e6ede9;font-size:22px;color:var(--muted);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .rolagem{flex:1;overflow:hidden;padding:40px 46px 0}
  .rolagem .k{font-size:22px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--brand)}
  .rolagem h2{font-family:var(--serif);font-weight:600;font-size:72px;letter-spacing:-2px;color:var(--ink);margin:6px 0 26px}
  .trecho{font-family:var(--serif);font-size:39px;line-height:1.45;color:#8a9893;margin:0 0 20px;padding:6px 10px;border-radius:14px;transition:none}
  .trecho.lido{color:var(--ink)}
  .trecho.agora{color:var(--ink);background:linear-gradient(90deg,#cfe8df var(--progresso,0%),#ebf5f1 var(--progresso,0%))}
  .player{display:flex;align-items:center;gap:22px;padding:26px 40px 40px;background:#fff;border-top:2px solid var(--line)}
  .botao{width:74px;height:74px;border-radius:50%;background:var(--brand);color:#fff;display:grid;place-items:center;font-size:26px;flex:none}
  .onda{flex:1;height:74px;display:flex;align-items:center;gap:5px}
  .onda i{flex:1;background:var(--brand);border-radius:4px;height:8%;opacity:.85}
  .tempo{font-size:26px;font-weight:700;color:var(--muted);font-variant-numeric:tabular-nums;flex:none}`;

    const js = `
const FIM = ${FIM};
const T = ${JSON.stringify(voz.tempos.map((t) => ({ i: t.inicio, f: t.fim, p: t.parte })))};
const ENV = ${JSON.stringify(voz.envelope)};
const barras = $$("#onda i");
let ALVOS = [];
window.preparar = () => {
  ALVOS = $$(".trecho").map((el) => Math.max(0, el.offsetTop - 260));
};
window.render = (t) => {
  // O gancho sai por completo antes de o celular entrar: sobrepostos, os
  // dois textos viravam uma mancha.
  cena(t, "#gancho", 0, ${INICIO_VOZ - 0.45}, FIM);
  // O celular sobe no fim do gancho e sai para a chamada final.
  const entra = eo(p(t, ${INICIO_VOZ - 0.4}, ${INICIO_VOZ + 0.15}));
  const sai = eio(p(t, ${C - 0.2}, ${C + 0.4}));
  $("#celular").style.opacity = entra * (1 - sai);
  $("#celular").style.transform = "translateY(" + ((1 - entra) * 240 + sai * -80) + "px) scale(" + (1 - sai * 0.08) + ")";
  $("#rotulo").style.opacity = entra * (1 - sai);
  $("#rotulo .ponto").style.opacity = 0.35 + 0.65 * Math.abs(Math.sin(t * 3));

  // Trecho falado agora: aceso, com o avanço dentro dele no ritmo da voz.
  const atual = T.find((x) => t >= x.i && t < x.f + ${PAUSA});
  const parteAtual = atual ? atual.p : null;
  $$(".trecho").forEach((el) => {
    const i = Number(el.dataset.p);
    const doTrecho = T.filter((x) => x.p === i);
    const ini = doTrecho[0]?.i ?? Infinity, fim = doTrecho.at(-1)?.f ?? Infinity;
    el.classList.toggle("agora", i === parteAtual);
    el.classList.toggle("lido", t >= fim);
    if (i === parteAtual) el.style.setProperty("--progresso", (100 * p(t, ini, fim)).toFixed(1) + "%");
  });
  // Rolagem: o trecho falado fica no terço de cima da tela. Só depende do
  // tempo (regra do motor): desliza do alvo do trecho anterior para o do
  // atual no primeiro meio segundo dele.
  if (parteAtual !== null) {
    const ini = T.find((x) => x.p === parteAtual).i;
    const antes = ALVOS[Math.max(0, parteAtual - 1)], agora = ALVOS[parteAtual];
    $("#rolagem").scrollTop = mix(antes, agora, eio(p(t, ini, ini + 0.5)));
  }

  // Onda: o volume real da voz nos quadros vizinhos.
  const q = Math.round(t * ${FPS});
  barras.forEach((b, k) => {
    const v = ENV[q + k - 17] ?? 0;
    b.style.height = Math.max(8, v * 100) + "%";
  });
  const s = Math.max(0, Math.min(t, ${voz.duracao}) - ${INICIO_VOZ});
  $("#tempo").textContent = Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");

  cena(t, "#fecho", ${C}, FIM, FIM);
};`;

    return {
      slug: `ouvir-${a.lei.slug}-${a.slug}`,
      duracao: FIM,
      html: pagina({ corpo, css, js, pill: "Ouvir a lei", duracao: FIM, escuro: true }),
      audio: { ...trilha({ duracao: FIM, acorde: [220, 277.18, 329.63], cortes: [INICIO_VOZ - 0.45, C] }), voz: voz.arquivo },
      legenda: [
        `Art. ${a.numero} ${daLei(a.lei)}, lido pra você 🎧`,
        "Lei seca no ônibus, na academia, lavando a louça. Aperta o play em qualquer artigo.",
        "",
        "oabase.com.br",
      ].join("\n"),
      hashtags: ["#leiseca", "#estudos"],
      comentario: "Qual artigo você quer ouvir no próximo? 👇",
    };
  },
};
