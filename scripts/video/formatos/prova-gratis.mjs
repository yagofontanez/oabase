// "A prova da OAB inteira. De graça." — o convite para a amostra gratuita
// (`exames.amostra_gratuita`). As 80 questões aparecem como quadrados que
// se acendem, uma questão é resolvida na tela, e o preço vem por último: R$ 0.
//
// O enunciado da demonstração é desenhado em barras, não em texto: o vídeo
// mostra o fluxo, e questão de verdade só sai do banco para quem está logado.
// Edição, mês e total de questões vêm de `exames`, que é leitura aberta.

import { pagina, trilha, escapa } from "../motor.mjs";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export const provaGratis = {
  id: "prova-gratis",
  nome: "Prova grátis",
  ordemFixa: true,
  pool: (d) => d.exames.filter((e) => e.amostra_gratuita && e.questoes_carregadas > 0),

  roteiro(exame) {
    const n = exame.questoes_carregadas;
    const [ano, mes] = exame.data_prova.split("-").map(Number);
    const quando = `${MESES[mes - 1]} de ${ano}`;

    const H = 2.6; // fim do gancho
    const G = [H, H + 5.6]; // grade das questões
    const D = [G[1], G[1] + 5.6]; // demonstração
    const O = D[1] + 3.6; // fim da oferta
    const FIM = O + 3.6;

    const TOQUE = D[0] + 1.9, CERTA = TOQUE + 0.5, COMENTARIO = CERTA + 0.8, REVISAO = COMENTARIO + 1.1;

    const corpo = `
<section class="cena" id="gancho" style="padding-top:520px">
  <div class="kicker">${exame.edicao}º Exame · ${escapa(quando)}</div>
  <h1 style="font-size:150px">A prova da OAB inteira.<br><em>De graça.</em></h1>
</section>
<section class="cena" id="grade" style="padding-top:250px">
  <div class="kicker">A prova de ${escapa(MESES[mes - 1])}, completa</div>
  <h1 style="font-size:96px"><span id="nq">0</span> questões oficiais</h1>
  <div id="quadros">${Array.from({ length: n }, (_, i) => `<i><span>${i + 1}</span></i>`).join("")}</div>
  <div id="itens">
    <b>✓ Gabarito oficial</b><b>✓ Comentário</b><b>✓ Revisão espaçada</b>
  </div>
</section>
<section class="cena" id="demo" style="padding-top:250px">
  <div class="kicker">Resolve, confere, revisa</div>
  <div class="cartao" id="questao">
    <div class="cab">${exame.edicao}º Exame · questão 17</div>
    <div class="barras"><i style="width:100%"></i><i style="width:94%"></i><i style="width:97%"></i><i style="width:62%"></i></div>
    ${["A", "B", "C", "D"].map((l, i) => `<div class="alt" data-l="${l}"><b>${l}</b><i style="width:${[78, 64, 58, 70][i]}%"></i><span class="ok">✓ Correta</span></div>`).join("")}
  </div>
  <div class="cartao" id="comentario">
    <div class="rot">Comentário</div>
    <div class="barras"><i style="width:100%"></i><i style="width:91%"></i><i style="width:55%"></i></div>
  </div>
  <div id="revisao">↻ Volta amanhã na sua revisão</div>
  <div id="dedo"></div>
</section>
<section class="cena" id="oferta" style="padding-top:470px;text-align:center">
  <div class="kicker">Quanto custa</div>
  <h1 style="font-size:300px;letter-spacing:-10px">R$ <em>0</em></h1>
  <p class="sub">Sem cartão. Sem assinatura.<br><b>Só criar a conta.</b></p>
</section>
<section class="cena" id="fecho" style="padding-top:540px;text-align:center">
  <div class="tile" style="width:190px;height:190px;border-radius:48px;font-size:90px;margin:0 auto 60px">OA</div>
  <h1 style="font-size:130px">Comece pelo<br><em>${exame.edicao}º Exame</em>.</h1>
  <div style="margin-top:56px"><span class="cta">Crie sua conta grátis</span></div>
</section>`;

    const css = `
  #quadros{display:grid;grid-template-columns:repeat(10,80px);gap:12px;margin-top:44px}
  #quadros i{width:80px;height:80px;border-radius:18px;background:#ffffff10;border:2px solid #ffffff22;display:grid;place-items:center;opacity:0;font-style:normal}
  #quadros span{font-size:26px;font-weight:800;color:#cfe3db;font-variant-numeric:tabular-nums}
  #quadros i.feito{background:#0f7a5f;border-color:#62b39c}
  #quadros i.feito span{color:#fff}
  #itens{display:flex;gap:18px;margin-top:40px;flex-wrap:wrap}
  #itens b{font-size:32px;font-weight:800;color:#eef6f2;background:#ffffff12;border:2px solid #62b39c66;padding:14px 22px;border-radius:999px;opacity:0}
  #questao{background:#0b2b26;border-color:#ffffff1f;color:#eef6f2;padding:40px;margin-top:10px}
  #questao .cab{font-size:28px;font-weight:800;color:#e9a23b;margin-bottom:26px}
  .barras{display:flex;flex-direction:column;gap:16px}
  .barras i{display:block;height:22px;border-radius:11px;background:#ffffff26}
  .alt{position:relative;display:flex;align-items:center;gap:22px;margin-top:20px;padding:22px 24px;border-radius:22px;border:2px solid #ffffff1f}
  .alt b{width:52px;height:52px;border-radius:50%;display:grid;place-items:center;background:#ffffff14;font-size:26px;flex-shrink:0}
  .alt i{display:block;height:20px;border-radius:10px;background:#ffffff26}
  .alt .ok{position:absolute;right:24px;font-size:28px;font-weight:800;color:#8ee0c3;opacity:0}
  .alt.certa{background:#0f7a5f55;border-color:#62b39c}
  .alt.certa b{background:#0f7a5f;color:#fff}
  #comentario{background:#fae9cc;border-color:#e9a23b;margin-top:26px;padding:34px 40px;opacity:0}
  #comentario .rot{font-size:26px;font-weight:800;letter-spacing:3px;text-transform:uppercase;color:#8a5a12;margin-bottom:20px}
  #comentario .barras i{background:#16201d26}
  #revisao{margin-top:26px;display:inline-block;font-size:32px;font-weight:800;color:#041f1c;background:#62b39c;padding:16px 28px;border-radius:999px;opacity:0}
  #dedo{position:absolute;width:90px;height:90px;border-radius:50%;background:#ffffff40;border:4px solid #fff;opacity:0;z-index:4}
  #oferta h1 em{color:#e9a23b}`;

    const js = `
const FIM = ${FIM};
const N = ${n};
window.render = (t) => {
  cena(t, "#gancho", 0, ${H}, FIM);

  cena(t, "#grade", ${G[0]}, ${G[1]}, FIM);
  // Um quadro por questão, acelerando; depois a onda de ✓ em diagonal.
  const entra = (i) => ${G[0]} + 0.4 + 2.3 * Math.pow(i / N, 0.75);
  const acende = (i) => ${G[0]} + 3.0 + 1.3 * (((i % 10) + Math.floor(i / 10)) / 17);
  let vistas = 0;
  $$("#quadros i").forEach((q, i) => {
    const x = eo(p(t, entra(i), entra(i) + 0.25));
    if (t >= entra(i)) vistas++;
    q.style.opacity = x;
    q.style.transform = "scale(" + (0.4 + 0.6 * back(p(t, entra(i), entra(i) + 0.3))) + ")";
    q.classList.toggle("feito", t >= acende(i));
    if (t >= acende(i)) q.style.transform = "scale(" + (1 + 0.18 * Math.sin(p(t, acende(i), acende(i) + 0.3) * Math.PI)) + ")";
  });
  $("#nq").textContent = vistas;
  $$("#itens b").forEach((b, i) => aparece(b, t, ${G[0]} + 3.4 + i * 0.45, 0.4, 24));

  cena(t, "#demo", ${D[0]}, ${D[1]}, FIM);
  const alvo = $('.alt[data-l="C"]');
  const dedo = $("#dedo");
  if (t >= ${D[0]} && t < ${D[1]}) {
    const r = alvo.getBoundingClientRect();
    const ida = eio(p(t, ${TOQUE} - 0.9, ${TOQUE}));
    dedo.style.left = mix(900, r.left + 60, ida) + "px";
    dedo.style.top = mix(1500, r.top + r.height / 2 - 45, ida) + "px";
    const aperta = Math.sin(p(t, ${TOQUE}, ${TOQUE} + 0.25) * Math.PI);
    dedo.style.transform = "scale(" + (1 - 0.25 * aperta) + ")";
    dedo.style.opacity = p(t, ${TOQUE} - 0.9, ${TOQUE} - 0.6) * (1 - p(t, ${CERTA} + 0.3, ${CERTA} + 0.6));
  } else dedo.style.opacity = 0;
  alvo.classList.toggle("certa", t >= ${CERTA});
  alvo.querySelector(".ok").style.opacity = eo(p(t, ${CERTA}, ${CERTA} + 0.3));
  alvo.style.transform = "scale(" + (1 + 0.04 * Math.sin(p(t, ${CERTA}, ${CERTA} + 0.35) * Math.PI)) + ")";
  aparece("#comentario", t, ${COMENTARIO}, 0.45, 70);
  aparece("#revisao", t, ${REVISAO}, 0.4, 30);

  cena(t, "#oferta", ${D[1]}, ${O}, FIM);
  cena(t, "#fecho", ${O}, FIM, FIM);
};`;

    // Um estalo por quadro que entra (acelerando), e o ding quando a
    // alternativa certa acende e quando aparece o R$ 0.
    const ticks = Array.from({ length: 30 }, (_, i) => [G[0] + 0.4 + 2.3 * Math.pow(i / 30, 0.75), 900 + ((i * 131) % 800)]);
    return {
      slug: `prova-gratis-${exame.edicao}`,
      duracao: FIM,
      html: pagina({ corpo, css, js, pill: "Grátis", duracao: FIM, escuro: true, marcaApos: H }),
      audio: trilha({ duracao: FIM, acorde: [220, 277.18, 329.63], cortes: [H, G[1], D[1], O], ticks, dings: [CERTA, D[1] + 0.2] }),
      legenda: [
        `A prova da OAB de ${quando} (${exame.edicao}º Exame) inteira, de graça 🎁`,
        `As ${n} questões oficiais, com gabarito, comentário e revisão espaçada. Sem cartão: é só criar a conta.`,
        "",
        "oabase.com.br",
      ].join("\n"),
      hashtags: ["#provaoab", "#estudos"],
      comentario: `Já fez o ${exame.edicao}º? Conta quantas acertou 👇`,
    };
  },
};
