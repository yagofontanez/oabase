"""Vínculo questão ↔ dispositivo inferido por modelo.

`dispositivos.py` acha 133 vínculos em 3.460 questões, e não é defeito do
regex: a FGV narra um caso e quase nunca nomeia o artigo. Sobram 3.317
questões sem nenhum dispositivo — e é justamente esse número que ordena a fila
de quem escreve comentário.

Este módulo pergunta ao modelo qual dispositivo a questão cobra, e grava com
`origem = 'modelo'`. A separação de origem é o que torna isso aceitável:

- `artigos.incidencia` conta **só** `citacao` e `humano`. É o número que a
  página aberta publica e que se confere relendo a questão. Não se mexe.
- `artigos.incidencia_estimada` conta tudo. É o que ordena trabalho interno,
  onde errar custa uma leitura a mais — não um dado falso no ar.

Duas guardas contra a invenção, que é o modo de falha óbvio aqui:

1. **O artigo precisa existir no acervo.** A resposta é conferida contra
   `(lei, número)` no banco; o que não bate é descartado em silêncio. Modelo
   que responde "art. 4.312 do CP" não cria vínculo nenhum.
2. **No máximo dois por questão.** Sem teto, o modelo lista o capítulo
   inteiro e a incidência estimada vira ruído uniforme — o oposto de uma fila
   ordenada.

    python3 -m oabase_ingest.vincular_ia --exame 46 --sql /tmp/v.sql
    python3 -m oabase_ingest.vincular_ia --carregar
"""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
import time

from .dispositivos import numero_canonico
from .groq import conversar

LOTE = 10
MAX_POR_QUESTAO = 2

INSTRUCAO = """Você identifica qual dispositivo legal cada questão da 1ª fase \
do Exame de Ordem (OAB/FGV) está cobrando.

Responda SOMENTE com JSON:
{"itens": [{"n": <número da questão>, "a": [{"lei": "<slug>", "art": "<número>"}]}]}

Leis disponíveis (use exatamente estes slugs):
%s

Regras:
- No máximo %d dispositivos por questão, os mais diretamente cobrados.
- "art" é só o número, como aparece na lei: "155", "5", "217-A", "1.723".
- Se a questão não cobrar dispositivo identificável, devolva "a": [].
- Não invente artigo. Na dúvida, devolva lista vazia — vazio é melhor que errado."""


def psql(sql: str, conexao: str) -> str:
    r = subprocess.run(
        ["psql", conexao, "-tAF\x1f", "-v", "ON_ERROR_STOP=1", "-c", sql],
        capture_output=True, text=True,
    )
    if r.returncode != 0:
        raise SystemExit(f"psql falhou:\n{r.stderr[:600]}")
    return r.stdout


def _lit(v: str) -> str:
    return "'" + v.replace("'", "''") + "'"


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--exame", type=int, help="uma edição só")
    p.add_argument("--sql", help="grava o SQL em vez de aplicar")
    p.add_argument("--carregar", action="store_true")
    p.add_argument("--pausa", type=float, default=1.0)
    args = p.parse_args(argv)

    conexao = os.environ.get("SUPABASE_CONNECTION_STRING")
    chave = os.environ.get("GROQ_API_KEY")
    if not conexao or not chave:
        print("✗ defina SUPABASE_CONNECTION_STRING e GROQ_API_KEY", file=sys.stderr)
        return 1

    # Índice de conferência: (slug da lei, número canônico) -> id do artigo.
    indice: dict[tuple[str, str], str] = {}
    for linha in psql(
        "select l.slug, a.numero, a.id from public.artigos a "
        "join public.leis l on l.id = a.lei_id",
        conexao,
    ).strip().split("\n"):
        if not linha:
            continue
        slug, numero, artigo_id = linha.split("\x1f")
        indice[(slug, numero_canonico(numero))] = artigo_id

    leis = [
        linha.replace("\x1f", " — ")
        for linha in psql(
            "select slug, sigla from public.leis order by slug", conexao
        ).strip().split("\n")
        if linha
    ]

    filtro = f"and e.edicao = {args.exame}" if args.exame else ""
    linhas = psql(
        "select q.id, e.edicao, q.numero, "
        "  replace(q.enunciado || ' ' || q.alternativas::text, e'\\n', ' ') "
        "from public.questoes q join public.exames e on e.id = q.exame_id "
        "where not exists (select 1 from public.questao_artigos qa "
        "                   where qa.questao_id = q.id) "
        f"  and not q.anulada {filtro} "
        "order by e.edicao desc, q.numero",
        conexao,
    ).strip().split("\n")

    questoes = []
    for linha in linhas:
        if not linha:
            continue
        qid, edicao, numero, texto = linha.split("\x1f", 3)
        questoes.append((qid, int(edicao), int(numero), re.sub(r"\s+", " ", texto)))

    if not questoes:
        print("nada a vincular")
        return 0

    print(f"→ {len(questoes)} questões sem dispositivo, em lotes de {LOTE}")

    por_chave = {(e, n): qid for qid, e, n, _ in questoes}
    pares: list[tuple[str, str]] = []
    vistos: set[tuple[str, str]] = set()
    inexistentes = 0
    sistema = INSTRUCAO % ("\n".join(leis), MAX_POR_QUESTAO)

    def despachar(edicao: int, bloco: list[tuple[int, str]]) -> None:
        nonlocal inexistentes
        if not bloco:
            return
        resposta = conversar(
            chave,
            sistema,
            "\n\n".join(f"Questão {n}: {t[:900]}" for n, t in bloco),
            teto=3500,
        )
        achados = 0
        novos: list[tuple[str, str]] = []
        for item in resposta.get("itens", []):
            if not isinstance(item, dict):
                continue
            try:
                qid = por_chave.get((edicao, int(item.get("n", -1))))
            except (TypeError, ValueError):
                continue
            if not qid:
                continue
            for ref in (item.get("a") or [])[:MAX_POR_QUESTAO]:
                if not isinstance(ref, dict):
                    continue
                artigo = indice.get(
                    (str(ref.get("lei")), numero_canonico(str(ref.get("art"))))
                )
                if artigo and (qid, artigo) not in vistos:
                    vistos.add((qid, artigo))
                    novos.append((qid, artigo))
                    pares.append((qid, artigo))
                    achados += 1
                elif not artigo:
                    inexistentes += 1
        # Grava a cada lote, pelo mesmo motivo do classificador: são horas de
        # execução contra um teto de tokens por minuto, e o que não está no
        # banco quando a execução para não existiu.
        if novos and args.carregar:
            valores = ",\n  ".join(
                f"({_lit(q)}::uuid, {_lit(a)}::uuid, 'modelo')" for q, a in novos
            )
            r = subprocess.run(
                ["psql", conexao, "-v", "ON_ERROR_STOP=1", "-q", "-f", "-"],
                input=(
                    "insert into public.questao_artigos (questao_id, artigo_id, origem)\n"
                    "values\n  " + valores +
                    # Vínculo verificado nunca é rebaixado por palpite.
                    "\non conflict (questao_id, artigo_id) do nothing;\n"
                ),
                capture_output=True,
                text=True,
            )
            if r.returncode != 0:
                print(f"    ✗ psql: {r.stderr[:300]}", file=sys.stderr)

        print(
            f"  {edicao}º · {bloco[0][0]}–{bloco[-1][0]}: {achados} vínculos "
            f"· total {len(pares)}",
            flush=True,
        )
        time.sleep(args.pausa)

    edicao_atual: int | None = None
    bloco: list[tuple[int, str]] = []
    for _, edicao, numero, texto in questoes:
        if edicao_atual is not None and (edicao != edicao_atual or len(bloco) >= LOTE):
            despachar(edicao_atual, bloco)
            bloco = []
        edicao_atual = edicao
        bloco.append((numero, texto))
    if edicao_atual is not None:
        despachar(edicao_atual, bloco)

    pares = list(dict.fromkeys(pares))
    print(
        f"\n{len(pares)} vínculos aceitos · "
        f"{inexistentes} descartados por não existirem no acervo"
    )
    if not pares:
        return 1

    valores = ",\n  ".join(
        f"({_lit(q)}::uuid, {_lit(a)}::uuid, 'modelo')" for q, a in pares
    )
    sql = (
        "insert into public.questao_artigos (questao_id, artigo_id, origem)\n"
        "values\n  " + valores +
        # Vínculo verificado nunca é rebaixado por palpite.
        "\non conflict (questao_id, artigo_id) do nothing;\n"
    )

    if args.sql:
        with open(args.sql, "w", encoding="utf-8") as f:
            f.write(sql)
        print(f"SQL em {args.sql}")

    if args.carregar:
        r = subprocess.run(
            ["psql", conexao, "-v", "ON_ERROR_STOP=1", "-q", "-f", "-"],
            input=sql, capture_output=True, text=True,
        )
        if r.returncode != 0:
            print(f"✗ psql falhou:\n{r.stderr[:600]}", file=sys.stderr)
            return 1
        print("✓ vínculos carregados")
    elif not args.sql:
        print("\n(ensaio — nada gravado. Repita com --carregar.)")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
