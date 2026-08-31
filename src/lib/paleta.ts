/**
 * Rampa do cartão-resposta: sete degraus para os sete grupos da legenda.
 *
 * A cor vem da POSIÇÃO no ranking, não do número bruto de questões. Isso
 * importa: colorindo pelo número, disciplinas empatadas (duas com 8, duas
 * com 7, quatro com 5) recebiam o mesmo tom e se fundiam num degradê
 * contínuo — bonito e ilegível. Por posição, grupos vizinhos sempre
 * diferem em um degrau e cada bloco tem fronteira visível.
 *
 * Sobre o fundo escuro do hero, brilho continua sendo incidência. Os
 * degraus são espaçados para serem perceptualmente parelhos: uma rampa
 * com as pontas comprimidas volta a parecer um degradê contínuo, que é
 * exatamente o problema que ela existe para resolver.
 */
const RAMPA = [
  "#EAF6F3",
  "#A8DDD6",
  "#6FC4BC",
  "#38A69E",
  "#1A8480",
  "#106260",
  "#0A4544",
];

export const DEGRAUS = RAMPA.length;

export function corPorPosicao(posicao: number): string {
  return RAMPA[Math.min(posicao, RAMPA.length - 1)];
}
