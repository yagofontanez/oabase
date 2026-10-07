// "Os 5 artigos do X que mais caem na OAB" — contagem de `artigos.incidencia`,
// que é citação expressa, o mesmo número da página aberta de legislação.
// O vídeo diz isso na tela: "cai" aqui é "é citado", e o instituto cai também
// sem que a prova o nomeie.

import { pagina, trilha, escapa } from "../motor.mjs";
import { cortar, daLei } from "../dados.mjs";

export const ranking = {
  id: "ranking",
  nome: "Top 5",
  pool(d) {
    const porLei = new Map();
    for (const a of d.artigos) porLei.set(a.lei.slug, [...(porLei.get(a.lei.slug) ?? []), a]);
    return [...porLei.values()]
      // cinco empatados em 1 não é ranking, é lista: exige distância do 1º ao 5º
      .filter((l) => l.length >= 5 && l[0].incidencia > l[4].incidencia)
      .sort((x, y) => y.length - x.length)
      .map((l) => ({ lei: l[0].lei, top: l.slice(0, 5), provas: d.exames.length }));
  },

  roteiro({ lei, top, provas }) {
    const B = 2.6;
    const PASSO = 1.5;
    const entra = (i) => B + 0.6 + (4 - i) * PASSO; // do 5º para o 1º
    const E = entra(0) + 0.8;
    const FIM = E + 3.6;
    const max = top[0].incidencia;

    const corpo = `
<section class="cena" id="gancho" style="padding-top:470px">
  <div class="kicker">Ranking · 1ª fase</div>
  <h1 style="font-size:118px">Os 5 artigos ${escapa(daLei(lei))} que mais caem na <em>OAB</em></h1>
</section>
<section class="cena" id="lista">
  <div class="kicker">Top 5 · ${escapa(lei.nome)}</div>
  ${top
    .map(
      (a, i) => `<div class="linha-r${i === 0 ? " primeiro" : ""}" id="l${i}">
    <div class="pos">${i + 1}º</div>
    <div class="info"><b>Art. ${escapa(a.numero)}</b><p>${escapa(cortar(a.texto, 64))}</p>
      <div class="barra"><i style="width:${(a.incidencia / max) * 100}%"></i></div></div>
    <div class="qtd">${a.incidencia}<small>${a.incidencia === 1 ? "questão" : "questões"}</small></div>
  </div>`,
    )
    .join("")}
  <p class="fonte" id="nota">Citação expressa do artigo nas ${provas} provas do acervo.</p>
  <div style="text-align:center;margin-top:24px" id="chamada"><span class="cta">Qual desses te pegou? 👇</span></div>
</section>`;

    const css = `
  .linha-r{display:flex;align-items:center;gap:28px;background:#fff;border:2px solid var(--line);border-radius:28px;padding:24px 30px;margin-top:18px}
  .linha-r.primeiro{border:3px solid var(--ouro);background:#fffaf1}
  .pos{font-family:var(--serif);font-weight:600;font-size:76px;width:110px;letter-spacing:-3px}
  .primeiro .pos{color:var(--ouro)}
  .info{flex:1;min-width:0}
  .info b{font-size:40px;letter-spacing:-1px}
  .info p{font-family:var(--serif);font-size:27px;color:var(--body);margin:4px 0 12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .barra{height:12px;border-radius:6px;background:var(--line);overflow:hidden}
  .barra i{display:block;height:100%;background:var(--brand);border-radius:6px}
  .primeiro .barra i{background:var(--ouro)}
  .qtd{text-align:center;font-family:var(--serif);font-weight:600;font-size:64px;line-height:1;width:130px}
  .qtd small{display:block;font-family:var(--sans);font-size:22px;font-weight:700;color:var(--muted);margin-top:6px}`;

    const js = `
const FIM = ${FIM};
window.preparar = () => centralizar("#lista");
window.render = (t) => {
  cena(t, "#gancho", 0, ${B}, FIM);
  cena(t, "#lista", ${B}, FIM, FIM);
  [${top.map((_, i) => entra(i)).join(",")}].forEach((a, i) => {
    const el = $("#l" + i);
    const x = back(p(t, a, a + 0.5));
    el.style.opacity = p(t, a, a + 0.2);
    el.style.transform = "translateX(" + (1 - x) * 120 + "px)";
    el.querySelector(".barra i").style.transform = "scaleX(" + eo(p(t, a + 0.2, a + 0.9)) + ")";
    el.querySelector(".barra i").style.transformOrigin = "left";
  });
  aparece("#nota", t, ${E - 0.2}, 0.4, 20);
  aparece("#chamada", t, ${E + 0.4}, 0.4, 30);
};`;

    return {
      slug: `ranking-${lei.slug}`,
      duracao: FIM,
      html: pagina({ corpo, css, js, pill: "Top 5", duracao: FIM }),
      audio: trilha({
        duracao: FIM,
        acorde: [246.94, 311.13, 369.99],
        cortes: [B],
        ticks: top.slice(1).map((_, k) => [entra(4 - k), 990 + k * 110]),
        dings: [entra(0)],
      }),
      legenda: [
        `Os 5 artigos ${daLei(lei)} mais citados na prova da OAB 📊`,
        `Contamos nas ${provas} provas oficiais — nada de "achismo" de cursinho.`,
        "",
        "Salva e começa a revisão por eles 📌 oabase.com.br",
      ].join("\n"),
      hashtags: ["#leiseca", "#dicasoab"],
      comentario: `Qual artigo ${daLei(lei)} vocês acham que faltou? 👇`,
    };
  },
};
