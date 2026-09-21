import assert from "node:assert/strict";
import test from "node:test";
import {
  getLinksEditoriaisDoArtigo,
  limparTextoDeMetadata,
  metadadosDoArtigo,
} from "./metadados-artigo";
import type { Artigo, Lei } from "./types";

const lei: Lei = {
  slug: "codigo-penal",
  nome: "Código Penal",
  sigla: "CP",
  ano: 1940,
  resumo: "",
  disciplinaSlug: "direito-penal",
};

const artigo: Artigo = {
  leiSlug: lei.slug,
  slug: "artigo-155",
  numero: "155",
  caput: "Subtrair coisa alheia móvel: Pena \u0096 reclusão.",
  paragrafos: [],
  comentario: ["Comentário revisado."],
  incidencia: 1,
  disciplinaSlug: "direito-penal",
  atualizadoEm: "2026-09-21",
  indexavel: true,
};

test("limpa controles C1 que quebram snippets", () => {
  assert.equal(
    limparTextoDeMetadata("Pena \u0096 reclusão"),
    "Pena – reclusão",
  );
});

test("usa metadata editorial quando ela existe", () => {
  const metadata = metadadosDoArtigo(lei, {
    ...artigo,
    seoTitulo: "Art. 155 do Código Penal: furto comentado",
    seoDescricao: "Entenda o furto cobrado na OAB.",
  });

  assert.deepEqual(metadata, {
    titulo: "Art. 155 do Código Penal: furto comentado",
    descricao: "Entenda o furto cobrado na OAB.",
  });
});

test("mantém fallback automático limpo para os demais artigos", () => {
  const metadata = metadadosDoArtigo(lei, artigo);

  assert.equal(metadata.titulo, "Art. 155 do Código Penal — comentado");
  assert.match(metadata.descricao, /Pena – reclusão/);
  assert.ok(metadata.descricao.length <= 155);
});

test("oferece comparação editorial recíproca entre furto e roubo", () => {
  assert.deepEqual(
    getLinksEditoriaisDoArtigo("codigo-penal", "artigo-155"),
    [
      {
        href: "/legislacao/codigo-penal/artigo-157",
        rotulo: "Compare o furto com o roubo do art. 157 do Código Penal",
      },
    ],
  );
  assert.deepEqual(
    getLinksEditoriaisDoArtigo("codigo-civil", "artigo-186"),
    [],
  );
});
