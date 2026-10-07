// "Faltam N dias" + um fato do acervo. A data vem de `aplicacoes` em
// src/lib/content/data.ts — a mesma lista da /proximo-exame. Copiar a data
// para cá criaria duas verdades que saem de sincronia no primeiro edital novo.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pagina, trilha, escapa } from "../motor.mjs";
import { daLei, fmt } from "../dados.mjs";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function aplicacoes() {
  const fonte = readFileSync(join(process.cwd(), "src/lib/content/data.ts"), "utf8");
  const bloco = fonte.match(/export const aplicacoes = \[([\s\S]*?)\]/)?.[1] ?? "";
  // new Date("YYYY-MM-DD") é UTC e volta um dia no Brasil — ver AGENTS.md, Datas.
  return [...bloco.matchAll(/edicao:\s*(\d+),\s*data:\s*"(\d{4})-(\d{2})-(\d{2})"/g)].map((m) => ({
    edicao: +m[1],
    data: new Date(+m[2], +m[3] - 1, +m[4]),
  }));
}

function fatos(d) {
  const ex = d.exames;
  const questoes = ex.reduce((s, e) => s + e.questoes_carregadas, 0);
  const anuladas = ex.reduce((s, e) => s + e.questoes_anuladas, 0);
  const recorde = Math.max(...ex.map((e) => e.questoes_anuladas));
  const campeas = ex.filter((e) => e.questoes_anuladas === recorde).map((e) => `${e.edicao}º`);
  const [topo] = d.artigos;
  return [
    `São ${fmt(questoes)} questões oficiais no acervo, do ${ex[0].edicao}º ao ${ex.at(-1).edicao}º Exame.`,
    `A FGV já anulou ${anuladas} questões nessas ${ex.length} provas. O recorde é ${recorde} numa prova só: ${campeas.join(" e ")} Exame.`,
    `O artigo mais citado nas provas é o art. ${topo.numero} ${daLei(topo.lei)}, em ${topo.incidencia} questões.`,
    `O acervo começa no ${ex[0].edicao}º Exame, aplicado em ${ex[0].ano}. São ${ex.length} provas contadas uma a uma.`,
    `Estão no acervo as ${d.sumulas.length} súmulas vinculantes do STF, com o texto oficial.`,
  ];
}

export const contagem = {
  id: "contagem",
  nome: "Contagem regressiva",
  // Um item por semana; o fato gira, a data é sempre a do dia.
  pool: (d) => fatos(d).map((fato) => ({ fato })),
  disponivel: (dia) => aplicacoes().some((a) => a.data >= dia),

  roteiro({ fato }, { dia }) {
    const prox = aplicacoes().find((a) => a.data >= dia);
    const dias = Math.round((prox.data - dia) / 864e5);
    const dataTxt = `${prox.data.getDate()} de ${MESES[prox.data.getMonth()]} de ${prox.data.getFullYear()}`;
    const palavras = fato.split(/\s+/).length;
    const F = 3.4;
    const WPS = 5.5;
    const E = F + 0.6 + palavras / WPS;
    const FIM = E + 3.2;

    const corpo = `
<section class="cena" id="c">
  <div class="kicker">Contagem regressiva</div>
  <div class="grande" id="n">${dias}</div>
  <p class="dias">${dias === 1 ? "dia" : "dias"} para o <b>${prox.edicao}º Exame de Ordem</b></p>
  <p class="data">1ª fase · ${escapa(dataTxt)}</p>
  <div class="fato" id="fato"><small>Fato do acervo</small><p id="fato-t">${escapa(fato)}</p></div>
  <div style="text-align:center;margin-top:44px" id="chamada"><span class="cta">Bora estudar hoje? 💪</span></div>
</section>`;

    const css = `
  .grande{font-family:var(--serif);font-weight:600;font-size:400px;line-height:.9;letter-spacing:-18px;margin-left:-14px;font-variant-numeric:tabular-nums}
  .dias{font-size:50px;font-weight:600;margin-top:10px}
  .dias b{color:var(--ouro)}
  .data{font-size:34px;color:#cfe3db;margin-top:14px;font-weight:600}
  .fato{margin-top:70px;border:2px solid #ffffff26;background:#ffffff10;border-radius:30px;padding:40px 44px}
  .fato small{display:block;font-size:26px;font-weight:800;letter-spacing:3px;text-transform:uppercase;color:var(--brand-300);margin-bottom:14px}
  .fato p{font-family:var(--serif);font-size:48px;line-height:1.35}`;

    const js = `
const FIM = ${FIM};
window.preparar = () => { preparaPalavras($("#fato-t")); centralizar("#c"); };
window.render = (t) => {
  cena(t, "#c", 0, FIM, FIM);
  // a contagem desce até o número de hoje e trava
  $("#n").textContent = Math.round(${dias + 60} - 60 * eo(p(t, 0.3, 1.9)));
  $("#n").style.transform = "scale(" + (1 + Math.sin(p(t, 1.9, 2.3) * Math.PI) * 0.06) + ")";
  aparece(".dias", t, 1.9, 0.4, 20);
  aparece(".data", t, 2.2, 0.4, 20);
  aparece("#fato", t, ${F}, 0.45, 40);
  palavras($("#fato-t"), t, ${F + 0.6}, ${WPS});
  aparece("#chamada", t, ${E + 0.3}, 0.4, 30);
};`;

    return {
      slug: `contagem-${dias}-dias`,
      duracao: FIM,
      html: pagina({ corpo, css, js, pill: `${prox.edicao}º Exame`, duracao: FIM, escuro: true }),
      audio: trilha({ duracao: FIM, acorde: [185, 220, 277.18], dings: [1.9], cortes: [F] }),
      legenda: [
        `Faltam ${dias} dias pro ${prox.edicao}º Exame de Ordem ⏳`,
        `1ª fase em ${dataTxt}. Quantas questões você resolveu essa semana?`,
        "",
        "oabase.com.br",
      ].join("\n"),
      hashtags: [`#oab${prox.edicao}`, "#contagemregressiva"],
      comentario: "Quem aí vai fazer essa? Marca o parceiro de estudo 👇",
    };
  },
};
