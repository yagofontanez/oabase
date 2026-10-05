import { test } from "node:test";
import assert from "node:assert/strict";
import { destinoInterno } from "./destino";

test("caminho interno passa, com query", () => {
  assert.equal(destinoInterno("/app/questoes"), "/app/questoes");
  assert.equal(destinoInterno("/app/questoes?exame=46"), "/app/questoes?exame=46");
});

test("outro site cai no padrão", () => {
  for (const pedido of ["//site.com", "/\\site.com", "/\t/site.com", "https://site.com", "site.com", "", null, undefined]) {
    assert.equal(destinoInterno(pedido), "/app", String(pedido));
  }
});

test("padrão configurável", () => {
  assert.equal(destinoInterno(null, "/entrar"), "/entrar");
});
