// "Onde a lei define X?" — o verbete do glossário, a pausa, e o artigo que
// define. A definição é o texto do artigo, como em /glossario: nada de
// paráfrase, que é onde erro jurídico entra.

import { pagina, trilha, escapa, relogioHTML } from "../motor.mjs";
import { cortar } from "../dados.mjs";

export const glossario = {
  id: "glossario",
  nome: "Onde a lei define?",
  pool: (d) => d.glossario,

  roteiro(g) {
    const { artigo } = g;
    const texto = cortar(g.texto, 300);
    const palavras = texto.split(/\s+/).length;
    const C = 1.4; // começa a contagem
    const R = C + 3; // revela
    const WPS = 7;
    const L0 = R + 1.1;
    const E = L0 + palavras / WPS;
    const FIM = E + 3.2;

    const corpo = `
<section class="cena" id="pergunta" style="padding-top:420px">
  <div class="kicker">Glossário da lei seca</div>
  <h1 id="h">Onde a lei define <em>“${escapa(g.termo)}”</em>?</h1>
  <p class="sub">Pensa rápido 👇</p>
  <div style="margin-top:70px">${relogioHTML("rel")}</div>
</section>
<section class="cena" id="resposta">
  <div class="kicker">${escapa(g.termo)}</div>
  <div class="onde" id="onde"><b>Art. ${escapa(artigo.numero)}</b><span>${escapa(artigo.lei.nome)}</span></div>
  <div class="cartao" style="margin-top:40px"><p class="lei" id="texto">${escapa(texto)}</p></div>
  <div style="text-align:center;margin-top:40px" id="chamada"><span class="cta">Salva pra revisar 📌</span></div>
</section>`;

    const css = `
  .onde{display:flex;flex-direction:column;gap:6px}
  .onde b{font-family:var(--serif);font-weight:600;font-size:170px;letter-spacing:-6px;line-height:.95;color:var(--brand)}
  .onde span{font-size:40px;font-weight:700;color:var(--body)}`;

    const js = `
const FIM = ${FIM};
window.preparar = () => { caber($("#h"), 520, 70); caber($("#texto"), 620); preparaPalavras($("#texto")); centralizar("#resposta"); };
window.render = (t) => {
  cena(t, "#pergunta", 0, ${R}, FIM);
  cena(t, "#resposta", ${R}, FIM, FIM);
  relogio("rel", t, ${C});
  aparece("#rel", t, ${C - 0.3}, 0.3, 0);
  const o = back(p(t, ${R + 0.2}, ${R + 0.8}));
  $("#onde").style.transform = "scale(" + (0.6 + 0.4 * o) + ")";
  $("#onde").style.transformOrigin = "left center";
  palavras($("#texto"), t, ${L0}, ${WPS});
  aparece("#chamada", t, ${E + 0.4}, 0.4, 30);
};`;

    return {
      slug: `glossario-${g.slug}`,
      duracao: FIM,
      html: pagina({ corpo, css, js, pill: "Glossário", duracao: FIM }),
      audio: trilha({
        duracao: FIM,
        acorde: [207.65, 261.63, 311.13],
        ticks: [[C], [C + 1], [C + 2, 1760]],
        dings: [R + 0.2],
        cortes: [R],
      }),
      legenda: [
        `Onde a lei define "${g.termo}"? 🤔`,
        // a legenda aparece junto com o vídeo: resposta aqui é spoiler
        "Pensa antes da resposta — ela vem com o texto oficial da lei 👀",
        "",
        "Glossário completo, cada termo com o artigo: oabase.com.br/glossario",
      ].join("\n"),
      hashtags: ["#leiseca", "#glossariojuridico"],
      comentario: "Qual termo vocês sempre esquecem onde está? 👇",
    };
  },
};
