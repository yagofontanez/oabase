// "Verdadeiro ou falso?" — dois artigos de leis diferentes, qual é mais citado
// na prova. A afirmação é montada da contagem e a verdade sai da contagem:
// nenhuma frase aqui é escrita à mão, então nenhuma pode estar errada.

import { pagina, trilha, escapa, relogioHTML } from "../motor.mjs";
import { cortar, daLei, embaralhar, semente, tomLeve } from "../dados.mjs";

export const vf = {
  id: "vf",
  nome: "Verdadeiro ou falso?",
  pool(d) {
    const topo = d.artigos.filter(tomLeve).slice(0, 30);
    const pares = [];
    for (const a of topo)
      for (const b of topo)
        if (a.lei.slug < b.lei.slug && a.incidencia !== b.incidencia) pares.push([a, b]);
    // Metade verdadeira, metade falsa: a ordem dentro do par é sorteada.
    const rng = semente("vf-ordem");
    return pares.map(([a, b]) => (rng() < 0.5 ? [a, b] : [b, a])).map(([a, b]) => ({ a, b, provas: d.exames.length }));
  },

  roteiro({ a, b, provas }) {
    const verdade = a.incidencia > b.incidencia;
    const frase = `O art. ${a.numero} ${daLei(a.lei)} caiu em mais questões da OAB que o art. ${b.numero} ${daLei(b.lei)}.`;
    const palavras = frase.split(/\s+/).length;
    const WPS = 6;
    const L0 = 0.5;
    const O = L0 + palavras / WPS + 0.4;
    const R = O + 3.7;
    const FIM = R + 4.4;
    const max = Math.max(a.incidencia, b.incidencia);
    const barra = (x) => `<div class="cmp"><div class="cmp-t"><b>Art. ${escapa(x.numero)} ${escapa(daLei(x.lei))}</b><span>${x.incidencia}</span></div>
      <p>${escapa(cortar(x.texto, 70))}</p><div class="barra"><i style="width:${(x.incidencia / max) * 100}%"></i></div></div>`;

    const corpo = `
<section class="cena" id="jogo">
  <div class="kicker">Verdadeiro ou falso? 🤔</div>
  <h1 id="frase" style="font-size:92px">${escapa(frase)}</h1>
  <div class="palco">
    <div id="botoes"><div class="bt v">VERDADEIRO</div><div class="bt f">FALSO</div></div>
    <div id="comparacao">${barra(a)}${barra(b)}<p class="fonte">Questões que citam o artigo expressamente, nas ${provas} provas.</p></div>
  </div>
  <div style="margin-top:20px">${relogioHTML("rel")}</div>
  <div class="selo ${verdade ? "sim" : "nao"}" id="selo">${verdade ? "VERDADEIRO ✓" : "FALSO ✗"}</div>
  <div style="text-align:center" id="chamada"><span class="cta">Acertou? 👇</span></div>
</section>`;

    const css = `
  .palco{position:relative;height:430px;margin-top:50px}
  #botoes,#comparacao{position:absolute;inset:0}
  #botoes{display:flex;gap:24px;align-items:center}
  .bt{flex:1;text-align:center;font-size:44px;font-weight:800;letter-spacing:1px;padding:56px 0;border-radius:30px;border:4px solid}
  .bt.v{color:var(--brand);border-color:var(--brand);background:var(--brand-50)}
  .bt.f{color:var(--erro);border-color:var(--erro);background:#fdecef}
  .cmp{background:#fff;border:2px solid var(--line);border-radius:26px;padding:24px 30px;margin-bottom:16px}
  .cmp-t{display:flex;justify-content:space-between;align-items:baseline}
  .cmp-t b{font-size:36px}
  .cmp-t span{font-family:var(--serif);font-weight:600;font-size:60px;line-height:1}
  .cmp p{font-family:var(--serif);font-size:26px;color:var(--body);margin:4px 0 12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .barra{height:14px;border-radius:7px;background:var(--line);overflow:hidden}
  .barra i{display:block;height:100%;background:var(--brand);transform-origin:left}
  #comparacao .fonte{margin-top:6px}
  .selo{position:absolute;left:50%;top:640px;font-size:92px;font-weight:800;letter-spacing:2px;padding:26px 50px;border:10px solid;border-radius:30px;background:#fffe;white-space:nowrap;z-index:4}
  .selo.sim{color:var(--brand)} .selo.nao{color:var(--erro)}
  #chamada{margin-top:10px}`;

    const js = `
const FIM = ${FIM};
window.preparar = () => { caber($("#frase"), 470, 60); preparaPalavras($("#frase")); };
window.render = (t) => {
  cena(t, "#jogo", 0, FIM, FIM);
  palavras($("#frase"), t, ${L0}, ${WPS});
  $("#botoes").style.opacity = eo(p(t, ${O}, ${O + 0.35})) * (1 - p(t, ${R + 1.4}, ${R + 1.7}));
  $$(".bt").forEach((el, i) => (el.style.transform = "scale(" + back(p(t, ${O} + i * 0.1, ${O + 0.45} + i * 0.1)) + ")"));
  relogio("rel", t, ${O + 0.6});
  $("#rel").style.opacity = p(t, ${O}, ${O + 0.3}) * (1 - p(t, ${R}, ${R + 0.2}));
  // o selo bate no meio da tela, depois dá lugar à comparação
  const bate = p(t, ${R}, ${R + 0.25});
  $("#selo").style.opacity = eo(bate) * (1 - p(t, ${R + 1.3}, ${R + 1.6}));
  $("#selo").style.transform = "translateX(-50%) rotate(-7deg) scale(" + mix(2.4, 1, eo(bate)) + ")";
  $("#comparacao").style.opacity = p(t, ${R + 1.5}, ${R + 1.9});
  $$("#comparacao .barra i").forEach((el) => (el.style.transform = "scaleX(" + eo(p(t, ${R + 1.7}, ${R + 2.5})) + ")"));
  aparece("#chamada", t, ${R + 2.4}, 0.4, 30);
};`;

    return {
      slug: `vf-${a.lei.slug}-${a.slug}-x-${b.lei.slug}-${b.slug}`,
      duracao: FIM,
      html: pagina({ corpo, css, js, pill: "V ou F", duracao: FIM }),
      audio: trilha({
        duracao: FIM,
        acorde: [174.61, 220, 261.63],
        ticks: [[O + 0.6], [O + 1.6], [O + 2.6, 1760]],
        dings: [R],
        cortes: [R + 1.5],
      }),
      legenda: [
        "Verdadeiro ou falso? 🤔 Responde antes do selo!",
        `Contagem real das ${provas} provas da OAB — cada questão que cita o artigo.`,
        "",
        "oabase.com.br",
      ].join("\n"),
      hashtags: ["#leiseca", "#verdadeiroufalso"],
      comentario: "V ou F? Comenta antes de ver 👀",
    };
  },
};
