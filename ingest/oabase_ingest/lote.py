"""Ingestão em lote de todas as edições publicadas.

    python3 -m oabase_ingest.lote --manifesto          # descobre e mapeia
    python3 -m oabase_ingest.lote --de 40 --ate 47     # roda em modo seco
    python3 -m oabase_ingest.lote --de 40 --ate 47 --carregar

Cada edição é independente: uma que falhe no parsing não impede as outras.
O relatório final separa o que entrou do que precisa de atenção — provas
antigas usam diagramação diferente e é esperado que algumas não passem.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

from .descobrir import Edicao, baixar_arquivo, detalhar, listar_edicoes
from .pipeline import main as rodar_pipeline

CACHE = Path("provas")
MANIFESTO = Path("saida/manifesto.json")


def construir_manifesto(pausa: float = 0.7) -> list[Edicao]:
    edicoes = listar_edicoes()
    print(f"→ {len(edicoes)} edições no arquivo oficial")
    detalhadas = []
    for e in edicoes:
        detalhar(e, pausa=pausa)
        marca = "ok " if e.completa else "── "
        print(f"  {marca} {e.numero:>2}º  {e.data_prova or 'sem data':<11}"
              f" prova={'sim' if e.prova_url else 'não'}"
              f" gabarito={'sim' if e.gabarito_url else 'não'}")
        detalhadas.append(e)

    MANIFESTO.parent.mkdir(parents=True, exist_ok=True)
    MANIFESTO.write_text(
        json.dumps([e.__dict__ for e in detalhadas], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    completas = sum(1 for e in detalhadas if e.completa)
    print(f"\n   {completas}/{len(detalhadas)} com prova tipo 1 + gabarito definitivo")
    print(f"   manifesto: {MANIFESTO}")
    return detalhadas


def carregar_manifesto() -> list[Edicao]:
    if not MANIFESTO.exists():
        raise SystemExit("manifesto ausente — rode com --manifesto primeiro")
    return [Edicao(**d) for d in json.loads(MANIFESTO.read_text(encoding="utf-8"))]


def garantir_pdfs(e: Edicao, pausa: float = 3.0) -> tuple[Path, Path]:
    """Baixa prova e gabarito, com espaço entre os dois.

    O servidor da OAB passa a devolver 502 depois de algumas dezenas de
    arquivos em sequência. Não é bloqueio, é limitação de banda — o custo de
    ir devagar é minutos, o de ir rápido é perder metade do arquivo.
    """
    CACHE.mkdir(parents=True, exist_ok=True)
    prova = CACHE / f"exame-{e.numero:02d}-prova.pdf"
    gabarito = CACHE / f"exame-{e.numero:02d}-gabarito.pdf"
    for url, destino in ((e.prova_url, prova), (e.gabarito_url, gabarito)):
        if destino.exists():
            continue
        baixar_arquivo(url, destino)  # type: ignore[arg-type]
        time.sleep(pausa)
    return prova, gabarito


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Ingestão em lote das provas da OAB")
    p.add_argument("--manifesto", action="store_true", help="apenas descobrir e mapear")
    p.add_argument("--de", type=int, default=1)
    p.add_argument("--ate", type=int, default=99)
    p.add_argument("--carregar", action="store_true")
    p.add_argument("--pausa", type=float, default=0.7)
    args = p.parse_args(argv)

    if args.manifesto:
        construir_manifesto(pausa=args.pausa)
        return 0

    edicoes = [
        e for e in carregar_manifesto()
        if e.completa and args.de <= e.numero <= args.ate
    ]
    if not edicoes:
        print("nenhuma edição completa na faixa pedida", file=sys.stderr)
        return 1

    ok: list[int] = []
    falhas: dict[int, str] = {}

    for e in sorted(edicoes, key=lambda x: x.numero, reverse=True):
        print(f"\n{'═' * 58}\n{e.numero}º Exame · {e.data_prova}\n{'═' * 58}")
        try:
            prova, gabarito = garantir_pdfs(e)
        except Exception as erro:  # rede é falível; não derruba o lote
            falhas[e.numero] = f"download: {erro}"
            print(f"✗ download falhou: {erro}", file=sys.stderr)
            continue

        argumentos = [
            "--prova", str(prova), "--gabarito", str(gabarito),
            "--edicao", str(e.numero), "--ano", e.data_prova[:4],  # type: ignore[index]
            "--data", e.data_prova,  # type: ignore[arg-type]
        ]
        if not e.gabarito_definitivo:
            argumentos.append("--gabarito-preliminar")
        if args.carregar:
            argumentos.append("--carregar")

        try:
            codigo = rodar_pipeline(argumentos)
        except Exception as erro:
            codigo, erro_txt = 1, str(erro)
        else:
            erro_txt = "parsing ou validação"

        (ok.append(e.numero) if codigo == 0 else falhas.update({e.numero: erro_txt}))

    print(f"\n{'═' * 58}\nRESUMO\n{'═' * 58}")
    print(f"  ingeridas   {len(ok)}: {sorted(ok, reverse=True)}")
    if falhas:
        print(f"  pendentes   {len(falhas)}:")
        for numero in sorted(falhas, reverse=True):
            print(f"    {numero:>2}º — {falhas[numero][:90]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
