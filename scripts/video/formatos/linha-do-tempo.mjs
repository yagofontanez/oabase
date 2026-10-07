// "15 anos de OAB em 15 segundos" — as provas do acervo passando pela tela,
// da primeira à última. O ano gira como contador, as questões se acumulam, e
// cada prova com questão anulada pisca em vermelho. Termina no tamanho do
// acervo: tudo isso está resolvível no OABase.
//
// Dados da tabela `exames` (leitura aberta): edição, ano, questões
// carregadas e anuladas. Nada escrito à mão.

import { pagina, trilha, escapa } from "../motor.mjs";
import { fmt } from "../dados.mjs";

export const linhaDoTempo = {
  id: "linha-do-tempo",
  nome: "15 anos de OAB",
  ordemFixa: true,
  // Um vídeo só: o acervo inteiro. Muda sozinho quando entra prova nova.
  pool: (d) => (d.exames.length ? [{ exames: d.exames }] : []),

  roteiro({ exames }) {
    const primeiro = exames[0], ultimo = exames.at(-1);
    const anos = Number(ultimo.ano) - Number(primeiro.ano);
    const totalQ = exames.reduce((s, e) => s + e.questoes_carregadas, 0);
    const totalAnuladas = exames.reduce((s, e) => s + e.questoes_anuladas, 0);

    const H = 2.2; // fim do gancho
    const RODA = [H + 0.3, H + 9.6];
    const S = RODA[1] + 0.5; // síntese
    const F = S + 3.2; // fecho
    const FIM = F + 3.4;

    const corpo = `
<section class="cena" id="gancho" style="padding-top:560px">
  <div class="kicker">Exame de Ordem, ${primeiro.ano}–${ultimo.ano}</div>
  <h1 style="font-size:132px">${anos} anos de OAB em ${Math.round(RODA[1] - RODA[0])} segundos.</h1>
</section>
<div id="palco">
  <div id="rotulo-ano">ano</div>
  <div id="ano"><div id="rolo">${exames.map((e) => `<div>${e.ano}</div>`).join("")}</div></div>
  <div id="fita">${exames.map((e, i) => `
    <div class="prova${e.questoes_anuladas ? " anulou" : ""}" data-i="${i}">
      <b>${e.edicao}º</b><span>Exame</span>
      <div class="pontos">${Array.from({ length: 20 }, () => "<i></i>").join("")}</div>
      ${e.questoes_anuladas ? `<em>${e.questoes_anuladas} anulada${e.questoes_anuladas > 1 ? "s" : ""}</em>` : ""}
    </div>`).join("")}
  </div>
  <div id="linha-centro"></div>
  <div id="placar">
    <div><strong id="nq">0</strong><span>questões oficiais</span></div>
    <div><strong id="np">0</strong><span>provas</span></div>
    <div class="vermelho"><strong id="na">0</strong><span>anuladas</span></div>
  </div>
</div>
<section class="cena" id="sintese" style="padding-top:470px">
  <div class="kicker">O acervo inteiro</div>
  <h1 style="font-size:120px">${fmt(totalQ)} questões.<br><em>Todas com gabarito oficial.</em></h1>
  <p class="sub">${exames.length} provas, do ${primeiro.edicao}º ao ${ultimo.edicao}º Exame. As ${totalAnuladas} anuladas ficam marcadas — nenhuma treina resposta errada.</p>
</section>
<section class="cena" id="fecho" style="padding-top:560px;text-align:center">
  <div class="tile" style="width:190px;height:190px;border-radius:48px;font-size:90px;margin:0 auto 60px">OA</div>
  <h1 style="font-size:130px">Resolva a prova<br>de <em>verdade</em>.</h1>
  <div style="margin-top:56px"><span class="cta">oabase.com.br</span></div>
</section>`;

    const css = `
  #palco{position:absolute;inset:0;z-index:2;opacity:0}
  #rotulo-ano{position:absolute;top:300px;left:0;right:0;text-align:center;font-size:28px;font-weight:800;letter-spacing:5px;text-transform:uppercase;color:var(--ouro)}
  #ano{position:absolute;top:350px;left:0;right:0;height:300px;overflow:hidden;text-align:center;
    -webkit-mask-image:linear-gradient(transparent,#000 22%,#000 78%,transparent)}
  #rolo div{height:300px;line-height:300px;font-family:var(--serif);font-weight:600;font-size:280px;letter-spacing:-12px;color:#eef6f2;font-variant-numeric:tabular-nums}
  #fita{position:absolute;top:760px;left:0;height:330px;width:100%}
  .prova{position:absolute;top:0;left:0;width:210px;height:300px;margin-left:-105px;border-radius:28px;background:#ffffff0f;border:2px solid #ffffff1f;
    display:flex;flex-direction:column;align-items:center;padding-top:34px;color:#cfe3db}
  .prova b{font-family:var(--serif);font-size:84px;font-weight:600;line-height:1;color:#eef6f2}
  .prova span{font-size:24px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-top:6px;color:#8fb3a6}
  .pontos{display:grid;grid-template-columns:repeat(5,14px);gap:8px;margin-top:22px}
  .pontos i{width:14px;height:14px;border-radius:50%;background:#62b39c}
  .prova em{position:absolute;bottom:-58px;font-style:normal;font-size:24px;font-weight:800;color:#ff8f8f;white-space:nowrap;opacity:0}
  .prova.anulou .pontos i:first-child{background:#dc6b8f}
  #linha-centro{position:absolute;left:538px;top:720px;width:4px;height:420px;border-radius:2px;background:linear-gradient(#e9a23b00,#e9a23b,#e9a23b00)}
  #placar{position:absolute;top:1230px;left:90px;right:90px;display:grid;grid-template-columns:1.5fr 1fr 1fr;gap:20px}
  #placar div{border-top:3px solid #ffffff22;padding-top:18px}
  #placar strong{display:block;font-family:var(--serif);font-weight:600;font-size:88px;line-height:1;color:#eef6f2;font-variant-numeric:tabular-nums;letter-spacing:-3px}
  #placar span{display:block;margin-top:10px;font-size:26px;font-weight:700;color:#8fb3a6}
  #placar .vermelho strong{color:#ff8f8f}`;

    const dados = exames.map((e) => ({ q: e.questoes_carregadas, a: e.questoes_anuladas }));
    const js = `
const FIM = ${FIM};
const E = ${JSON.stringify(dados)};
const R = [${RODA}];
const N = E.length, ESPACO = 250;
const acum = (k, campo) => E.slice(0, k + 1).reduce((s, e) => s + e[campo], 0);
window.render = (t) => {
  cena(t, "#gancho", 0, ${H}, FIM);
  const palco = eo(p(t, ${H}, ${H} + 0.5)) * (1 - p(t, ${S} - 0.35, ${S}));
  $("#palco").style.opacity = t >= ${H} && t < ${S} ? palco : 0;

  // Posição na fita: arranca devagar, corre no meio, freia na última prova.
  const pos = eio(p(t, R[0], R[1])) * (N - 1);
  const atual = Math.round(pos);
  $$(".prova").forEach((el, i) => {
    const d = i - pos;
    el.style.transform = "translateX(" + (540 + d * ESPACO) + "px) scale(" + (1 + 0.22 * Math.max(0, 1 - Math.abs(d))) + ")";
    el.style.opacity = Math.max(0, 1 - Math.abs(d) / 4.2);
    el.style.borderColor = Math.abs(d) < 0.5 ? "#e9a23b" : "";
    const aviso = el.querySelector("em");
    if (aviso) aviso.style.opacity = Math.abs(d) < 0.6 ? 1 : 0;
    if (el.classList.contains("anulou")) el.style.background = Math.abs(d) < 0.5 ? "#dc6b8f33" : "";
  });
  // O ano rola como contador: o rolo desce até a prova da vez.
  $("#rolo").style.transform = "translateY(" + (-pos * 300) + "px)";

  const passou = t < R[0] ? -1 : Math.floor(pos + 0.5);
  $("#nq").textContent = (passou < 0 ? 0 : acum(passou, "q")).toLocaleString("pt-BR");
  $("#np").textContent = passou + 1;
  $("#na").textContent = passou < 0 ? 0 : acum(passou, "a");

  cena(t, "#sintese", ${S}, ${F}, FIM);
  cena(t, "#fecho", ${F}, FIM, FIM);
};`;

    // Um estalo por prova que cruza o centro, e o ding no fim da corrida.
    const eio = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
    const inversa = (alvo) => { let lo = 0, hi = 1; for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (eio(m) < alvo) lo = m; else hi = m; } return lo; };
    const ticks = exames.map((e, i) => [
      RODA[0] + (RODA[1] - RODA[0]) * inversa((i - 0.5 < 0 ? 0 : i - 0.5) / (exames.length - 1)),
      e.questoes_anuladas ? 520 : 1100 + ((i * 53) % 500),
    ]);

    return {
      slug: `linha-do-tempo-${ultimo.edicao}`,
      duracao: FIM,
      html: pagina({ corpo, css, js, pill: `${primeiro.ano}–${ultimo.ano}`, duracao: FIM, escuro: true }),
      audio: trilha({ duracao: FIM, acorde: [185, 233.08, 277.18], cortes: [H, S, F], ticks, dings: [RODA[1]] }),
      legenda: [
        `${anos} anos de Exame de Ordem em segundos ⏳`,
        `${exames.length} provas, ${fmt(totalQ)} questões oficiais — todas com gabarito, dá pra resolver uma por uma.`,
        "",
        "oabase.com.br",
      ].join("\n"),
      hashtags: ["#examedeordem", "#estudos"],
      comentario: "Qual foi o Exame que você fez (ou vai fazer)? 👇",
    };
  },
};
