// "A conta da prova" — 80 questões em 5 horas, desmontadas: quanto tempo
// sobra por questão, quanto disso vai só para ler o último exame, e quantas
// precisa acertar. Narrado; a tela mostra o relógio e os quadros.
//
// A leitura usa 200 palavras por minuto, ritmo médio de leitura silenciosa —
// e o vídeo diz que é esse o ritmo da conta. As palavras são contadas no
// exame da amostra (`medidasDaProva`), enunciado e alternativas.

import { pagina, trilha } from "../motor.mjs";
import { fmt } from "../dados.mjs";
import { extenso, narrar } from "../voz.mjs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PPM = 200; // palavras por minuto
const QUESTOES = 80, MINUTOS = 300, PARA_PASSAR = 40;
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

export const conta = {
  id: "conta",
  nome: "A conta da prova",
  ordemFixa: true,
  pool: (d) => (d.medidas?.amostra ? [d.medidas.amostra] : []),

  async roteiro(amostra, { dia }) {
    const porQuestao = (MINUTOS * 60) / QUESTOES; // 225 s
    const leitura = (amostra.palavras / amostra.questoes / PPM) * 60;
    const sobra = porQuestao - leitura;
    const leituraTotalMin = Math.round(amostra.palavras / PPM);
    const h = Math.floor(leituraTotalMin / 60), mi = leituraTotalMin % 60;
    const leituraTotalFala = h ? `${h === 1 ? "uma hora" : `${extenso(h, true)} horas`} e ${extenso(mi)} minutos` : `${extenso(mi)} minutos`;

    const narracao = await narrar(
      [
        { id: "abre", fala: "Oitenta questões. Cinco horas. Parece muito tempo, né?", min: 3 },
        { id: "relogio", fala: "Dividindo, dá três minutos e quarenta e cinco segundos por questão.", min: 3.4 },
        { id: "leitura", fala: `Só pra ler uma questão do último exame, enunciado e alternativas, vão uns ${extenso(Math.round(leitura))} segundos. Sobram menos de três minutos pra pensar.`, min: 5 },
        { id: "total", fala: `Na prova inteira, são ${leituraTotalFala} só de leitura.`, min: 3.4 },
        { id: "meta", fala: "E pra passar, você precisa de quarenta acertos. Metade.", min: 3.8 },
        { id: "fecho", fala: "Treina no tempo de verdade: o quadragésimo sexto exame tá de graça, link no perfil.", min: 3.4 },
      ],
      join(tmpdir(), `oabase-conta-${dia.getTime()}`),
    );
    const C = narracao.cenas, FIM = narracao.duracao;

    const corpo = `
<section class="cena" id="abre" style="padding-top:470px;text-align:center">
  <div class="kicker">A conta da 1ª fase</div>
  <h1 style="font-size:190px;letter-spacing:-7px">80 questões.<br><em>5 horas.</em></h1>
</section>
<section class="cena" id="relogio" style="padding-top:330px;text-align:center">
  <div class="kicker">Por questão</div>
  <div id="dial"><svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="88" class="trilho"/><circle cx="100" cy="100" r="88" class="arco" id="arco"/></svg><span id="mm">0:00</span></div>
  <p class="sub" style="margin-top:40px">5 horas ÷ 80 questões</p>
</section>
<section class="cena" id="leitura" style="padding-top:330px">
  <div class="kicker">Os ${mmss(porQuestao)} de uma questão do ${amostra.edicao}º Exame</div>
  <div id="fita"><i id="ler"></i><i id="pensar"></i></div>
  <div id="legenda-fita">
    <div><b class="ler">${mmss(leitura)}</b><span>só lendo<br>(${fmt(Math.round(amostra.palavras / amostra.questoes))} palavras)</span></div>
    <div><b class="pensar">${mmss(sobra)}</b><span>pra pensar<br>e marcar</span></div>
  </div>
  <p class="fonte" style="margin-top:46px">Leitura a ${PPM} palavras por minuto, ritmo médio de leitura silenciosa.</p>
</section>
<section class="cena" id="total" style="padding-top:470px;text-align:center">
  <div class="kicker">A prova inteira, só lendo</div>
  <h1 style="font-size:230px;letter-spacing:-8px"><span id="hm">0h00</span></h1>
  <p class="sub">${fmt(amostra.palavras)} palavras no ${amostra.edicao}º Exame</p>
</section>
<section class="cena" id="meta" style="padding-top:300px">
  <div class="kicker">Pra passar na 1ª fase</div>
  <h1 style="font-size:104px"><span id="acertos">0</span> acertos. <em>Metade.</em></h1>
  <div id="quadros">${Array.from({ length: QUESTOES }, () => "<i></i>").join("")}</div>
</section>
<section class="cena" id="fecho" style="padding-top:540px;text-align:center">
  <div class="tile" style="width:190px;height:190px;border-radius:48px;font-size:90px;margin:0 auto 60px">OA</div>
  <h1 style="font-size:116px">Treine no<br><em>tempo de verdade</em>.</h1>
  <div style="margin-top:56px"><span class="cta">${amostra.edicao}º Exame grátis · link no perfil</span></div>
</section>`;

    const css = `
  #dial{position:relative;width:640px;height:640px;margin:40px auto 0}
  #dial svg{position:absolute;inset:0;transform:rotate(-90deg)}
  #dial circle{fill:none;stroke-width:16}
  #dial .trilho{stroke:#ffffff1f}
  #dial .arco{stroke:#e9a23b;stroke-linecap:round}
  #dial span{position:absolute;inset:0;display:grid;place-items:center;font-family:var(--serif);font-weight:600;font-size:200px;letter-spacing:-6px;color:#eef6f2;font-variant-numeric:tabular-nums}
  #fita{display:flex;height:150px;margin-top:70px;border-radius:30px;overflow:hidden;background:#ffffff14}
  #fita i{display:block;height:100%;width:0}
  #ler{background:linear-gradient(90deg,#c2415b,#dc6b8f)}
  #pensar{background:linear-gradient(90deg,#0f7a5f,#62b39c)}
  #legenda-fita{display:flex;justify-content:space-between;margin-top:40px}
  #legenda-fita div{display:flex;flex-direction:column;gap:10px}
  #legenda-fita div:last-child{text-align:right}
  #legenda-fita b{font-family:var(--serif);font-weight:600;font-size:110px;line-height:1;letter-spacing:-4px;opacity:0}
  #legenda-fita b.ler{color:#ff9db4}
  #legenda-fita b.pensar{color:#8ee0c3}
  #legenda-fita span{font-size:32px;font-weight:700;color:#cfe3db;line-height:1.3}
  #quadros{display:grid;grid-template-columns:repeat(10,80px);gap:12px;margin-top:56px}
  #quadros i{width:80px;height:80px;border-radius:18px;background:#ffffff12;border:2px solid #ffffff22}
  #quadros i.ok{background:#e9a23b;border-color:#f2c06c}`;

    const js = `
const FIM = ${FIM};
const C = ${JSON.stringify(Object.fromEntries(Object.entries(C).map(([k, v]) => [k, [v.inicio, v.fim]])))};
const POR = ${porQuestao}, LER = ${leitura}, TOTAL = ${leituraTotalMin};
const mmss = (s) => Math.floor(s / 60) + ":" + String(Math.round(s % 60)).padStart(2, "0");
window.render = (t) => {
  cena(t, "#abre", C.abre[0], C.abre[1], FIM);

  cena(t, "#relogio", C.relogio[0], C.relogio[1], FIM);
  const k = eo(p(t, C.relogio[0] + 0.3, C.relogio[0] + 2.0));
  $("#mm").textContent = mmss(POR * k);
  const L = 2 * Math.PI * 88;
  $("#arco").style.strokeDasharray = L;
  $("#arco").style.strokeDashoffset = L * (1 - k);

  cena(t, "#leitura", C.leitura[0], C.leitura[1], FIM);
  const a = eo(p(t, C.leitura[0] + 0.5, C.leitura[0] + 1.6)), b = eo(p(t, C.leitura[0] + 2.4, C.leitura[0] + 3.4));
  $("#ler").style.width = (100 * LER / POR) * a + "%";
  $("#pensar").style.width = (100 * (POR - LER) / POR) * b + "%";
  $("#legenda-fita .ler").style.opacity = p(t, C.leitura[0] + 1.2, C.leitura[0] + 1.6);
  $("#legenda-fita .pensar").style.opacity = p(t, C.leitura[0] + 3.0, C.leitura[0] + 3.4);

  cena(t, "#total", C.total[0], C.total[1], FIM);
  const m = Math.round(TOTAL * eo(p(t, C.total[0] + 0.3, C.total[0] + 1.8)));
  $("#hm").textContent = Math.floor(m / 60) + "h" + String(m % 60).padStart(2, "0");

  cena(t, "#meta", C.meta[0], C.meta[1], FIM);
  const acesas = Math.round(${PARA_PASSAR} * eo(p(t, C.meta[0] + 0.5, C.meta[0] + 2.4)));
  $("#acertos").textContent = acesas;
  $$("#quadros i").forEach((q, i) => q.classList.toggle("ok", i < acesas));

  cena(t, "#fecho", C.fecho[0], FIM, FIM);
};`;

    return {
      slug: `conta-${amostra.edicao}`,
      duracao: FIM,
      html: pagina({ corpo, css, js, pill: "A conta da prova", duracao: FIM, escuro: true, marcaApos: C.abre.fim }),
      audio: {
        ...trilha({ duracao: FIM, acorde: [185, 233.08, 277.18], cortes: [C.relogio.inicio, C.leitura.inicio, C.meta.inicio, C.fecho.inicio], dings: [C.meta.inicio + 2.4] }),
        voz: narracao.arquivo,
      },
      legenda: [
        "80 questões em 5 horas parece muito tempo… até você fazer a conta ⏱️",
        `Só de leitura, o ${amostra.edicao}º Exame inteiro leva ${Math.floor(leituraTotalMin / 60)}h${String(leituraTotalMin % 60).padStart(2, "0")}. E pra passar, 40 acertos.`,
        "",
        `O ${amostra.edicao}º Exame inteiro está de graça no link do perfil — treina no tempo real.`,
      ].join("\n"),
      hashtags: ["#dicasoab", "#estudos"],
      comentario: "Quanto tempo vocês levam por questão? 👇",
    };
  },
};
