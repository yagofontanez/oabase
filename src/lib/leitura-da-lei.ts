/**
 * Texto de lei → texto para ser falado.
 *
 * A voz do navegador lê o que está escrito, e lei não se lê como se escreve:
 * "§ 1º" sairia "símbolo um", "IV -" sairia "i vê menos", "217-A" sairia
 * "duzentos e dezessete menos A". Quem estuda ouvindo no ônibus não tem a
 * página na frente para corrigir de cabeça — o que a voz disser é a lei.
 *
 * Só transforma notação; nunca resume, nunca reescreve o conteúdo. A única
 * coisa que sai é a nota de redação do Planalto ("(Redação dada pela Lei nº
 * 15.397, de 2026)"), que não é lei e, lida em voz alta, dobra o tamanho do
 * artigo. Ela continua na tela. **A revogação é a exceção**: "(Revogado pela
 * Lei nº ...)" vira a palavra "revogado", porque sem ela o inciso revogado
 * era lido como "Inciso 3." e silêncio — e quem ouve concluiria que ele está
 * em vigor e só perdeu o texto. 276 artigos e incisos do acervo são assim.
 *
 * Os casos dos testes são trechos reais do acervo.
 */

const ORDINAIS = ["", "primeiro", "segundo", "terceiro", "quarto", "quinto", "sexto", "sétimo", "oitavo", "nono"];

// Notas de redação, vigência e veto parcial — as mesmas que o vídeo de
// divulgação tira (scripts/video/dados.mjs), menos a revogação.
const REVOGACAO = /\s*\((Revogad[oa]s?)\b[^)]*\)/gi;
const NOTA =
  /\s*\((?:Redação|Incluíd|Vide|Acrescentad|Renumerad|Vigência|Regulamento|Promulgação|Declaração|Execução|Produção)[^)]*\)/gi;

const ORDINAL = "[ºo°]";
// Ordinal opcional depois do número. "º" e "°" podem vir com espaço; o "o"
// só colado e em fim de palavra — senão "art. 99 ou" perdia o "o" de "ou" e
// "§ 12 ocorrerão" virava "parágrafo 12correrão".
const ORDINAL_OPCIONAL = "(?:\\s*[º°]|o\\b)?";

/** "1" → "primeiro"; "10" continua "10" — acima do nono, lei se lê em cardinal. */
function ordinal(numero: string): string {
  const n = Number(numero);
  return n >= 1 && n <= 9 ? ORDINAIS[n] : numero;
}

const VALOR_ROMANO: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100 };

/** "XIV" → 14. Devolve null se não for romano válido. */
export function romano(texto: string): number | null {
  if (!/^[IVXLC]+$/.test(texto)) return null;
  let total = 0;
  for (let i = 0; i < texto.length; i++) {
    const atual = VALOR_ROMANO[texto[i]];
    const proximo = VALOR_ROMANO[texto[i + 1]] ?? 0;
    total += atual < proximo ? -atual : atual;
  }
  return total > 0 ? total : null;
}

/** Sufixo "-A", "-B" de dispositivo inserido: "217-A" → "217 A". */
const sufixo = (s: string | undefined) => (s ? ` ${s.replace(/^[\s-]+/, "")}` : "");

export function paraFala(original: string): string {
  let t = original
    .replace(REVOGACAO, (_m, palavra: string) => ` ${palavra.toLowerCase()}.`)
    .replace(NOTA, "")
    .replace(/\s+/g, " ")
    .trim();

  // Caput que o Planalto entrega começando por ". " (o 217-A do CP).
  t = t.replace(/^[.;:\s–-]+/, "");

  // Defeitos da fonte que a leitura contorna sem esconder: "Art. . 177"
  // (resto do travessão da CLT), "§ lº" (letra L no lugar do 1), "§ §".
  t = t.replace(/\bArt\.\s*\.\s*(?=\d)/g, "Art. ");
  t = t.replace(/§\s*l(?=\s*[º°])/g, "§ 1");
  t = t.replace(/§\s+§/g, "§§");

  // Inciso e alínea no começo do trecho: "IV - à traição" / "a) de ofício".
  t = t.replace(/^([IVXLC]+)\s*[-–—]\s*/, (m, r: string) => {
    const n = romano(r);
    return n ? `Inciso ${n}. ` : m;
  });
  t = t.replace(/^([a-z])\)\s*/, "Alínea $1. ");

  // Inciso inserido, no começo ou depois de ponto e vírgula: "; I-A o Conselho".
  t = t.replace(/(^|;\s*)([IVXLC]+)-([A-Z])\b[\s,–-]*/g, (m, antes: string, r: string, letra: string) => {
    const n = romano(r);
    return n ? `${antes}inciso ${n} ${letra}, ` : m;
  });

  // "1 (um)" → "um": o Planalto escreve o número duas vezes, a voz leria
  // as duas.
  // Vale para dinheiro também: "R$ 0,55 (cinqüenta e cinco centavos de real)".
  t = t.replace(
    /(?:(?:R|Cr|NCz|Cz)\$\s*)?\b\d+(?:\.\d{3})*(?:,\d+)?\s*\(([a-zà-ü][a-zà-ü\s-]*)\)/gi,
    "$1",
  );

  // Parágrafos: "§§ 1º, 3º e 4º" e "§ 4º-A".
  t = t.replace(/§§\s*/g, "parágrafos ");
  // O espaço antes do ordinal é opcional *junto com* o ordinal: sem isso,
  // "§ 10 Se" perdia o espaço e virava "parágrafo 10Se".
  t = t.replace(new RegExp(`§\\s*(\\d+)${ORDINAL_OPCIONAL}(-[A-Z])?\\.?`, "g"), (_m, n: string, s?: string) =>
    `parágrafo ${ordinal(n)}${sufixo(s)}`,
  );
  t = t.replace(/^parágrafo /, "Parágrafo ");

  // Artigos: "art. 5º", "arts. 157", "Art. 217-A".
  t = t.replace(
    new RegExp(`\\b([Aa])rt(s?)\\.\\s*(\\d+)${ORDINAL_OPCIONAL}(-[A-Z])?`, "g"),
    (_m, a: string, plural: string, n: string, s?: string) =>
      `${a === "A" ? "A" : "a"}rtigo${plural} ${ordinal(n)}${sufixo(s)}`,
  );

  // Inciso que começa depois de ponto, no meio do trecho — o Planalto às
  // vezes junta dois numa linha só: "VI - (Revogado). VII - contra:".
  t = t.replace(/([.;:]\s+)([IVXLC]+)\s*[-–]+\s*(?=[a-zà-ú(])/g, (m, antes: string, r: string) => {
    const n = romano(r);
    return n ? `${antes}Inciso ${n}. ` : m;
  });

  // Incisos, títulos e capítulos citados no meio do texto: "incisos I, III e V".
  t = t.replace(
    /\b(incisos?|inc\.|títulos?|capítulos?|seções?|livros?)\s+((?:[IVXLC]+(?:\s*,\s*|\s+e\s+|\s+a\s+)?)+)\b/gi,
    (_m, palavra: string, lista: string) => {
      const nome = palavra.toLowerCase() === "inc." ? "inciso" : palavra;
      return `${nome} ${lista.replace(/[IVXLC]+/g, (r) => String(romano(r) ?? r))}`;
    },
  );

  // Ordinais soltos: "1º de janeiro", "§ 2o" já tratado acima.
  t = t.replace(new RegExp(`\\b(\\d)${ORDINAL}(-[A-Z])?(?=[\\s,.;:)]|$)`, "g"), (_m, n: string, s?: string) =>
    `${ordinal(n)}${sufixo(s)}`,
  );

  // "nº 15.397" → "número 15.397"; "217-A" solto → "217 A".
  t = t.replace(/\bn[º°o]\.?\s*(?=\d)/gi, "número ");
  t = t.replace(/\b(\d+)-([A-Z])\b/g, "$1 $2");

  // Travessão de pena vira pausa: "Pena – reclusão".
  t = t.replace(/\s+[–—]\s+/g, ", ").replace(/\s+-\s+/g, ", ");

  // Pontuação que sobra de nota tirada: "revogado.;" / ". ;" / ", .".
  t = t.replace(/\s+([.;:,])/g, "$1").replace(/([.;:,])(?:\s*[.;:,])+/g, "$1");

  return t.replace(/\s+/g, " ").trim();
}

export type TrechoFalado = { fala: string; parte: number };

/**
 * Parte cada trecho em pedaços de até ~220 caracteres, na fronteira de frase
 * ou de ponto e vírgula. O Chrome interrompe sozinho uma fala longa (por
 * volta de 15 s) e não avisa; pedaços curtos também deixam pausar e retomar
 * sem voltar ao começo do artigo. `parte` diz qual `<p>` destacar.
 */
export function trechosParaFalar(partes: string[], limite = 220): TrechoFalado[] {
  const saida: TrechoFalado[] = [];
  partes.forEach((parte, indice) => {
    const fala = paraFala(parte);
    if (!fala) return;
    const frases = fala.match(/[^.;:]+[.;:]?\s*/g) ?? [fala];
    let atual = "";
    for (const frase of frases) {
      if (atual && (atual + frase).length > limite) {
        saida.push({ fala: atual.trim(), parte: indice });
        atual = "";
      }
      atual += frase;
    }
    if (atual.trim()) saida.push({ fala: atual.trim(), parte: indice });
  });
  return saida;
}
