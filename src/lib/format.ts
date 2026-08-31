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
