import { test } from "node:test";
import assert from "node:assert/strict";
import { paraFala, romano, trechosParaFalar } from "./leitura-da-lei";

// Trechos reais do acervo (Código Penal e Estatuto da OAB, texto do Planalto).

test("tira a nota de redação e o número repetido por extenso", () => {
  assert.equal(
    paraFala(
      "Subtrair, para si ou para outrem, coisa alheia móvel: Pena – reclusão, de 1 (um) a 6 (seis) anos, e multa. (Redação dada pela Lei nº 15.397, de 2026)",
    ),
    "Subtrair, para si ou para outrem, coisa alheia móvel: Pena, reclusão, de um a seis anos, e multa.",
  );
});

test("parágrafo com os três jeitos de escrever o ordinal", () => {
  assert.match(paraFala("§ 1º A pena aumenta-se de metade"), /^Parágrafo primeiro A pena/);
  assert.match(paraFala("§ 1o Incorre na mesma pena"), /^Parágrafo primeiro Incorre/);
  assert.match(paraFala("§ 2° Se o homicídio é cometido:"), /^Parágrafo segundo Se o homicídio/);
  assert.match(paraFala("§ 2º - Se o criminoso é primário"), /^Parágrafo segundo, Se o criminoso/);
});

test("parágrafo inserido e lista de parágrafos", () => {
  assert.match(paraFala("§ 4º-A. É absoluta a presunção"), /^Parágrafo quarto A É absoluta/);
  assert.match(
    paraFala("As penas previstas no caput e nos §§ 1º, 3º e 4º deste artigo"),
    /nos parágrafos primeiro, terceiro e quarto deste artigo/,
  );
});

test("inciso e alínea no começo do trecho", () => {
  assert.equal(paraFala("IV - à traição, de emboscada"), "Inciso 4. à traição, de emboscada");
  assert.equal(paraFala("II - com abuso de confiança;"), "Inciso 2. com abuso de confiança;");
  assert.equal(paraFala("a) de ofício;"), "Alínea a. de ofício;");
});

test("artigo citado, com sufixo e em lista", () => {
  assert.match(paraFala("nos termos do art. 5º da Constituição"), /nos termos do artigo quinto da Constituição/);
  assert.match(paraFala("previsto no art. 217-A deste Código"), /no artigo 217 A deste Código/);
  assert.match(paraFala("Os arts. 157, § 3º; 159"), /Os artigos 157, parágrafo terceiro; 159/);
});

test("incisos citados no meio do texto", () => {
  assert.match(
    paraFala("preencher os requisitos mencionados nos incisos I, III, V, VI e VII do art. 8º"),
    /nos incisos 1, 3, 5, 6 e 7 do artigo oitavo/,
  );
});

test("caput que chega começando por ponto (o 217-A do CP)", () => {
  assert.match(paraFala(". Ter conjunção carnal"), /^Ter conjunção carnal/);
});

test("número de lei e ordinal solto", () => {
  assert.match(paraFala("Lei nº 8.906, de 4 de julho de 1994"), /Lei número 8.906/);
  assert.match(paraFala("a partir de 1º de janeiro"), /a partir de primeiro de janeiro/);
  assert.match(paraFala("o 10º dia"), /o 10º dia/); // acima do nono, fica como está
});

test("romanos", () => {
  assert.equal(romano("XIV"), 14);
  assert.equal(romano("XLIX"), 49);
  assert.equal(romano("A"), null);
});

test("trechos longos viram pedaços e guardam o parágrafo de origem", () => {
  const longo = Array.from({ length: 12 }, (_, i) => `Frase número ${i + 1} do caput, bem comprida para passar do limite.`).join(" ");
  const trechos = trechosParaFalar([longo, "§ 1º Curto."]);
  assert.ok(trechos.length > 2);
  assert.ok(trechos.every((t) => t.fala.length <= 260));
  assert.equal(trechos.at(-1)?.parte, 1);
  assert.equal(trechos.at(-1)?.fala, "Parágrafo primeiro Curto.");
});

test("defeitos do acervo que a varredura encontrou", () => {
  assert.match(paraFala("nos arts. 3º, 3º-A, 4º, 5º e 20 da Lei"), /nos artigos terceiro, terceiro A, quarto, quinto e 20 da Lei/);
  assert.match(paraFala("o Supremo Tribunal Federal; I-A o Conselho Nacional de Justiça;"), /Federal; inciso 1 A, o Conselho/);
  assert.equal(
    paraFala("por folha: R$ 0,55 (cinqüenta e cinco centavos de real);"),
    "por folha: cinqüenta e cinco centavos de real;",
  );
  assert.match(paraFala("do trabalho. Art. . 177, Se as condições"), /Artigo 177, Se as condições/);
  assert.match(paraFala("§ lº A sociedade que subscrever"), /^Parágrafo primeiro A sociedade/);
});

test("dispositivo revogado é dito revogado, não fica em silêncio", () => {
  assert.equal(paraFala("(Revogado pela Lei nº 9.279, de 14.5.1996)"), "revogado.");
  assert.equal(
    paraFala("III - (Revogado); (Redação dada pela Lei nº 13.146, de 2015) (Vigência)"),
    "Inciso 3. revogado.",
  );
  assert.equal(paraFala("§ 2o (VETADO) (Incluído pela Lei nº 12.015, de 2009)"), "Parágrafo segundo (VETADO)");
});

test("número sem ordinal não perde o espaço seguinte", () => {
  assert.equal(paraFala("Art. 121 do Código Penal."), "Artigo 121 do Código Penal.");
  assert.match(paraFala("§ 10 Se o juiz"), /^Parágrafo 10 Se o juiz/);
});

test("dois incisos na mesma linha", () => {
  assert.equal(
    paraFala("VI - (Revogado pela Lei nº 14.994, de 2024). VII - contra:"),
    "Inciso 6. revogado. Inciso 7. contra:",
  );
});

test("o \"o\" de ordinal não come a palavra seguinte", () => {
  assert.match(paraFala("do caput do art. 99 ou o inciso II"), /do artigo 99 ou o inciso 2/);
  assert.match(paraFala("nos termos do § 12 ocorrerão durante"), /do parágrafo 12 ocorrerão durante/);
  assert.match(paraFala("§ 1o Incorre na mesma pena"), /^Parágrafo primeiro Incorre/);
  assert.match(paraFala("à saúde; III -jurídica;"), /à saúde; Inciso 3. jurídica;/);
});
