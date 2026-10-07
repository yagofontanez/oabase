// Vídeos de produto: o site de verdade, gravado num celular pelo Playwright,
// montado dentro de um celular desenhado, com toque, legenda e narração.
//
//   node --env-file=.env.local scripts/video/produto.mjs --roteiro errou [--data 2026-10-05]   (senha da demo: DEMO_SENHA)
//   node --env-file=.env.local scripts/video/produto.mjs --roteiro busca
//   node --env-file=.env.local scripts/video/produto.mjs --roteiro pc-questao
//
// Os roteiros `pc-*` gravam no desktop (1280×800) e montam a tela dentro de um
// notebook desenhado. Tela de computador inteira em 9:16 é ilegível, então a
// câmera mostra o notebook inteiro só para situar e depois aproxima do ponto
// da ação — cada trecho diz o zoom (`z0`/`z1`) e o foco (`f0`/`f1`).
//
// Os mitos trazem alcance; estes mostram que existe um sistema por trás.
// Cada roteiro só mostra o que uma conta **sem plano** consegue fazer — vídeo
// que exibe recurso pago para quem vai chegar de graça é promessa quebrada.
//
// Roteiro = o que gravar (`capturar`) e o que mostrar (`cenas`). A abertura
// segue a regra dos mitos: a pergunta inteira no quadro zero, sem marca.

import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { pagina, renderizar, trilha, escapa } from "./motor.mjs";
import { narrar } from "./voz.mjs";

const { values: args } = parseArgs({
  options: {
    roteiro: { type: "string" },
    email: { type: "string", default: "dev.yagofontanez+demo@gmail.com" },
    "senha-arquivo": { type: "string" },
    site: { type: "string", default: "https://oabase.com.br" },
    data: { type: "string" },
  },
});
const SITE = args.site;
// O roteiro é escolhido antes de tudo: é ele que diz se a gravação é no
// celular ou no computador.
let VW = 390, VH = 700;

// ---------------------------------------------------------------------------
// Gravação
// ---------------------------------------------------------------------------

async function abrirNavegador(desktop) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext(
    desktop
      ? { viewport: { width: VW, height: VH }, deviceScaleFactor: 2, locale: "pt-BR" }
      : { viewport: { width: VW, height: VH }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: "pt-BR" },
  );
  return { browser, page: await ctx.newPage() };
}

/** Página inteira em JPEG + a posição (px CSS da página) de cada alvo. */
async function tela(page, pasta, nome, alvos = {}, { inteira = true } = {}) {
  await page.waitForTimeout(900);
  // O painel (/app) rola dentro de um contêiner de altura fixa: solta, para a
  // captura de página inteira ter o tamanho real (ver tutorial.mjs). Telas
  // que não rolam (o quadro) ficam como estão: soltar a altura desmonta o
  // React Flow.
  if (inteira) await page.evaluate(() => {
    for (const el of document.querySelectorAll("body *")) {
      const cs = getComputedStyle(el);
      if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1) {
        for (let n = el; n && n !== document.body; n = n.parentElement) {
          n.style.overflow = "visible"; n.style.height = "auto"; n.style.maxHeight = "none";
        }
      }
    }
    document.documentElement.style.overflow = document.body.style.overflow = "visible";
    document.documentElement.style.height = document.body.style.height = "auto";
  });
  const arquivo = join(pasta, `${nome}.jpg`);
  await page.screenshot({ path: arquivo, fullPage: inteira, type: "jpeg", quality: 88 });
  const rolagem = await page.evaluate(() => window.scrollY);
  const caixas = {};
  for (const [k, loc] of Object.entries(alvos)) {
    const c = await loc.boundingBox().catch(() => null);
    if (c) caixas[k] = { x: c.x + c.width / 2, y: c.y + rolagem + c.height / 2, topo: c.y + rolagem, h: c.height };
    else console.warn(`  ! alvo "${k}" não encontrado em ${nome}`);
  }
  const altura = await page.evaluate(() => document.documentElement.scrollHeight);
  console.log(`  tela ${nome} (${altura}px)`, Object.keys(caixas).join(", "));
  return { img: `data:image/jpeg;base64,${readFileSync(arquivo).toString("base64")}`, altura, caixas };
}

async function entrar(page, proximo) {
  const senha = args["senha-arquivo"] ? readFileSync(args["senha-arquivo"], "utf8").trim() : process.env.DEMO_SENHA;
  if (!senha) throw new Error("Este roteiro precisa da conta demo: DEMO_SENHA no .env.local ou --senha-arquivo");
  await page.goto(`${SITE}/entrar?proximo=${encodeURIComponent(proximo)}`, { waitUntil: "networkidle" });
  await page.fill("input[type=email]", args.email);
  await page.fill("input[type=password]", senha);
  await page.click("button[type=submit]");
  await page.waitForURL((u) => u.pathname === proximo.split("?")[0], { timeout: 30000 });
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => window.scrollTo(0, 0));
}

// Rolagem que deixa um ponto da página a uma altura confortável da tela.
const mira = (t, alvo, fracao = 0.42) => {
  const c = t.caixas[alvo];
  return c ? Math.max(0, Math.min(t.altura - VH, c.y - VH * fracao)) : 0;
};
// Desktop: o ponto (px CSS da página) para onde a câmera aproxima.
const foco = (t, alvo, dx = 0, dy = 0) => {
  const c = t.caixas[alvo];
  return c ? { x: c.x + dx, y: c.y + dy } : { x: VW / 2, y: VH / 2 };
};
const centro = (y) => ({ x: VW / 2, y: y + VH / 2 });
// Centro da coluna de conteúdo do painel (/app), à direita do trilho de 268px.
// Com zoom até ~1,45 a coluna inteira cabe no quadro; acima disso a câmera
// corta o começo das linhas, e texto cortado lê como erro.
const COLUNA = (268 + 1280) / 2;
const naColuna = (t, alvo, dy = 0) => ({ x: COLUNA, y: (t.caixas[alvo]?.y ?? VH / 2) + dy });
const topoDe = (t, alvo, folga = 24) => (t.caixas[alvo] ? Math.max(0, Math.min(t.altura - VH, t.caixas[alvo].topo - folga)) : 0);

// ---------------------------------------------------------------------------
// Roteiros
// ---------------------------------------------------------------------------

const ROTEIROS = {
  // Errar é onde o sistema trabalha: gabarito, comentário, caderno de erros e
  // a revisão de amanhã. A conta demo responde de verdade — limpe depois com
  // o script de limpeza da conta demo.
  errou: {
    slug: "produto-errou",
    gancho: "Errou uma questão da OAB? Olha o que acontece.",
    abre: "Errou uma questão da OAB? Olha o que acontece com ela aqui.",
    errada: "A",
    async capturar(page, pasta) {
      await entrar(page, "/app/questoes");
      const alt = (l) => page.locator("main button").filter({ hasText: new RegExp(`^\\s*${l}\\s*[^a-zà-ú\\s]`) }).first();
      const responder = page.getByRole("button", { name: "Responder" });
      const fila = await tela(page, pasta, "fila", { questao: page.getByText(/Exame · questão/).first(), errada: alt(this.errada), responder });
      await alt(this.errada).click();
      const marcada = await tela(page, pasta, "marcada", { errada: alt(this.errada), responder });
      await responder.click();
      await page.waitForResponse((r) => r.url().includes("/api/responder"), { timeout: 30000 }).catch(() => {});
      const respondida = await tela(page, pasta, "respondida", { errada: alt(this.errada), comentario: page.getByText(/coment/i).last() });
      await page.goto(`${SITE}/app/questoes?modo=erros`, { waitUntil: "networkidle" });
      await page.evaluate(() => window.scrollTo(0, 0));
      const erros = await tela(page, pasta, "erros", { abas: page.getByRole("link", { name: /Caderno de erros/ }).first(), questao: page.getByText(/Exame · questão/).first() });
      return { fila, marcada, respondida, erros };
    },
    cenas: (T) => [
      { id: "erra", passo: "1", titulo: "Você erra", fala: "Marquei a A. Errei.", min: 4,
        trechos: [{ tela: "fila", de: 0, ate: 0.45, y0: topoDe(T.fila, "questao"), y1: mira(T.fila, "errada") },
                  { tela: "marcada", de: 0.45, ate: 1, y0: mira(T.marcada, "errada"), y1: mira(T.marcada, "responder", 0.6) }],
        toques: [{ em: 0.4, tela: "fila", alvo: "errada", trecho: 0 }, { em: 0.85, tela: "marcada", alvo: "responder", trecho: 1 }] },
      { id: "porque", passo: "2", titulo: "A certa e o porquê", fala: "Na hora, aparece a certa e o comentário explicando por quê.", min: 4.4,
        trechos: [{ tela: "respondida", de: 0, ate: 1, y0: mira(T.respondida, "errada"), y1: mira(T.respondida, "comentario", 0.3) }] },
      { id: "caderno", passo: "3", titulo: "Vai pro caderno de erros", fala: "E ela entra sozinha no seu caderno de erros.", min: 3.6,
        trechos: [{ tela: "erros", de: 0, ate: 1, y0: mira(T.erros, "abas", 0.3), y1: topoDe(T.erros, "questao") }] },
      { id: "volta", passo: "4", titulo: "E volta amanhã", fala: "E volta amanhã na revisão. Até você acertar.", min: 3.2,
        trechos: [{ tela: "erros", de: 0, ate: 1, y0: topoDe(T.erros, "questao"), y1: topoDe(T.erros, "questao") }] },
    ],
    fecho: { titulo: "46º Exame<br><em>de graça.</em>", fala: "O quadragésimo sexto exame tá de graça. Link no perfil." },
    legenda: "Errou uma questão da OAB? Olha o que acontece com ela 👇\nGabarito, comentário, caderno de erros e revisão no dia certo — tudo sozinho.\n\nO 46º Exame inteiro está de graça no link do perfil 🔗",
    comentario: "Qual matéria vocês mais erram? 👇",
  },

  // Busca por assunto, sem login: quem estuda sabe "furto", não sabe "155".
  busca: {
    slug: "produto-busca",
    gancho: "Esqueceu o número do artigo?",
    abre: "Esqueceu o número do artigo? Relaxa.",
    async capturar(page, pasta) {
      await page.goto(`${SITE}/busca`, { waitUntil: "networkidle" });
      const campo = page.locator('input[name="q"]').first();
      await campo.fill("furto");
      const digitada = await tela(page, pasta, "digitada", { campo });
      await campo.press("Enter");
      await page.waitForURL((u) => u.searchParams.get("q") === "furto", { timeout: 30000 });
      await page.waitForLoadState("networkidle");
      await page.evaluate(() => window.scrollTo(0, 0));
      const link = page.locator('a[href="/legislacao/codigo-penal/artigo-155"]').first();
      const resultados = await tela(page, pasta, "resultados", { campo: page.locator('input[name="q"]').first(), art: link });
      await link.click();
      await page.waitForURL((u) => u.pathname.endsWith("/artigo-155"), { timeout: 30000 });
      await page.waitForLoadState("networkidle");
      await page.evaluate(() => window.scrollTo(0, 0));
      const artigo = await tela(page, pasta, "artigo", { titulo: page.locator("h1").first(), caiu: page.getByText("Onde já caiu").first() });
      return { digitada, resultados, artigo };
    },
    cenas: (T) => [
      { id: "digita", passo: "1", titulo: "Busque pelo assunto", fala: "Digita só o que você lembra: furto.", min: 3.4,
        trechos: [{ tela: "digitada", de: 0, ate: 1, y0: 0, y1: mira(T.digitada, "campo", 0.3) }],
        toques: [{ em: 0.25, tela: "digitada", alvo: "campo", trecho: 0 }] },
      { id: "acha", passo: "2", titulo: "O artigo certo aparece", fala: "E o artigo cento e cinquenta e cinco do Código Penal aparece logo no topo.", min: 4,
        trechos: [{ tela: "resultados", de: 0, ate: 1, y0: mira(T.resultados, "campo", 0.3), y1: mira(T.resultados, "art", 0.45) }],
        toques: [{ em: 0.85, tela: "resultados", alvo: "art", trecho: 0 }] },
      { id: "texto", passo: "3", titulo: "Texto oficial e comentário", fala: "Com o texto oficial e o comentário do que a prova cobra.", min: 4,
        trechos: [{ tela: "artigo", de: 0, ate: 1, y0: 0, y1: Math.max(0, mira(T.artigo, "caiu", 0.75) - 300) }] },
      { id: "caiu", passo: "4", titulo: "E onde já caiu", fala: "E em quais provas ele já caiu.", min: 3,
        trechos: [{ tela: "artigo", de: 0, ate: 1, y0: Math.max(0, mira(T.artigo, "caiu", 0.75) - 300), y1: mira(T.artigo, "caiu", 0.3) }] },
    ],
    fecho: { titulo: "Grátis.<br><em>Sem cadastro.</em>", fala: "A busca é grátis e nem pede cadastro. Link no perfil." },
    legenda: "Esqueceu o número do artigo? Busca pelo assunto 🔎\nDigita \"furto\" e o art. 155 do CP aparece no topo — com o texto oficial, comentário e onde já caiu na OAB.\n\nGrátis e sem cadastro, link no perfil 🔗",
    comentario: "Qual artigo vocês nunca lembram o número? 👇",
  },

  // A mesma prova, no computador: enunciado inteiro à vista, alternativa,
  // gabarito e comentário. A conta demo acerta (gabarito em --gabarito-pc).
  "pc-questao": {
    tela: "desktop",
    slug: "produto-pc-questao",
    gancho: "A prova da OAB no computador.",
    abre: "Estudar pra OAB no computador? Olha isso.",
    certa: "C",
    async capturar(page, pasta) {
      await entrar(page, "/app/questoes");
      const alt = (l) => page.locator("main button").filter({ hasText: new RegExp(`^\\s*${l}\\s*[^a-zà-ú\\s]`) }).first();
      const responder = page.getByRole("button", { name: "Responder" });
      const questao = () => page.getByText(/Exame · questão/).first();
      const fila = await tela(page, pasta, "fila", { questao: questao(), certa: alt(this.certa), responder });
      await alt(this.certa).click();
      const marcada = await tela(page, pasta, "marcada", { certa: alt(this.certa), responder });
      await responder.click();
      await page.waitForResponse((r) => r.url().includes("/api/responder"), { timeout: 30000 }).catch(() => {});
      const respondida = await tela(page, pasta, "respondida", { certa: alt(this.certa), comentario: page.getByText(/coment/i).last() });
      return { fila, marcada, respondida };
    },
    cenas: (T) => [
      { id: "prova", passo: "1", titulo: "A prova de verdade", fala: "O quadragésimo sexto exame inteiro, questão por questão, na tela grande.", min: 4.4,
        trechos: [{ tela: "fila", de: 0, ate: 1, y0: 0, y1: topoDe(T.fila, "questao", 40), z0: 1, z1: 1.4, f0: centro(0), f1: naColuna(T.fila, "questao", 160) }] },
      { id: "marca", passo: "2", titulo: "Marque e responda", fala: "Marca a alternativa e responde.", min: 3.6,
        trechos: [{ tela: "fila", de: 0, ate: 0.5, y0: topoDe(T.fila, "questao", 40), y1: mira(T.fila, "certa", 0.45), z0: 1.4, z1: 1.45, f0: naColuna(T.fila, "questao", 160), f1: naColuna(T.fila, "certa") },
                  { tela: "marcada", de: 0.5, ate: 1, y0: mira(T.marcada, "certa", 0.45), y1: mira(T.marcada, "responder", 0.55), z0: 1.45, z1: 1.45, f0: naColuna(T.marcada, "certa"), f1: naColuna(T.marcada, "responder", -60) }],
        toques: [{ em: 0.38, tela: "fila", alvo: "certa", trecho: 0 }, { em: 0.85, tela: "marcada", alvo: "responder", trecho: 1 }] },
      { id: "porque", passo: "3", titulo: "Gabarito e comentário", fala: "Na hora, o gabarito e o comentário explicando o porquê.", min: 4.6,
        trechos: [{ tela: "respondida", de: 0, ate: 1, y0: mira(T.respondida, "certa", 0.45), y1: mira(T.respondida, "comentario", 0.3), z0: 1.45, z1: 1.4, f0: naColuna(T.respondida, "certa"), f1: naColuna(T.respondida, "comentario", 140) }] },
    ],
    fecho: { titulo: "46º Exame<br><em>de graça.</em>", fala: "O quadragésimo sexto exame tá de graça. Link no perfil." },
    legenda: "A prova da OAB no computador 💻\nO 46º Exame inteiro, com gabarito oficial e comentário em cada questão — e o que você errar volta na revisão.\n\nDe graça, link no perfil 🔗",
    comentario: "Vocês estudam mais no celular ou no computador? 👇",
  },

  // O quadro de anotações: artigo achado pelo assunto vira cartão, a nota da
  // pessoa fica ao lado, e as ligações montam o mapa. Tudo sem plano.
  "pc-anotacoes": {
    tela: "desktop",
    slug: "produto-pc-anotacoes",
    gancho: "Confunde furto com roubo?",
    abre: "Confunde furto com roubo? Monta o mapa.",
    async capturar(page, pasta) {
      await entrar(page, "/app/anotacoes");
      const vista = { inteira: false };
      const campoLei = page.getByPlaceholder("furto, algemas, art. 155…");
      const abreLei = async () => { if (!(await campoLei.isVisible())) await page.getByRole("button", { name: "+ Lei ou súmula" }).click(); };
      const fechaLei = async () => { if (await campoLei.isVisible()) await page.getByRole("button", { name: "+ Lei ou súmula" }).click(); await page.waitForTimeout(300); };
      const resultado = (rotulo) => page.getByText(rotulo, { exact: true }).first();
      const cartao = (txt) => page.locator(".react-flow__node").filter({ hasText: txt }).first();

      await abreLei();
      await campoLei.fill("furto");
      await resultado("Art. 155 CP").waitFor({ timeout: 15000 });
      const busca = await tela(page, pasta, "busca", { campo: campoLei, r155: resultado("Art. 155 CP") }, vista);
      await resultado("Art. 155 CP").click();
      await page.waitForTimeout(1200);
      await fechaLei();
      const lei = await tela(page, pasta, "lei", { c155: cartao("Art. 155 CP"), botaoNota: page.getByRole("button", { name: "+ Anotação" }) }, vista);

      await page.getByRole("button", { name: "+ Anotação" }).click();
      await page.waitForTimeout(1200);
      const nota = page.locator(".react-flow__node").filter({ has: page.getByPlaceholder("Título") }).first();
      await nota.getByPlaceholder("Título").fill("Furto x roubo");
      await nota.getByPlaceholder("Escreva aqui — o que confundiu, a regra, o macete.").fill("Roubo é o furto com violência ou grave ameaça à pessoa.");
      const escrita = await tela(page, pasta, "escrita", { nota, c155: cartao("Art. 155 CP") }, vista);

      await abreLei();
      await campoLei.fill("roubo");
      await resultado("Art. 157 CP").waitFor({ timeout: 15000 });
      await resultado("Art. 157 CP").click();
      await page.waitForTimeout(1200);
      await fechaLei();
      await page.locator(".react-flow__controls-fitview").click();
      await page.waitForTimeout(1200);
      const alca = (no, lado) => no.locator(`.react-flow__handle-${lado}`);
      const tres = await tela(page, pasta, "tres", {
        c155: cartao("Art. 155 CP"), nota, c157: cartao("Art. 157 CP"),
        a155: alca(cartao("Art. 155 CP"), "right"), notaE: alca(nota, "left"), notaD: alca(nota, "right"), a157: alca(cartao("Art. 157 CP"), "left"),
      }, vista);
      for (const [de, ate] of [[alca(cartao("Art. 155 CP"), "right"), alca(nota, "left")], [alca(nota, "right"), alca(cartao("Art. 157 CP"), "left")]]) {
        const a = await de.boundingBox(), b = await ate.boundingBox();
        await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
        await page.mouse.down();
        await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 20 });
        await page.mouse.up();
        await page.waitForTimeout(800);
      }
      const ligado = await tela(page, pasta, "ligado", { nota, contagem: page.getByText(/cartões ·/) }, vista);
      return { busca, lei, escrita, tres, ligado };
    },
    cenas: (T) => [
      { id: "busca", passo: "1", titulo: "Ache o artigo pelo assunto", fala: "Busca pelo assunto: furto.", min: 3.4,
        trechos: [{ tela: "busca", de: 0, ate: 1, y0: 0, y1: 0, z0: 1, z1: 2, f0: centro(0), f1: foco(T.busca, "r155", 140, 50) }],
        toques: [{ em: 0.85, tela: "busca", alvo: "r155", trecho: 0 }] },
      { id: "cartao", passo: "2", titulo: "Ele vira um cartão", fala: "E o artigo vira um cartão, com o texto oficial.", min: 3.6,
        trechos: [{ tela: "lei", de: 0, ate: 1, y0: 0, y1: 0, z0: 2, z1: 2.2, f0: foco(T.lei, "c155"), f1: foco(T.lei, "c155") }] },
      { id: "nota", passo: "3", titulo: "Escreva a sua regra", fala: "Do lado, a sua anotação, do seu jeito.", min: 3.4,
        trechos: [{ tela: "escrita", de: 0, ate: 1, y0: 0, y1: 0, z0: 2.1, z1: 2.1, f0: foco(T.escrita, "c155"), f1: foco(T.escrita, "nota") }] },
      { id: "liga", passo: "4", titulo: "Ligue uma coisa na outra", fala: "Traz o roubo e liga tudo. Furto e roubo, lado a lado, com a diferença escrita por você.", min: 5.6,
        trechos: [{ tela: "tres", de: 0, ate: 0.62, y0: 0, y1: 0, z0: 1.35, z1: 1.35, f0: foco(T.tres, "nota"), f1: foco(T.tres, "nota") },
                  { tela: "ligado", de: 0.62, ate: 1, y0: 0, y1: 0, z0: 1.35, z1: 1.3, f0: foco(T.ligado, "nota"), f1: foco(T.ligado, "nota") }],
        toques: [{ em: 0.22, tela: "tres", alvo: "a155", trecho: 0 }, { em: 0.36, tela: "tres", alvo: "notaE", trecho: 0 },
                 { em: 0.5, tela: "tres", alvo: "notaD", trecho: 0 }, { em: 0.6, tela: "tres", alvo: "a157", trecho: 0 }] },
    ],
    fecho: { titulo: "Quadro<br><em>de graça.</em>", fala: "O quadro é de graça, só precisa criar a conta. Link no perfil." },
    legenda: "Confunde furto com roubo? Monta o mapa 🧠\nBusca o artigo pelo assunto, ele vira cartão com o texto oficial, e você liga com a sua anotação.\n\nGrátis com conta, link no perfil 🔗",
    comentario: "Qual dupla de crimes vocês mais confundem? 👇",
  },

  // O plano até a prova: um clique numa situação pronta e o roadmap nasce,
  // semana a semana. Montar o plano não pede assinatura.
  "pc-plano": {
    tela: "desktop",
    slug: "produto-pc-plano",
    gancho: "Falta pouco pra OAB?",
    abre: "Falta pouco tempo pra OAB? Deixa que o plano se monta.",
    async capturar(page, pasta) {
      await entrar(page, "/app/plano");
      const vista = { inteira: false };
      const cartao = page.getByText("Falta pouco tempo", { exact: true });
      await cartao.scrollIntoViewIfNeeded();
      const plano = await tela(page, pasta, "plano", { cartao }, vista);
      await cartao.click();
      await page.getByText(/Montando seu cronograma/).waitFor({ timeout: 15000 });
      const montando = await tela(page, pasta, "montando", { msg: page.getByText(/Montando seu cronograma/), pedido: page.getByText(/quero concentrar no que/).first() }, vista);
      await page.waitForURL((u) => u.pathname === "/app/roadmap", { timeout: 90000 });
      // O esqueleto de loading.tsx chega antes: espera o roadmap de verdade.
      await page.getByText("Seu roadmap", { exact: true }).waitFor({ timeout: 60000 });
      await page.waitForLoadState("networkidle");
      await page.evaluate(() => window.scrollTo(0, 0));
      const roadmap = await tela(page, pasta, "roadmap", {
        titulo: page.getByText("Seu roadmap", { exact: true }),
        blocos: page.getByText(/\d+\/\d+ blocos/).first(),
        semana: page.getByText("Semanas e blocos", { exact: false }).first(),
        sessao: page.getByText("Iniciar sessão guiada").first(),
      });
      return { plano, montando, roadmap };
    },
    cenas: (T) => [
      { id: "diga", passo: "1", titulo: "Diga quanto tempo tem", fala: "Diz quanto tempo você tem. Falta pouco? Um clique.", min: 3.8,
        trechos: [{ tela: "plano", de: 0, ate: 1, y0: 0, y1: 0, z0: 1, z1: 1.9, f0: centro(0), f1: foco(T.plano, "cartao", 0, 30) }],
        toques: [{ em: 0.85, tela: "plano", alvo: "cartao", trecho: 0 }] },
      { id: "monta", passo: "2", titulo: "O plano se monta sozinho", fala: "E o plano se monta sozinho, até o dia da prova.", min: 3.4,
        trechos: [{ tela: "montando", de: 0, ate: 1, y0: 0, y1: 0, z0: 1.9, z1: 2, f0: foco(T.montando, "pedido"), f1: foco(T.montando, "msg", 120) }] },
      { id: "semanas", passo: "3", titulo: "Semana a semana", fala: "Semana a semana, com o que estudar em cada bloco.", min: 3.8,
        trechos: [{ tela: "roadmap", de: 0, ate: 1, y0: 0, y1: topoDe(T.roadmap, "semana", 160), z0: 1.1, z1: 1.4, f0: naColuna(T.roadmap, "titulo", 120), f1: naColuna(T.roadmap, "semana", 220) }] },
      { id: "sessao", passo: "4", titulo: "E a sessão de hoje", fala: "E a primeira sessão já tá pronta pra começar.", min: 3.2,
        trechos: [{ tela: "roadmap", de: 0, ate: 1, y0: topoDe(T.roadmap, "semana", 160), y1: topoDe(T.roadmap, "semana", 160), z0: 1.4, z1: 1.9, f0: naColuna(T.roadmap, "semana", 220), f1: foco(T.roadmap, "sessao", -60) }],
        toques: [{ em: 0.7, tela: "roadmap", alvo: "sessao", trecho: 0 }] },
    ],
    fecho: { titulo: "Plano<br><em>de graça.</em>", fala: "Montar o plano é de graça. Link no perfil." },
    legenda: "Falta pouco pra OAB? Deixa o plano se montar 📅\nUm clique e sai o cronograma até a prova, semana a semana, com o que estudar em cada bloco.\n\nMontar o plano é grátis, link no perfil 🔗",
    comentario: "Quanto tempo por dia vocês conseguem estudar? 👇",
  },
};

// ---------------------------------------------------------------------------
// Montagem
// ---------------------------------------------------------------------------

const R = ROTEIROS[args.roteiro];
if (!R) throw new Error(`Roteiro desconhecido. Existem: ${Object.keys(ROTEIROS).join(", ")}`);
const DESK = R.tela === "desktop";
if (DESK) { VW = 1280; VH = 800; }
const pasta = join(tmpdir(), `oabase-produto-${args.roteiro}-${Date.now()}`);
mkdirSync(pasta, { recursive: true });

console.log(`Gravando "${args.roteiro}" em ${SITE}`);
const { browser, page } = await abrirNavegador(DESK);
const T = await R.capturar(page, pasta);
await browser.close();

const definicao = R.cenas(T);
const narracao = await narrar(
  [{ id: "gancho", fala: R.abre, min: 2.4 }, ...definicao.map((c) => ({ id: c.id, fala: c.fala, min: c.min })), { id: "fecho", fala: R.fecho.fala, min: 2.6 }],
  join(pasta, "voz"),
);
const C = narracao.cenas, FIM = narracao.duracao;

const PW = 600, S = PW / VW, PH = Math.round(VH * S);
// Trechos e toques em segundos absolutos.
const trechos = [], toques = [], passos = [];
for (const c of definicao) {
  const { inicio, fim } = C[c.id], d = fim - inicio;
  const base = trechos.length;
  for (const tr of c.trechos)
    trechos.push({
      tela: tr.tela, de: inicio + tr.de * d, ate: inicio + tr.ate * d, y0: tr.y0, y1: tr.y1,
      z0: tr.z0 ?? 1, z1: tr.z1 ?? tr.z0 ?? 1, f0: tr.f0 ?? centro(tr.y0), f1: tr.f1 ?? tr.f0 ?? centro(tr.y1),
    });
  for (const k of c.toques ?? []) toques.push({ em: inicio + k.em * d, tela: k.tela, alvo: k.alvo, trecho: base + k.trecho });
  passos.push({ de: inicio, ate: fim, passo: c.passo, titulo: c.titulo });
}
const CEL = [C[definicao[0].id].inicio, C[definicao.at(-1).id].fim];

let corpo, css, js;
if (!DESK) {
corpo = `
<section class="cena" id="gancho" style="padding-top:500px">
  <h1 id="g" style="font-size:${R.gancho.length <= 30 ? 160 : 128}px">${escapa(R.gancho)}</h1>
</section>
<div id="legenda"><span id="num"></span><span id="txt"></span></div>
<div id="celular"><div id="tela">${Object.entries(T).map(([k, v]) => `<img id="t-${k}" src="${v.img}">`).join("")}<div id="toque"></div></div></div>
<section class="cena" id="fecho" style="padding-top:540px;text-align:center">
  <div class="tile" style="width:190px;height:190px;border-radius:48px;font-size:90px;margin:0 auto 60px">OA</div>
  <h1 style="font-size:130px">${R.fecho.titulo}</h1>
  <div style="margin-top:56px"><span class="cta">Link no perfil</span></div>
</section>`;

css = `
  #g{transform-origin:0 50%}
  #legenda{position:absolute;top:200px;left:90px;right:90px;display:flex;align-items:center;gap:26px;z-index:6;opacity:0}
  #num{flex-shrink:0;width:96px;height:96px;border-radius:50%;background:var(--ouro);color:var(--noite);display:grid;place-items:center;font-size:52px;font-weight:800}
  #txt{font-family:var(--serif);font-weight:600;font-size:64px;line-height:1.05;letter-spacing:-2px;color:#eef6f2}
  #celular{position:absolute;left:${(1080 - PW) / 2 - 18}px;top:380px;width:${PW + 36}px;height:${PH + 36}px;border-radius:64px;background:#0a0f0e;padding:18px;
    box-shadow:0 0 0 3px #ffffff22,0 50px 120px #000a;opacity:0;z-index:4}
  #tela{position:relative;width:${PW}px;height:${PH}px;border-radius:48px;overflow:hidden;background:#fff}
  #tela img{position:absolute;left:0;top:0;width:${PW}px;opacity:0}
  #toque{position:absolute;width:84px;height:84px;margin:-42px 0 0 -42px;border-radius:50%;background:#e9a23b55;border:5px solid #e9a23b;opacity:0;z-index:3}`;

js = `
const FIM = ${FIM};
const P = ${JSON.stringify({ trechos, toques, passos, caixas: Object.fromEntries(Object.entries(T).map(([k, v]) => [k, v.caixas])) })};
const S = ${S}, CEL = [${CEL}];
window.render = (t) => {
  cena(t, "#gancho", 0, ${C.gancho.fim}, FIM);
  const k = eo(p(t, 0, 0.55));
  $("#g").style.transform = "scale(" + (1.1 - 0.1 * k + 0.012 * Math.sin(t * 3.2) * k) + ")";
  cena(t, "#fecho", ${C.fecho.inicio}, FIM, FIM);

  const cel = $("#celular");
  const ent = eo(p(t, CEL[0], CEL[0] + 0.5)), sai = p(t, CEL[1] - 0.35, CEL[1]);
  cel.style.opacity = t >= CEL[0] && t < CEL[1] ? ent * (1 - sai) : 0;
  cel.style.transform = "translateY(" + ((1 - ent) * 120) + "px) scale(" + (0.96 + 0.04 * ent) + ")";

  let atual = P.trechos.find((tr) => t >= tr.de && t < tr.ate) ?? (t < CEL[0] ? P.trechos[0] : P.trechos[P.trechos.length - 1]);
  const yDe = (tr, tt) => mix(tr.y0, tr.y1, eio(p(tt, tr.de + 0.25, tr.ate - 0.2)));
  const y = yDe(atual, t);
  $$("#tela img").forEach((img) => {
    const ativa = img.id === "t-" + atual.tela;
    img.style.opacity = ativa ? 1 : 0;
    if (ativa) img.style.transform = "translateY(" + (-y * S) + "px)";
  });

  const toque = $("#toque");
  toque.style.opacity = 0;
  for (const q of P.toques) {
    if (t < q.em - 0.45 || t > q.em + 0.35) continue;
    const c = P.caixas[q.tela][q.alvo]; if (!c) continue;
    const tr = P.trechos[q.trecho];
    toque.style.left = c.x * S + "px";
    toque.style.top = (c.y - yDe(tr, Math.min(t, tr.ate))) * S + "px";
    const aperta = Math.sin(p(t, q.em - 0.1, q.em + 0.15) * Math.PI);
    toque.style.opacity = p(t, q.em - 0.45, q.em - 0.25) * (1 - p(t, q.em + 0.15, q.em + 0.35));
    toque.style.transform = "scale(" + (1 - 0.3 * aperta) + ")";
  }

  const leg = $("#legenda");
  const ps = P.passos.find((s) => t >= s.de && t < s.ate);
  if (ps) {
    $("#num").textContent = ps.passo;
    $("#txt").textContent = ps.titulo;
    const e = eo(p(t, ps.de, ps.de + 0.35));
    leg.style.opacity = e * (1 - p(t, ps.ate - 0.2, ps.ate));
    leg.style.transform = "translateY(" + (1 - e) * 24 + "px)";
  } else leg.style.opacity = 0;
};`;

} else {
  // Notebook: tela de SW px no vídeo, moldura B, base embaixo. O conjunto
  // escala em volta do foco; o cursor mora dentro da tela e cresce junto.
  const SW = 960, SD = SW / VW, SH = Math.round(VH * SD), B = 16;
  const NW = SW + 2 * B, NH = SH + 2 * B, L = (1080 - NW) / 2, TOPO = 560;
  corpo = `
<section class="cena" id="gancho" style="padding-top:500px">
  <h1 id="g" style="font-size:${R.gancho.length <= 30 ? 150 : 120}px">${escapa(R.gancho)}</h1>
</section>
<div id="legenda"><span id="num"></span><span id="txt"></span></div>
<div id="nbwrap"><div id="notebook">
  <div id="tela">${Object.entries(T).map(([k, v]) => `<img id="t-${k}" src="${v.img}">`).join("")}
    <svg id="cursor" viewBox="0 0 24 24"><path d="M3 2l7.5 19 2.6-7.9L21 10.5z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>
    <div id="clique"></div>
  </div>
  <div id="base"></div>
</div></div>
<section class="cena" id="fecho" style="padding-top:540px;text-align:center">
  <div class="tile" style="width:190px;height:190px;border-radius:48px;font-size:90px;margin:0 auto 60px">OA</div>
  <h1 style="font-size:130px">${R.fecho.titulo}</h1>
  <div style="margin-top:56px"><span class="cta">Link no perfil</span></div>
</section>`;

  css = `
  #g{transform-origin:0 50%}
  #legenda{position:absolute;top:200px;left:90px;right:90px;display:flex;align-items:center;gap:26px;z-index:6;opacity:0;
    padding:22px 28px;border-radius:32px;background:#041f1ccc;backdrop-filter:blur(6px)}
  #num{flex-shrink:0;width:96px;height:96px;border-radius:50%;background:var(--ouro);color:var(--noite);display:grid;place-items:center;font-size:52px;font-weight:800}
  #txt{font-family:var(--serif);font-weight:600;font-size:64px;line-height:1.05;letter-spacing:-2px;color:#eef6f2}
  #nbwrap{position:absolute;left:0;top:0;width:1080px;height:1920px;opacity:0;z-index:4}
  #notebook{position:absolute;left:${L}px;top:${TOPO}px;width:${NW}px;height:${NH}px;border-radius:28px 28px 10px 10px;background:#0a0f0e;padding:${B}px;
    box-shadow:0 0 0 3px #ffffff22,0 50px 120px #000a;transform-origin:0 0}
  #tela{position:relative;width:${SW}px;height:${SH}px;border-radius:8px;overflow:hidden;background:#fff}
  #tela img{position:absolute;left:0;top:0;width:${SW}px;opacity:0}
  #base{position:absolute;left:-44px;right:-44px;top:${NH}px;height:30px;border-radius:0 0 26px 26px;background:linear-gradient(#2a3431,#141b19);
    box-shadow:0 0 0 2px #ffffff18}
  #base::after{content:"";position:absolute;left:50%;top:0;width:150px;height:10px;margin-left:-75px;border-radius:0 0 10px 10px;background:#0a0f0e}
  #cursor{position:absolute;left:0;top:0;width:26px;height:26px;margin:-2px 0 0 -3px;opacity:0;z-index:4;filter:drop-shadow(0 2px 3px #0006)}
  #clique{position:absolute;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;border:3px solid #e9a23b;background:#e9a23b33;opacity:0;z-index:3}`;

  js = `
const FIM = ${FIM};
const P = ${JSON.stringify({ trechos, toques, passos, caixas: Object.fromEntries(Object.entries(T).map(([k, v]) => [k, v.caixas])) })};
const SD = ${SD}, SW = ${SW}, SH = ${SH}, B = ${B}, NW = ${NW}, NH = ${NH}, L = ${L}, TOPO = ${TOPO}, CEL = [${CEL}];
const CX = 540, CY = 1080;
const yDe = (tr, tt) => mix(tr.y0, tr.y1, eio(p(tt, tr.de + 0.25, tr.ate - 0.2)));
const kDe = (tr, tt) => eio(p(tt, tr.de + 0.1, tr.ate - 0.15));
function posToque(q, t) {
  const c = P.caixas[q.tela][q.alvo]; if (!c) return null;
  const tr = P.trechos[q.trecho];
  return { x: c.x * SD, y: (c.y - yDe(tr, Math.min(t, tr.ate))) * SD };
}
window.render = (t) => {
  cena(t, "#gancho", 0, ${C.gancho.fim}, FIM);
  const k0 = eo(p(t, 0, 0.55));
  $("#g").style.transform = "scale(" + (1.1 - 0.1 * k0 + 0.012 * Math.sin(t * 3.2) * k0) + ")";
  cena(t, "#fecho", ${C.fecho.inicio}, FIM, FIM);

  const wrap = $("#nbwrap");
  const ent = eo(p(t, CEL[0], CEL[0] + 0.5)), sai = p(t, CEL[1] - 0.35, CEL[1]);
  wrap.style.opacity = t >= CEL[0] && t < CEL[1] ? ent * (1 - sai) : 0;
  wrap.style.transform = "translateY(" + ((1 - ent) * 120) + "px)";

  const atual = P.trechos.find((tr) => t >= tr.de && t < tr.ate) ?? (t < CEL[0] ? P.trechos[0] : P.trechos[P.trechos.length - 1]);
  const y = yDe(atual, t), k = kDe(atual, t);
  const z = mix(atual.z0, atual.z1, k);
  const fx = mix(atual.f0.x, atual.f1.x, k), fy = mix(atual.f0.y, atual.f1.y, k);
  $$("#tela img").forEach((img) => {
    const ativa = img.id === "t-" + atual.tela;
    img.style.opacity = ativa ? 1 : 0;
    if (ativa) img.style.transform = "translateY(" + (-y * SD) + "px)";
  });
  // Ponto de foco em coordenadas do notebook, preso para a câmera não
  // mostrar o vazio além da borda.
  const meia = 540 / z;
  const sx = NW > 2 * meia ? cl(B + fx * SD, meia, NW - meia) : NW / 2;
  const sy = B + cl(fy - y, 0, ${VH}) * SD;
  const w = cl((z - 1) / 0.45, 0, 1);
  const tx = mix((1 - z) * NW / 2, CX - L - sx * z, w);
  const ty = mix((1 - z) * NH / 2, CY - TOPO - sy * z, w);
  $("#notebook").style.transform = "translate(" + tx + "px," + ty + "px) scale(" + z + ")";

  // Cursor: desliza do clique anterior até o próximo e clica.
  const cur = $("#cursor"), anel = $("#clique");
  cur.style.opacity = t >= CEL[0] + 0.3 && t < CEL[1] - 0.2 ? 1 : 0;
  anel.style.opacity = 0;
  const i = P.toques.findIndex((q) => t <= q.em + 0.35);
  const alvo = i >= 0 ? P.toques[i] : P.toques[P.toques.length - 1];
  let pos = { x: SW * 0.62, y: SH * 0.7 };
  if (alvo) {
    const fim = posToque(alvo, t) ?? pos;
    const ant = i > 0 ? posToque(P.toques[i - 1], t) ?? pos : pos;
    const m = i >= 0 ? eio(p(t, alvo.em - 0.9, alvo.em - 0.12)) : 1;
    pos = { x: mix(ant.x, fim.x, m), y: mix(ant.y, fim.y, m) };
    if (i >= 0 && t > alvo.em - 0.1) {
      const a = p(t, alvo.em - 0.05, alvo.em + 0.35);
      anel.style.opacity = 1 - a;
      anel.style.left = fim.x + "px"; anel.style.top = fim.y + "px";
      anel.style.transform = "scale(" + (0.6 + 1.2 * a) + ")";
    }
  }
  cur.style.left = pos.x + "px"; cur.style.top = pos.y + "px";

  const leg = $("#legenda");
  const ps = P.passos.find((s) => t >= s.de && t < s.ate);
  if (ps) {
    $("#num").textContent = ps.passo;
    $("#txt").textContent = ps.titulo;
    const e = eo(p(t, ps.de, ps.de + 0.35));
    leg.style.opacity = e * (1 - p(t, ps.ate - 0.2, ps.ate));
    leg.style.transform = "translateY(" + (1 - e) * 24 + "px)";
  } else leg.style.opacity = 0;
};`;
}

const hoje = args.data ? args.data : new Date().toISOString().slice(0, 10);
const saida = join("videos", `${hoje}-${R.slug}.mp4`);
console.log(`Montando ${FIM.toFixed(1)}s…`);
const browser2 = await chromium.launch();
await renderizar({
  // No desktop o notebook aproximado desce até o rodapé, que ficaria por cima.
  html: pagina({ corpo, css, js, pill: "OABase", duracao: FIM, escuro: true, marcaApos: C.gancho.fim, ...(DESK && { rodape: "" }) }),
  duracao: FIM,
  audio: { ...trilha({ duracao: FIM, acorde: [220, 277.18, 329.63], cortes: [0.02, C.fecho.inicio], ticks: toques.map((q) => [q.em, 1500]) }), voz: narracao.arquivo },
  saida,
  browser: browser2,
});
await browser2.close();
writeFileSync(saida.replace(/\.mp4$/, ".txt"), ["── LEGENDA ──", R.legenda, "", "#oab #exameoab #examedeordem #direito #estudantededireito #dicasoab #estudos", "", "── COMENTÁRIO PARA FIXAR ──", R.comentario, ""].join("\n"));
console.log("→", saida);
