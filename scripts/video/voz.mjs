// Narração dos vídeos: um trecho de texto vira um .wav (44,1 kHz, mono).
//
// Com ELEVENLABS_API_KEY e ELEVENLABS_VOICE_ID no ambiente, a voz é da
// ElevenLabs (modelo multilingual v2, o mais estável em pt-BR); sem elas, é a
// Luciana do macOS (`say`). O gerador nunca depende de rede para funcionar.
//
// Cada trecho gerado fica em cache pelo texto + voz + modelo: renderizar o
// mesmo vídeo de novo, para ajustar um quadro, não gasta cota de caracteres.
// A API só recebe o roteiro do vídeo — nenhum dado de usuário.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CHAVE = process.env.ELEVENLABS_API_KEY;
const VOZ_ID = process.env.ELEVENLABS_VOICE_ID;
const MODELO = "eleven_multilingual_v2";
const CACHE = join(process.cwd(), "videos", ".voz");

export const vozDescricao = CHAVE && VOZ_ID ? `ElevenLabs ${VOZ_ID} (${MODELO})` : "macOS say (Luciana)";

/** Grava `texto` em `wav` e devolve o caminho. Síncrono por fora, como o resto do gerador. */
export async function falar(texto, wav, { velocidadeSay = 185 } = {}) {
  if (!(CHAVE && VOZ_ID)) {
    const aiff = wav.replace(/\.wav$/, ".aiff");
    execFileSync("say", ["-v", "Luciana", "-r", String(velocidadeSay), "-o", aiff, texto]);
    execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", aiff, "-ar", "44100", "-ac", "1", wav]);
    return wav;
  }

  mkdirSync(CACHE, { recursive: true });
  const chave = createHash("sha256").update(`${VOZ_ID}|${MODELO}|${texto}`).digest("hex").slice(0, 24);
  const mp3 = join(CACHE, `${chave}.mp3`);
  if (!existsSync(mp3)) {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOZ_ID}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": CHAVE, "Content-Type": "application/json" },
      body: JSON.stringify({ text: texto, model_id: MODELO, language_code: "pt" }),
    });
    if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${(await r.text()).slice(0, 200)}`);
    writeFileSync(mp3, Buffer.from(await r.arrayBuffer()));
  }
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", mp3, "-ar", "44100", "-ac", "1", wav]);
  return wav;
}

const duracaoDe = (arq) =>
  Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", arq], { encoding: "utf8" }));

/**
 * Narra uma sequência de cenas e devolve onde cada uma começa e termina.
 * A cena dura o que a fala dela pede (mais um respiro), nunca menos que `min`
 * — é a voz que marca o ritmo do vídeo, e não o contrário.
 */
export async function narrar(cenas, pasta, { respiro = 0.55, atraso = 0.2 } = {}) {
  mkdirSync(pasta, { recursive: true });
  let t = 0;
  const trechos = [];
  for (const [i, c] of cenas.entries()) {
    const wav = await falar(c.fala, join(pasta, `n${i}.wav`));
    const voz = duracaoDe(wav);
    const fim = t + Math.max(c.min ?? 0, voz + atraso + respiro);
    trechos.push({ ...c, inicio: t, fim, voz, wav, falaEm: i === 0 ? 0.05 : t + atraso });
    t = fim;
  }
  const arquivo = join(pasta, "narracao.wav");
  execFileSync("ffmpeg", [
    "-loglevel", "error", "-y", ...trechos.flatMap((c) => ["-i", c.wav]),
    "-filter_complex",
    trechos.map((c, i) => `[${i}:a]adelay=${Math.round(c.falaEm * 1000)}[d${i}]`).join(";") + ";" +
      trechos.map((_, i) => `[d${i}]`).join("") + `amix=inputs=${trechos.length}:normalize=0,apad=whole_dur=${t}[s]`,
    "-map", "[s]", "-ar", "44100", "-ac", "1", arquivo,
  ]);
  return { arquivo, duracao: t, cenas: Object.fromEntries(trechos.map((c) => [c.id, c])) };
}

const UNIDADES = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

/** Número inteiro por extenso, até 999.999 — a narração não arrisca ler "3.524" como decimal.
    `fem` concorda com substantivo feminino: "duzentas e uma questões". */
export function extenso(n, fem = false) {
  if (fem) return extenso(n).replace(/\bum\b/g, "uma").replace(/\bdois\b/g, "duas").replace(/entos\b/g, "entas");
  n = Math.round(n);
  if (n < 20) return UNIDADES[n];
  if (n < 100) return DEZENAS[Math.floor(n / 10)] + (n % 10 ? " e " + UNIDADES[n % 10] : "");
  if (n === 100) return "cem";
  if (n < 1000) return CENTENAS[Math.floor(n / 100)] + (n % 100 ? " e " + extenso(n % 100) : "");
  const mil = Math.floor(n / 1000), resto = n % 1000;
  const cabeca = mil === 1 ? "mil" : `${extenso(mil)} mil`;
  if (!resto) return cabeca;
  return cabeca + (resto < 100 || resto % 100 === 0 ? " e " : " ") + extenso(resto);
}
