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
