/**
 * Formata data no formato "YYYY-MM-DD" sem passar por fuso horário.
 *
 * `new Date("2026-07-14")` é interpretado como meia-noite UTC; ao
 * formatar em horário de Brasília (UTC-3) o resultado volta um dia,
 * exibindo 13/07. Como só existe data — não instante — a conversão
 * de fuso não deveria acontecer em momento nenhum.
 */
export function formatarData(
  iso: string,
  opcoes: Intl.DateTimeFormatOptions = {},
): string {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", opcoes).format(
    new Date(ano, mes - 1, dia),
  );
}

/**
 * "hoje", "ontem", "há 3 dias" — a unidade de uma conversa.
 *
 * Numa lista de tickets ou de tópicos, a pergunta nunca é "que dia foi": é
 * "está parado há quanto tempo". Data absoluta obriga cada leitor a fazer
 * essa subtração de cabeça, em toda linha.
 *
 * **A granularidade é de dia, e isso não é preguiça.** Estes componentes
 * renderizam no servidor e hidratam no navegador; "há 2 minutos" calculado
 * nos dois lugares com um segundo de diferença vira divergência de
 * hidratação. Em dias, os dois lados concordam — exceto na virada da
 * meia-noite, quando o pior resultado possível é um "ontem" que demora um
 * refresh para virar "hoje".
 */
export function tempoRelativo(iso: string, hoje = new Date()): string {
  const [ano, mes, dia] = iso.slice(0, 10).split("-").map(Number);
  const alvo = new Date(ano, mes - 1, dia);
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const dias = Math.round((base.getTime() - alvo.getTime()) / 86_400_000);

  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 7) return `há ${dias} dias`;
  if (dias < 30) {
    const semanas = Math.floor(dias / 7);
    return `há ${semanas} ${semanas === 1 ? "semana" : "semanas"}`;
  }
  // Passado de um mês, a distância deixa de informar e a data volta a ser
  // mais útil do que "há 7 meses".
  return formatarData(iso.slice(0, 10), { day: "2-digit", month: "short" });
}

/**
 * A data já passou?
 *
 * Comparação em texto ISO contra o dia local, pelo mesmo motivo de
 * `formatarData`: `new Date("2026-09-06")` é meia-noite UTC e, em horário de
 * Brasília, faria a prova "acontecer" na véspera — a página do exame trocaria
 * de tempo verbal um dia antes da prova, dizendo que já tem gabarito.
 */
export function jaAconteceu(iso: string, hoje = new Date()): boolean {
  const dia = [
    hoje.getFullYear(),
    String(hoje.getMonth() + 1).padStart(2, "0"),
    String(hoje.getDate()).padStart(2, "0"),
  ].join("-");
  return iso <= dia;
}

/**
 * "do Código Civil", "da Constituição Federal".
 *
 * O nome da lei não carrega gênero, e concatenar um "da" fixo produzia
 * "Art. 1337 da Código Civil" — em título, em `<h1>` e na meta description de
 * cada um dos milhares de artigos. A primeira palavra do nome resolve: nomes
 * de norma no Brasil começam por um substantivo cujo gênero rege o resto.
 */
const NOMES_MASCULINOS = new Set([
  "código",
  "estatuto",
  "ato",
  "decreto",
  "regimento",
  "regulamento",
]);

export function daLei(nome: string): string {
  const primeira = nome.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  return NOMES_MASCULINOS.has(primeira) ? "do" : "da";
}

/**
 * Número de artigo como o jurista escreve: 1337 vira "1.337", e o sufixo de
 * letra é preservado ("121-A"). O separador é convenção do texto legal — só
 * na URL o número continua cru, porque lá ele é identificador e não texto.
 */
export function formatarNumeroDeArtigo(numero: string): string {
  return numero.replace(/^\d+/, (digitos) =>
    Number(digitos).toLocaleString("pt-BR"),
  );
}
