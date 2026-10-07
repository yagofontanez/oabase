// Vídeo do dia para TikTok/Reels.
//
//   pnpm video:dia                      # o de hoje
//   pnpm video:dia --dias 7             # hoje e os próximos 6 (lote da semana)
//   pnpm video:dia --data 2026-10-01    # um dia específico
//   pnpm video:dia --formato quiz       # força o formato (ignora a grade)
//   pnpm video:dia --previa             # só PNGs de alguns instantes, sem vídeo
//   pnpm video:dia --formato chute --item 0   # uma versão específica
//
// O formato sai do dia da semana, e o conteúdo percorre a lista de cada formato
// numa ordem sorteada uma vez só: o mesmo dia gera sempre o mesmo vídeo, e
// nada se repete antes de a lista acabar. Tudo que aparece na tela vem do
// banco (ver dados.mjs) — nenhum número é escrito à mão.
//
// Saída em videos/ (fora do git): o .mp4 e um .txt com legenda, hashtags e o
// comentário para fixar.

import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { renderizar, previa } from "./motor.mjs";
import { carregar, embaralhar, semente } from "./dados.mjs";
import { quiz } from "./formatos/quiz.mjs";
import { sumula } from "./formatos/sumula.mjs";
import { ranking } from "./formatos/ranking.mjs";
import { vf } from "./formatos/vf.mjs";
import { glossario } from "./formatos/glossario.mjs";
import { contagem } from "./formatos/contagem.mjs";
import { chute } from "./formatos/chute.mjs";
import { ouvir } from "./formatos/ouvir.mjs";
import { linhaDoTempo } from "./formatos/linha-do-tempo.mjs";
import { provaGratis } from "./formatos/prova-gratis.mjs";
import { mito } from "./formatos/mito.mjs";
import { conta } from "./formatos/conta.mjs";

const FORMATOS = { quiz, sumula, ranking, vf, glossario, contagem, chute, ouvir, "linha-do-tempo": linhaDoTempo, "prova-gratis": provaGratis, mito, conta };

// Dois dias seguidos nunca têm a mesma cara. O quiz vai duas vezes porque é o
// que mais puxa comentário — e comentário é o que o algoritmo lê.
// Os formatos de animação ("ouvir", "chute") entram na semana; "súmula" e
// "linha-do-tempo" (um vídeo só, o acervo inteiro) saem por --formato.
const GRADE = ["contagem", "quiz", "ouvir", "ranking", "chute", "glossario", "vf"]; // dom → sáb
const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const INICIO = new Date(2026, 8, 21); // segunda-feira; só ancora a contagem de ocorrências

const HASHTAGS = ["#oab", "#exameoab", "#examedeordem", "#direito", "#estudantededireito"];

const { values: args } = parseArgs({
  options: {
    data: { type: "string" },
    dias: { type: "string", default: "1" },
    formato: { type: "string" },
    item: { type: "string" },
    previa: { type: "boolean", default: false },
  },
});

function diaLocal(iso) {
  if (!iso) {
    const h = new Date();
    return new Date(h.getFullYear(), h.getMonth(), h.getDate());
  }
  const [a, m, d] = iso.split("-").map(Number); // nunca new Date("YYYY-MM-DD"): é UTC
  return new Date(a, m - 1, d);
}
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const somaDias = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

function formatoDoDia(dia) {
  if (args.formato) return args.formato;
  const f = GRADE[dia.getDay()];
  return FORMATOS[f].disponivel?.(dia) === false ? "quiz" : f;
}

/** Quantas vezes o formato já saiu desde INICIO — é o índice na lista dele. */
function ocorrencia(formato, dia) {
  let n = 0;
  for (let d = INICIO; d < dia; d = somaDias(d, 1)) if (formatoDoDia(d) === formato) n++;
  return n;
}

const dados = await carregar();
const pools = Object.fromEntries(
  // `ordemFixa`: a lista já vem na ordem certa (o "chute" abre com o acervo
  // inteiro e depois vai prova a prova, da mais recente).
  Object.values(FORMATOS).map((f) => [f.id, f.ordemFixa ? f.pool(dados) : embaralhar(f.pool(dados), semente(f.id))]),
);
console.log(
  "Acervo:",
  Object.entries(pools).map(([k, v]) => `${k} ${v.length}`).join(" · "),
);

const primeiro = diaLocal(args.data);
const browser = args.previa ? null : await chromium.launch({ headless: true });

for (let i = 0; i < Number(args.dias); i++) {
  const dia = somaDias(primeiro, i);
  const id = formatoDoDia(dia);
  const formato = FORMATOS[id];
  if (!formato) throw new Error(`Formato desconhecido: ${id}. Existem: ${Object.keys(FORMATOS).join(", ")}`);
  const pool = pools[id];
  if (!pool.length) throw new Error(`Formato ${id} sem conteúdo no acervo`);

  // `--item N` escolhe a versão à mão (0 = a primeira da lista).
  const n = args.item !== undefined ? Number(args.item) : ocorrencia(id, dia);
  const item = pool[n % pool.length];
  const r = await formato.roteiro(item, { dados, dia, rng: semente(`${id}-${iso(dia)}`) });
  const nome = `${iso(dia)}-${SEMANA[dia.getDay()].replace("á", "a")}-${r.slug}`;
  const volta = n >= pool.length ? ` (lista esgotada, ${Math.floor(n / pool.length) + 1}ª volta)` : "";
  process.stdout.write(`${iso(dia)} ${SEMANA[dia.getDay()]} · ${formato.nome} · ${r.slug} · ${r.duracao.toFixed(1)}s${volta}`);

  if (args.previa) {
    const tempos = [0.06, 0.22, 0.45, 0.7, 0.95].map((x) => +(x * r.duracao).toFixed(1));
    await previa({ html: r.html, tempos, dir: join(process.cwd(), "videos", "previa"), prefixo: `${nome}-` });
    console.log(" → videos/previa/");
    continue;
  }

  const saida = join(process.cwd(), "videos", `${nome}.mp4`);
  await renderizar({ html: r.html, duracao: r.duracao, audio: r.audio, saida, browser });

  const hashtags = [...new Set([...HASHTAGS, ...r.hashtags])].slice(0, 7).join(" ");
  writeFileSync(
    join(process.cwd(), "videos", `${nome}.txt`),
    [
      `${SEMANA[dia.getDay()]}, ${iso(dia).split("-").reverse().join("/")} · ${formato.nome}`,
      "",
      "── LEGENDA ──",
      r.legenda,
      "",
      hashtags,
      "",
      "── COMENTÁRIO PARA FIXAR ──",
      r.comentario,
      "",
    ].join("\n"),
  );
  console.log(` → videos/${nome}.mp4`);
}

await browser?.close();
