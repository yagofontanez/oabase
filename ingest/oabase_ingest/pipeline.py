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
from dataclasses import dataclass
from pathlib import Path

from .classificar import classificar
from .carregar import QuestaoParaCarga, executar, sql_das_questoes, sql_do_exame
from .extrair import texto_em_ordem_de_leitura
from .gabarito import ler_gabarito
from .parsear import Questao, parsear_prova
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


@dataclass
class Remendo:
    """
    Questões transcritas à mão porque o PDF oficial não as entrega.

    **Não é um atalho para prova difícil de parsear.** É a saída para um
    defeito do arquivo de origem: páginas cujas fontes CID vieram sem tabela
    de caracteres, em que `pdftotext` devolve uma substituição consistente —
    lixo com aparência de texto. A página renderiza perfeitamente, o que
    significa que o conteúdo está lá e só a decodificação está quebrada.

    A transcrição é feita contra a renderização do **mesmo PDF oficial**, e
    não contra terceiro: continua sendo ato oficial, que é o critério do que
    pode virar conteúdo aqui. O que muda é o risco — de extração para
    digitação —, e por isso o arquivo registra página, motivo e data.
    """

    paginas: frozenset[int]
    questoes: dict[int, "Questao"]
    motivo: str


def _ler_remendo(caminho: Path) -> Remendo:
    dados = json.loads(caminho.read_text(encoding="utf-8"))
    questoes = {
        int(q["numero"]): Questao(
            numero=int(q["numero"]),
            enunciado=q["enunciado"],
            alternativas=q["alternativas"],
        )
        for q in dados["questoes"]
    }
    return Remendo(
        paginas=frozenset(dados["paginas_ilegiveis"]),
        questoes=questoes,
        motivo=dados["motivo"],
    )


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Ingestão de uma prova da OAB")
    p.add_argument("--prova", type=Path, required=True)
    p.add_argument("--gabarito", type=Path, required=True)
    p.add_argument("--edicao", type=int, required=True)
    p.add_argument("--ano", type=int, required=True)
    p.add_argument("--data", required=True, help="data da prova, YYYY-MM-DD")
    p.add_argument("--tipo", type=int, default=1, help="tipo/cor do caderno")
    p.add_argument(
        "--total", type=int, default=None,
        help="questões da prova; por padrão vem do gabarito",
    )
    p.add_argument(
        "--gabarito-preliminar", action="store_true",
        help="o gabarito usado é o preliminar, não o definitivo",
    )
    p.add_argument("--saida", type=Path, default=Path("saida"))
    p.add_argument(
        "--remendo", type=Path, default=None,
        help="JSON com questões de páginas ilegíveis no PDF de origem",
    )
    p.add_argument("--carregar", action="store_true", help="grava no Supabase")
    args = p.parse_args(argv)

    remendo = _ler_remendo(args.remendo) if args.remendo else None
    ignorar = frozenset(remendo.paginas) if remendo else frozenset()
    if remendo:
        print(
            f"→ remendo: {len(remendo.questoes)} questões das páginas "
            f"{sorted(remendo.paginas)}, ilegíveis no PDF de origem"
        )
        print(f"  motivo: {remendo.motivo}")

    print(f"→ extraindo {args.prova.name} (2 colunas, ordem de leitura)")
    texto = texto_em_ordem_de_leitura(args.prova, ignorar=ignorar)

    # O gabarito é lido antes de segmentar porque é ele que diz quantas
    # questões a prova tem. O padrão era 80 fixo, e os primeiros exames
    # unificados tiveram 100 — o 3º entrava com as vinte últimas
    # descartadas, sem erro nenhum, porque parar em 80 é exatamente o que o
    # parser fora mandado fazer. Número de origem oficial, não suposto.
    print(f"→ lendo gabarito definitivo do tipo {args.tipo}")
    gabarito = ler_gabarito(args.gabarito, tipo=args.tipo)

    total = args.total or max(gabarito)
    print(f"→ segmentando {total} questões")
    supridas = frozenset(remendo.questoes) if remendo else frozenset()
    questoes = parsear_prova(texto, total=total, supridas=supridas)

    # O remendo **preenche**, nunca sobrescreve. Se o parser conseguiu ler a
    # questão do PDF, é a leitura do PDF que vale: transcrição humana é o
    # último recurso, e um remendo que pudesse sobrepor extração viraria a
    # porta por onde texto conferido é trocado por texto digitado à mão sem
    # ninguém perceber.
    if remendo:
        lidas = {q.numero for q in questoes}
        colisao = sorted(lidas & set(remendo.questoes))
        if colisao:
            print(
                f"✗ o remendo tenta substituir questões que o parser leu: {colisao}",
                file=sys.stderr,
            )
            return 1
        questoes.extend(remendo.questoes.values())
        questoes.sort(key=lambda q: q.numero)

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
    print(f"   questões parseadas   {len(registros)}/{total}")
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
            args.edicao, args.ano, args.data, total,
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
