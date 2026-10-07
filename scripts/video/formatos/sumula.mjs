// "Súmula Vinculante N em X segundos" — o enunciado oficial, palavra a palavra.
// O texto nunca é cortado: súmula pela metade muda de sentido. As longas
// demais para a tela saem da lista em vez de sair truncadas.

import { pagina, trilha, escapa } from "../motor.mjs";

export const sumula = {
  id: "sumula",
  nome: "Súmula do dia",
  pool: (d) => d.sumulas.filter((s) => s.texto.length <= 420),

  roteiro(s) {
    const palavras = s.texto.split(/\s+/).length;
    const WPS = 5.5;
    const B = 2.3;
    const L0 = B + 0.5;
    const E = L0 + palavras / WPS;
    const FIM = E + 3.8;
    const segundos = Math.ceil(FIM);

    const corpo = `
<section class="cena" id="gancho" style="padding-top:520px">
  <div class="kicker">Súmula do dia · STF</div>
  <h1 style="font-size:140px">Súmula<br><em>Vinculante ${s.numero}</em></h1>
  <p class="sub">em ${segundos} segundos ⏱️</p>
</section>
<section class="cena" id="leitura">
  <div class="kicker">Súmula Vinculante ${s.numero} · STF</div>
  <div class="cartao"><p class="lei" id="texto">${escapa(s.texto)}</p></div>
  <div class="efeito" id="efeito"><b>Vinculante</b> = obriga todo o Judiciário e a administração pública (CF, art. 103-A).</div>
  <div style="text-align:center;margin-top:40px" id="chamada"><span class="cta">Salva pra revisar 📌</span></div>
</section>`;

    const css = `
  .cartao{border-left:12px solid var(--brand)}
  .lei{font-size:54px}
  .efeito{margin-top:36px;font-size:32px;line-height:1.4;color:var(--body);background:var(--ouro-100);border-radius:22px;padding:26px 32px}
  .efeito b{color:var(--ink)}`;

    const js = `
const FIM = ${FIM};
window.preparar = () => { caber($("#texto"), 800); preparaPalavras($("#texto")); centralizar("#leitura"); };
window.render = (t) => {
  cena(t, "#gancho", 0, ${B}, FIM);
  cena(t, "#leitura", ${B}, FIM, FIM);
  palavras($("#texto"), t, ${L0}, ${WPS});
  aparece("#efeito", t, ${E + 0.2}, 0.45, 30);
  aparece("#chamada", t, ${E + 1.0}, 0.45, 30);
};`;

    return {
      slug: `sumula-vinculante-${s.numero}`,
      duracao: FIM,
      html: pagina({ corpo, css, js, pill: "Súmula do dia", duracao: FIM }),
      audio: trilha({ duracao: FIM, acorde: [196, 246.94, 293.66], cortes: [B], dings: [E + 0.2] }),
      legenda: [
        `Súmula Vinculante ${s.numero} do STF em ${segundos} segundos ⚖️`,
        "Texto oficial, sem resumo de cursinho. Salva pra revisar antes da prova 📌",
        "",
        "Todas as vinculantes em oabase.com.br/sumulas",
      ].join("\n"),
      hashtags: ["#stf", "#sumulavinculante"],
      comentario: "Qual súmula vocês querem no próximo? 👇",
    };
  },
};
