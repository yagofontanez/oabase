"""Registra uma edição que ainda não foi aplicada.

Existe por causa de um dia só no calendário: o domingo da prova.

Quem acaba de sair do exame procura "gabarito 47 exame OAB" na mesma tarde, e
uma página criada nesse momento chega tarde — o buscador precisa já conhecer a
URL. Anunciar a edição antes cria `/exames/47` com o que se sabe de fonte
oficial (a data do edital) e a põe no sitemap; a ingestão de verdade acontece
depois, pelo `pipeline`, e o `on conflict` do mesmo SQL preenche o resto sem
criar linha nova nem mudar a URL.

O que **não** entra: total de questões inventado, distribuição estimada,
gabarito. A ficha do exame diz o que ainda não sabe — é o que a torna
confiável quando passar a saber.

    python3 -m oabase_ingest.anunciar --edicao 47 --data 2026-09-06
    python3 -m oabase_ingest.anunciar --edicao 47 --data 2026-09-06 --carregar
"""

from __future__ import annotations

import argparse
import os
import sys

from .carregar import _lit, executar


def sql_do_anuncio(edicao: int, ano: int, data: str, total: int) -> str:
    """Insere a edição, e **nunca** apaga o que a ingestão já escreveu.

    O `where` no fim é a diferença entre este SQL e o do `pipeline`: anunciar
    de novo uma edição já ingerida não pode zerar `questoes_carregadas` — e o
    dia em que alguém rodar isto por engano é justamente o dia da prova, com
    a página no ar e o tráfego chegando. `gabarito_definitivo = false` é a
    verdade no momento do anúncio: não existe gabarito nenhum ainda.
    """
    return (
        "insert into public.exames\n"
        "  (slug, edicao, ano, data_prova, total_questoes, gabarito_definitivo,\n"
        "   questoes_carregadas, questoes_anuladas)\n"
        f"values ({_lit(str(edicao))}, {edicao}, {ano}, {_lit(data)}, {total},"
        " false, 0, 0)\n"
        "on conflict (edicao) do update set\n"
        "  ano = excluded.ano,\n"
        "  data_prova = excluded.data_prova,\n"
        "  total_questoes = excluded.total_questoes\n"
        "where public.exames.questoes_carregadas = 0;\n"
    )


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--edicao", type=int, required=True)
    p.add_argument("--data", required=True, help="data da prova, YYYY-MM-DD")
    p.add_argument(
        "--total", type=int, default=80,
        help="questões previstas no edital (padrão 80)",
    )
    p.add_argument("--carregar", action="store_true", help="aplica no banco")
    args = p.parse_args(argv)

    ano = int(args.data.split("-")[0])
    sql = sql_do_anuncio(args.edicao, ano, args.data, args.total)

    if not args.carregar:
        print(sql)
        print("\n(ensaio — nada gravado. Repita com --carregar.)", file=sys.stderr)
        return 0

    conexao = os.environ.get("SUPABASE_CONNECTION_STRING")
    if not conexao:
        print("✗ defina SUPABASE_CONNECTION_STRING", file=sys.stderr)
        return 1

    executar(conexao, sql)
    print(f"✓ {args.edicao}º Exame anunciado para {args.data}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
