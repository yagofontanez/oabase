// "Qual é o artigo?" — o caput aparece, quatro números, três segundos.
// As alternativas erradas são artigos reais da mesma lei que também caem na
// prova: chute por "esse número parece de Penal" não resolve.

import { pagina, trilha, escapa, relogioHTML } from "../motor.mjs";
import { cortar, daLei, embaralhar, tomLeve } from "../dados.mjs";

export const quiz = {
  id: "quiz",
  nome: "Qual é o artigo?",
  pool: (d) =>
    d.artigos.filter(tomLeve).filter((a) => d.artigos.filter((b) => b.lei.slug === a.lei.slug).length >= 4),

  roteiro(a, { dados, rng }) {
    const outros = dados.artigos.filter((b) => b.lei.slug === a.lei.slug && b.slug !== a.slug);
    const opcoes = [a, ...embaralhar(outros, rng).slice(0, 3)].sort((x, y) => x.ordem - y.ordem);
    const texto = cortar(a.texto, 230);
    const palavras = texto.split(/\s+/).length;

    const WPS = 7;
    const B = 2.0; // fim do gancho
    const L0 = B + 0.5;
    const O = L0 + palavras / WPS + 0.3; // alternativas
    const R = O + 3.6; // resposta
    const FIM = R + 4.2;

    const corpo = `
<section class="cena" id="gancho" style="padding-top:560px">
  <div class="kicker">Quiz · Lei seca</div>
  <h1 style="font-size:150px">Qual é o <em>artigo</em>? 🤔</h1>
  <p class="sub">Só o texto ${escapa(daLei(a.lei))}. Valendo.</p>
</section>
<section class="cena" id="jogo">
  <div class="kicker">${escapa(a.lei.nome)} · art. ?</div>
  <div class="cartao"><p class="lei" id="texto">${escapa(texto)}</p></div>
  <div class="opcoes">${opcoes
    .map((o) => `<div class="op${o === a ? " alvo" : ""}">Art. ${escapa(o.numero)}</div>`)
    .join("")}</div>
  <div class="base">
    ${relogioHTML("rel")}
    <div class="resp" id="resp"><b>Art. ${escapa(a.numero)} ${escapa(daLei(a.lei))}</b><span>citado expressamente em ${a.incidencia} ${a.incidencia === 1 ? "questão" : "questões"} da OAB</span></div>
  </div>
  <div class="chamada" id="chamada"><span class="cta">Acertou? Comenta 👇</span></div>
</section>`;

    const css = `
  .cartao{max-height:640px;overflow:hidden}
  .opcoes{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-top:40px}
  .op{background:#fff;border:3px solid var(--line);border-radius:26px;padding:30px;text-align:center;font-size:50px;font-weight:800;letter-spacing:-1px}
  .op.certa{border-color:var(--brand);background:var(--brand-50);color:var(--brand)}
  .base{position:relative;margin-top:44px;height:170px}
  .resp{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:8px;text-align:center}
  .resp b{font-size:46px;letter-spacing:-1px}
  .resp span{font-size:32px;color:var(--body);font-weight:600}
  .chamada{text-align:center;margin-top:30px}
  .w{transition:none}`;

    const js = `
const FIM = ${FIM};
window.preparar = () => { caber($("#texto"), 560); preparaPalavras($("#texto")); centralizar("#jogo"); };
window.render = (t) => {
  cena(t, "#gancho", 0, ${B}, FIM);
  cena(t, "#jogo", ${B}, FIM, FIM);
  palavras($("#texto"), t, ${L0}, ${WPS});
  $$(".op").forEach((el, i) => {
    aparece(el, t, ${O} + i * 0.08, 0.35, 30);
    const r = t >= ${R};
    el.classList.toggle("certa", r && el.classList.contains("alvo"));
    if (r && !el.classList.contains("alvo")) el.style.opacity = 1 - 0.65 * p(t, ${R}, ${R} + 0.3);
    if (r && el.classList.contains("alvo")) el.style.transform = "scale(" + (1 + Math.sin(p(t, ${R}, ${R} + 0.4) * Math.PI) * 0.08) + ")";
  });
  relogio("rel", t, ${O + 0.6});
  $("#rel").style.opacity = aparece($("#rel"), t, ${O}, 0.3, 0) * (1 - p(t, ${R}, ${R} + 0.2));
  aparece("#resp", t, ${R + 0.2}, 0.4, 30);
  aparece("#chamada", t, ${R + 1.4}, 0.4, 30);
};`;

    const legenda = [
      `Qual é o artigo ${daLei(a.lei)}? 🤔`,
      "Responde nos comentários ANTES de ver a resposta 👀",
      "",
      "Treino de lei seca pra 1ª fase da OAB — oabase.com.br",
    ].join("\n");

    return {
      slug: `quiz-${a.lei.slug}-${a.slug}`,
      duracao: FIM,
      html: pagina({ corpo, css, js, pill: "Quiz", duracao: FIM }),
      audio: trilha({
        duracao: FIM,
        acorde: [220, 277.18, 329.63],
        cortes: [B],
        ticks: [[O + 0.6], [O + 1.6], [O + 2.6, 1760]],
        dings: [R],
      }),
      legenda,
      hashtags: ["#leiseca", "#quiz"],
      comentario: "Acertou de primeira? Diz aí 👇",
    };
  },
};
