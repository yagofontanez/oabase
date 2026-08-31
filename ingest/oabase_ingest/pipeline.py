"""Orquestrador da ingestão de uma prova.

    python -m oabase_ingest.pipeline \
        --prova provas/43.pdf --gabarito provas/43-gabarito.pdf \
        --edicao 43 --ano 2025 --data 2025-04-27

Sem `--carregar`, roda em modo seco: extrai, parseia, valida e escreve o JSON
sem tocar no banco. É assim que se audita uma prova nova antes de publicar.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import unicodedata
import re
from pathlib import Path

from .classificar import classificar
from .carregar import QuestaoParaCarga, executar, sql_das_questoes, sql_do_exame
from .extrair import texto_em_ordem_de_leitura
from .gabarito import ler_gabarito
from .parsear import parsear_prova
from .sequenciar import Palpite, blocos, suavizar

# Abaixo disso a classificação é considerada incerta e vai para revisão
# humana em vez de entrar no banco como se fosse certeza.
CONFIANCA_MINIMA = 0.34


def _slugificar(texto: str) -> str:
    sem_acento = "".join(
        c for c in unicodedata.normalize("NFD", texto.lower())
        if unicodedata.category(c) != "Mn"
    )
    return re.sub(r"[^a-z0-9]+", "-", sem_acento).strip("-")


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Ingestão de uma prova da OAB")
    p.add_argument("--prova", type=Path, required=True)
    p.add_argument("--gabarito", type=Path, required=True)
    p.add_argument("--edicao", type=int, required=True)
    p.add_argument("--ano", type=int, required=True)
    p.add_argument("--data", required=True, help="data da prova, YYYY-MM-DD")
    p.add_argument("--tipo", type=int, default=1, help="tipo/cor do caderno")
    p.add_argument("--total", type=int, default=80)
    p.add_argument(
        "--gabarito-preliminar", action="store_true",
        help="o gabarito usado é o preliminar, não o definitivo",
    )
    p.add_argument("--saida", type=Path, default=Path("saida"))
    p.add_argument("--carregar", action="store_true", help="grava no Supabase")
    args = p.parse_args(argv)

    print(f"→ extraindo {args.prova.name} (2 colunas, ordem de leitura)")
    texto = texto_em_ordem_de_leitura(args.prova)

    print(f"→ segmentando {args.total} questões")
    questoes = parsear_prova(texto, total=args.total)

    print(f"→ lendo gabarito definitivo do tipo {args.tipo}")
    gabarito = ler_gabarito(args.gabarito, tipo=args.tipo)

    faltando = [q.numero for q in questoes if q.numero not in gabarito]
    if faltando:
        print(f"✗ sem gabarito para as questões {faltando}", file=sys.stderr)
        return 1

    # Validação por questão antes de qualquer escrita.
    problemas = {q.numero: q.problemas() for q in questoes}
    problemas = {n: p for n, p in problemas.items() if p}
    if problemas:
        print(f"\n✗ {len(problemas)} questões com problema de parsing:", file=sys.stderr)
        for numero, erros in list(problemas.items())[:10]:
            print(f"   Q{numero}: {'; '.join(erros)}", file=sys.stderr)
        return 1

    print("→ classificando por disciplina (léxico)")
    palpites: list[Palpite] = []
    for q in questoes:
        texto_completo = q.enunciado + " " + " ".join(q.alternativas.values())
        disciplina, confianca = classificar(texto_completo)
        if confianca < CONFIANCA_MINIMA:
            disciplina, confianca = None, 0.0
        palpites.append(Palpite(q.numero, disciplina, confianca))

    so_lexico = sum(1 for p in palpites if p.disciplina)
    print("→ corrigindo pela ordem em blocos da prova")
    palpites = suavizar(palpites)

    por_numero = {p.numero: p for p in palpites}
    registros: list[QuestaoParaCarga] = []
    incertas: list[int] = []
    for q in questoes:
        palpite = por_numero[q.numero]
        if not palpite.disciplina:
            incertas.append(q.numero)
        sufixo = f"-{palpite.disciplina}" if palpite.disciplina else ""
        registros.append(
            QuestaoParaCarga(
                numero=q.numero,
                enunciado=q.enunciado,
                alternativas=q.alternativas,
                gabarito=gabarito[q.numero],
                disciplina_slug=palpite.disciplina,
                slug=_slugificar(f"oab-{args.edicao}-questao-{q.numero}{sufixo}"),
            )
        )

    anuladas = [r.numero for r in registros if r.gabarito is None]

    args.saida.mkdir(parents=True, exist_ok=True)
    destino = args.saida / f"exame-{args.edicao}.json"
    destino.write_text(
        json.dumps(
            [
                {
                    "numero": r.numero,
                    "slug": r.slug,
                    "enunciado": r.enunciado,
                    "alternativas": r.alternativas,
                    "gabarito": r.gabarito,
                    "anulada": r.gabarito is None,
                    "disciplina": r.disciplina_slug,
                }
                for r in registros
            ],
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    classificadas = sum(1 for r in registros if r.disciplina_slug)
    corrigidas = sum(1 for p in palpites if p.origem != "lexico")
    print(f"\n── {args.edicao}º Exame ─────────────────────────")
    print(f"   questões parseadas   {len(registros)}/{args.total}")
    print(f"   anuladas             {len(anuladas)} {anuladas or ''}")
    print(f"   só pelo léxico       {so_lexico}/{len(registros)}")
    print(f"   após a sequência     {classificadas}/{len(registros)} (+{corrigidas} ajustes)")
    print(f"   revisão manual       {len(incertas)} {incertas[:12] or ''}")
    print(f"   gabarito             {'preliminar' if args.gabarito_preliminar else 'definitivo'}")
    print(f"   JSON                 {destino}")
    print("\n   blocos detectados:")
    for disciplina, ini, fim in blocos(palpites):
        faixa = f"{ini}" if ini == fim else f"{ini}–{fim}"
        print(f"     {faixa:>7}  {disciplina or '— sem classificação'}")

    if not args.carregar:
        print("\n(modo seco — nada foi gravado; use --carregar)")
        return 0

    conexao = os.environ.get("SUPABASE_CONNECTION_STRING")
    if not conexao:
        print("✗ defina SUPABASE_CONNECTION_STRING", file=sys.stderr)
        return 1

    print("\n→ gravando no Supabase (upsert idempotente)")
    executar(
        conexao,
        sql_do_exame(
            args.edicao, args.ano, args.data, args.total,
            gabarito_definitivo=not args.gabarito_preliminar,
            carregadas=len(registros),
            anuladas=len(anuladas),
        ),
    )
    executar(conexao, sql_das_questoes(args.edicao, registros))
    print("✓ carga concluída")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
