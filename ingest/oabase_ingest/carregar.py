"""Questões estruturadas → Supabase, de forma idempotente.

O upsert bate na chave natural `(exame_id, numero)`: o pipeline pode rodar
dezenas de vezes sem duplicar nada. O `slug` é o único campo deliberadamente
**não** atualizado no conflito — uma reclassificação de disciplina não pode
mudar a URL de uma página que já está indexada.
"""

from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass


@dataclass
class QuestaoParaCarga:
    numero: int
    enunciado: str
    alternativas: dict[str, str]
    gabarito: str | None
    disciplina_slug: str | None
    slug: str


def _lit(valor: str | None) -> str:
    """Literal SQL. `standard_conforming_strings` está ligado, então basta
    dobrar as aspas simples — barra invertida não é escape."""
    if valor is None:
        return "null"
    return "'" + valor.replace("'", "''") + "'"


def sql_do_exame(
    edicao: int,
    ano: int,
    data_prova: str,
    total: int,
    gabarito_definitivo: bool,
    carregadas: int = 0,
    anuladas: int = 0,
) -> str:
    return (
        "insert into public.exames\n"
        "  (slug, edicao, ano, data_prova, total_questoes, gabarito_definitivo,\n"
        "   questoes_carregadas, questoes_anuladas)\n"
        f"values ({_lit(str(edicao))}, {edicao}, {ano}, {_lit(data_prova)}, {total},"
        f" {str(gabarito_definitivo).lower()}, {carregadas}, {anuladas})\n"
        "on conflict (edicao) do update set\n"
        "  ano = excluded.ano,\n"
        "  data_prova = excluded.data_prova,\n"
        "  total_questoes = excluded.total_questoes,\n"
        "  gabarito_definitivo = excluded.gabarito_definitivo,\n"
        "  questoes_carregadas = excluded.questoes_carregadas,\n"
        "  questoes_anuladas = excluded.questoes_anuladas;\n"
    )


def sql_das_questoes(edicao: int, questoes: list[QuestaoParaCarga]) -> str:
    linhas = []
    for q in questoes:
        disciplina = (
            f"(select id from public.disciplinas where slug = {_lit(q.disciplina_slug)})"
            if q.disciplina_slug
            else "null"
        )
        linhas.append(
            "  ("
            f"(select id from public.exames where edicao = {edicao}), "
            f"{q.numero}, "
            f"{_lit(q.slug)}, "
            f"{_lit(q.enunciado)}, "
            f"{_lit(json.dumps(q.alternativas, ensure_ascii=False))}::jsonb, "
            f"{_lit(q.gabarito)}, "
            f"{'true' if q.gabarito is None else 'false'}, "
            f"{disciplina}"
            ")"
        )

    return (
        "insert into public.questoes\n"
        "  (exame_id, numero, slug, enunciado, alternativas, gabarito, anulada, disciplina_id)\n"
        "values\n" + ",\n".join(linhas) + "\n"
        "on conflict (exame_id, numero) do update set\n"
        "  enunciado = excluded.enunciado,\n"
        "  alternativas = excluded.alternativas,\n"
        "  gabarito = excluded.gabarito,\n"
        "  anulada = excluded.anulada,\n"
        # A classificação do pipeline é a do léxico com a suavização por
        # bloco: um palpite. Ela não pode passar por cima de trabalho melhor
        # que já esteja na linha.
        #
        # Antes escrevia `excluded.disciplina_id` sem condição, e isso fazia
        # de recarregar uma prova um ato destrutivo: as 440 questões
        # classificadas pelo modelo voltariam ao palpite léxico, e
        # `classificacao_origem` continuaria dizendo 'modelo' — procedência
        # mentindo, que é pior do que classificação faltando. Reingestão é
        # rotina (gabarito preliminar vira definitivo, parser melhora), e uma
        # rotina não pode apagar o que custou horas de API.
        "  disciplina_id = case\n"
        "    when public.questoes.disciplina_confirmada then public.questoes.disciplina_id\n"
        "    when public.questoes.classificacao_origem in ('modelo', 'humano')\n"
        "      then public.questoes.disciplina_id\n"
        "    else excluded.disciplina_id\n"
        "  end;\n"
        "-- `slug` fica de fora de propósito: reclassificar disciplina não pode\n"
        "-- trocar a URL de uma página já indexada.\n"
    )


def executar(conexao: str, sql: str) -> None:
    resultado = subprocess.run(
        ["psql", conexao, "-v", "ON_ERROR_STOP=1", "-q", "-f", "-"],
        input=sql, capture_output=True, text=True,
    )
    if resultado.returncode != 0:
        raise RuntimeError(f"psql falhou:\n{resultado.stderr.strip()[:800]}")
