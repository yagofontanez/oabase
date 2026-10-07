import { execFileSync } from "node:child_process";

// Dados dos vídeos, lidos do Supabase com a chave anônima — a mesma leitura
// que as páginas abertas fazem. Só tabelas de leitura aberta: `questoes` e
// `comentarios` voltariam vazias de qualquer jeito (RLS), e o que o vídeo
// mostra tem de ser o que qualquer pessoa confere no site.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function rest(caminho) {
  if (!url || !chave) throw new Error("Sem NEXT_PUBLIC_SUPABASE_URL/ANON_KEY — rode com --env-file=.env.local");
  const r = await fetch(`${url}/rest/v1/${caminho}`, { headers: { apikey: chave, Authorization: `Bearer ${chave}` } });
  if (!r.ok) throw new Error(`${caminho}: ${r.status} ${await r.text()}`);
  return r.json();
}

// Notas de redação do Planalto não são texto de lei: "(Redação dada pela Lei
// nº 13.247, de 2016)", "(Vide ADIN 1.127-8)", "(Incluído pela…)".
const NOTA = /\s*\((?:Redação|Incluíd|Vide|Revogad|Acrescentad|Renumerad|Vigência|Regulamento|Promulgação|Declaração|Execução|Produção)[^)]*\)/gi;

export function limpar(texto) {
  return String(texto ?? "")
    .replace(NOTA, "")
    .replace(/^[\s.;:–-]+/, "") // o 217-A do CP chega como ". Ter conjunção…"
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
}

/** Corta em fronteira de palavra; nunca no meio de uma. */
export function cortar(texto, max) {
  if (texto.length <= max) return texto;
  const corte = texto.slice(0, max).replace(/\s+\S*$/, "").replace(/[,;:–-]$/, "");
  return corte + "…";
}

/** "5º" → "5º", "155" → "155", "1" → "1º": artigos de 1 a 9 levam ordinal. */
export function numeroArtigo(n) {
  const s = String(n).replace(/[ºo°]$/, "");
  return /^\d$/.test(s) ? `${s}º` : s;
}

// Caput que termina em dois-pontos ("é necessário:") só faz sentido com os
// incisos. Os três primeiros entram; parágrafo (§) não, que já é outra regra.
function comIncisos(caput, paragrafos) {
  const texto = limpar(caput);
  if (!texto.endsWith(":")) return texto;
  const incisos = (paragrafos ?? []).map(limpar).filter((x) => /^[IVXL]+\s*[-–]/.test(x));
  return `${texto} ${incisos.slice(0, 3).join(" ")}`.trim();
}

// "do Código Penal", "da CLT" — o gênero não sai da sigla.
const PREPOSICAO = {
  "CF/88": "da Constituição", CP: "do Código Penal", CPC: "do CPC", CPP: "do CPP", CLT: "da CLT",
  CDC: "do CDC", CC: "do Código Civil", CTN: "do CTN", ECA: "do ECA", "Lei 8.906/94": "do Estatuto da OAB",
};
export function daLei(lei) {
  if (PREPOSICAO[lei.sigla]) return PREPOSICAO[lei.sigla];
  return /^(Lei|Constituição|Consolidação)/.test(lei.nome) ? `da ${lei.nome}` : `do ${lei.nome}`;
}

// Sorteio determinístico: o mesmo dia gera sempre o mesmo vídeo.
export function semente(texto) {
  let h = 1779033703 ^ texto.length;
  for (const c of texto) h = Math.imul(h ^ c.charCodeAt(0), 3432918353), (h = (h << 13) | (h >>> 19));
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}
export function embaralhar(lista, rng) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const fmt = (n) => n.toLocaleString("pt-BR");

// Formatos leves (quiz, verdadeiro ou falso) com trilha e emoji não combinam
// com crime sexual. Os artigos continuam no ranking, que tem tom de consulta.
const SO_TOM_SERIO = new Set(["codigo-penal:artigo-213", "codigo-penal:artigo-217-a", "codigo-penal:artigo-218", "codigo-penal:artigo-218-a", "codigo-penal:artigo-218-b"]);
export const tomLeve = (a) => !SO_TOM_SERIO.has(`${a.lei.slug}:${a.slug}`);

/**
 * Quantas questões têm cada letra como resposta — no acervo e por prova.
 *
 * O gabarito é conteúdo pago (RLS), então a chave anônima não o lê. Esta é a
 * única leitura com credencial de banco, e só sai **contagem agregada**:
 * nenhuma questão, nenhuma resposta individual deixa o banco. É o mesmo
 * número que um post do blog publica, recontado na hora.
 */
export function distribuicaoDeGabarito() {
  const conexao = process.env.SUPABASE_CONNECTION_STRING;
  if (!conexao) return null;
  const sql = `
    select coalesce(e.edicao::text, 'total') as exame, q.gabarito, count(*)
      from public.questoes q join public.exames e on e.id = q.exame_id
     where not coalesce(q.anulada, false) and q.gabarito in ('A','B','C','D')
     group by grouping sets ((e.edicao, q.gabarito), (q.gabarito))
     order by 1, 2`;
  const linhas = execFileSync("psql", [conexao, "-X", "-A", "-t", "-F", ",", "-c", sql], { encoding: "utf8" })
    .trim().split("\n").filter(Boolean).map((l) => l.split(","));
  const porExame = {};
  for (const [exame, letra, n] of linhas) (porExame[exame] ??= { A: 0, B: 0, C: 0, D: 0 })[letra] = Number(n);
  const anuladas = Number(execFileSync("psql", [conexao, "-X", "-A", "-t", "-c",
    "select count(*) from public.questoes where coalesce(anulada,false)"], { encoding: "utf8" }).trim());
  return { total: porExame.total, porExame, anuladas };
}

/**
 * Medidas da prova para os formatos narrados ("mito", "conta"). Mesma regra de
 * `distribuicaoDeGabarito`: só agregado sai do banco — nenhuma questão,
 * nenhum gabarito individual. São as contagens que os posts do blog publicam.
 */
export function medidasDaProva() {
  const conexao = process.env.SUPABASE_CONNECTION_STRING;
  if (!conexao) return null;
  const sql = `
    with v as (
      select e.edicao, q.gabarito,
             char_length(q.enunciado) enunciado,
             char_length(q.alternativas->>'A') a, char_length(q.alternativas->>'B') b,
             char_length(q.alternativas->>'C') c, char_length(q.alternativas->>'D') d,
             array_length(regexp_split_to_array(trim(q.enunciado || ' ' || (q.alternativas->>'A') || ' ' || (q.alternativas->>'B') || ' ' || (q.alternativas->>'C') || ' ' || (q.alternativas->>'D')), '\\s+'), 1) palavras
        from public.questoes q join public.exames e on e.id = q.exame_id
       where not coalesce(q.anulada, false) and q.gabarito in ('A','B','C','D') and q.alternativas ?& array['A','B','C','D']
    ), m as (
      select *, case gabarito when 'A' then a when 'B' then b when 'C' then c else d end certa,
             greatest(a,b,c,d) maior, least(a,b,c,d) menor,
             (a = greatest(a,b,c,d))::int + (b = greatest(a,b,c,d))::int + (c = greatest(a,b,c,d))::int + (d = greatest(a,b,c,d))::int nmaior,
             (a = least(a,b,c,d))::int + (b = least(a,b,c,d))::int + (c = least(a,b,c,d))::int + (d = least(a,b,c,d))::int nmenor
        from v
    )
    select json_build_object(
      'validas', count(*),
      'certaMaisLonga', count(*) filter (where certa = maior and nmaior = 1),
      'certaMaisCurta', count(*) filter (where certa = menor and nmenor = 1),
      'edicoes', (select json_build_object('min', min(edicao), 'max', max(edicao)) from m),
      'enunciadoInicio', (select round(avg(enunciado)) from m where edicao <= (select min(edicao) + 4 from m)),
      'enunciadoFim', (select round(avg(enunciado)) from m where edicao >= (select max(edicao) - 4 from m)),
      'amostra', (select json_build_object('edicao', e.edicao, 'questoes', count(*), 'palavras', sum(m.palavras))
                    from m join public.exames e on e.edicao = m.edicao where e.amostra_gratuita group by e.edicao)
    ) from m`;
  const base = JSON.parse(execFileSync("psql", [conexao, "-X", "-A", "-t", "-c", sql], { encoding: "utf8" }).trim());

  // Sequências da mesma letra na ordem da prova (anulada quebra a sequência),
  // provas com 20 de cada letra, e anulação. Só contagem: a sequência em si
  // de uma prova seria o gabarito dela, e gabarito fora da amostra é pago.
  const sql2 = `
    with q as (
      select e.edicao, q.numero, case when q.anulada then null else q.gabarito end g
        from public.questoes q join public.exames e on e.id = q.exame_id
    ), marcado as (
      select *, case when g is not distinct from lag(g) over w and g is not null then 0 else 1 end novo
        from q window w as (partition by edicao order by numero)
    ), grupos as (
      select *, sum(novo) over (partition by edicao order by numero) grp from marcado
    ), corridas as (
      select edicao, count(*) tam from grupos where g is not null group by edicao, grp
    ), letras as (
      select e.edicao, q.gabarito, count(*) n from public.questoes q join public.exames e on e.id = q.exame_id
       where not q.anulada and q.gabarito in ('A','B','C','D') group by 1, 2
    ), porProva as (
      select edicao, min(n) mn, max(n) mx, count(*) = 4 and bool_and(n = 20) exato from letras group by edicao
    )
    select json_build_object(
      'provas', (select count(distinct edicao) from corridas),
      'corridas', (select json_object_agg(t, n) from (select least(tam, 6) t, count(*) n from corridas where tam >= 3 group by 1) x),
      'corridas3', (select count(*) from corridas where tam >= 3),
      'provasComCorrida', (select count(distinct edicao) from corridas where tam >= 3),
      'maiorCorrida', (select json_build_object('tam', tam, 'edicao', edicao) from corridas order by tam desc, edicao limit 1),
      'provasExatas', (select count(*) from porProva where exato),
      'maiorDesequilibrio', (select json_build_object('edicao', edicao, 'min', mn, 'max', mx) from porProva order by mx - mn desc, edicao limit 1),
      'anuladas', (select sum(questoes_anuladas) from public.exames where questoes_carregadas > 0),
      'questoes', (select sum(questoes_carregadas) from public.exames where questoes_carregadas > 0),
      'provasSemAnulada', (select count(*) from public.exames where questoes_carregadas > 0 and questoes_anuladas = 0)
    )`;
  return { ...base, ...JSON.parse(execFileSync("psql", [conexao, "-X", "-A", "-t", "-c", sql2], { encoding: "utf8" }).trim()) };
}

export async function carregar() {
  const [artigos, sumulas, glossario, exames] = await Promise.all([
    rest("artigos?select=numero,slug,ordem,caput,paragrafos,incidencia,leis(slug,nome,sigla)&incidencia=gt.0&order=incidencia.desc,ordem.asc"),
    rest("sumulas?select=numero,slug,texto&tribunal=eq.stf&vinculante=eq.true&order=numero.asc"),
    rest("termos_glossario?select=termo,slug,artigos!inner(numero,slug,caput,paragrafos,incidencia,leis(slug,nome,sigla))&order=termo.asc"),
    rest("exames?select=edicao,ano,data_prova,questoes_carregadas,questoes_anuladas,amostra_gratuita&questoes_carregadas=gt.0&order=edicao.asc"),
  ]);

  return {
    artigos: artigos
      .map((a) => ({ numero: numeroArtigo(a.numero), slug: a.slug, ordem: a.ordem, incidencia: a.incidencia, lei: a.leis, texto: comIncisos(a.caput, a.paragrafos),
        // Texto oficial cru, trecho a trecho, para o formato que lê em voz alta.
        partes: [a.caput, ...(a.paragrafos ?? [])] }))
      .filter((a) => a.texto.length >= 25 && !a.texto.endsWith(":")),
    sumulas: sumulas.map((s) => ({ numero: s.numero, slug: s.slug, texto: limpar(s.texto) })),
    glossario: glossario
      .map((g) => {
        const a = g.artigos;
        return { termo: g.termo, slug: g.slug, texto: comIncisos(a.caput, a.paragrafos), artigo: { numero: numeroArtigo(a.numero), slug: a.slug, incidencia: a.incidencia, lei: a.leis } };
      })
      .filter((g) => g.texto.length >= 40 && !g.texto.endsWith(":")),
    exames,
    gabarito: distribuicaoDeGabarito(),
    medidas: medidasDaProva(),
  };
}
