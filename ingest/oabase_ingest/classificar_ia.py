"""Classificação de questão em disciplina por modelo de linguagem.

O léxico de `classificar.py` é auditável e erra de forma previsível — e deixa
709 das 3.460 questões sem disciplina nenhuma, além de acertar por termo solto
em muitas outras. Revisar 3.460 à mão é trabalho de meses, e o produto precisa
do número agora.

O que este módulo **não** faz: marcar `disciplina_confirmada`. Essa coluna
significa "alguém leu", e virá-la por script faria o site publicar estimativa
como medição. O que ele escreve é `classificacao_origem = 'modelo'`, e quem
consome decide o que aceita.

Quatro decisões que separam classificar de chutar:

1. **A resposta é fechada.** O modelo escolhe entre os dezoito slugs do
   edital; qualquer coisa fora da lista é descartada — não vira disciplina
   nova nem sumiço silencioso.
2. **Em bloco, com o número da questão**, e a resposta é conferida item a item
   pelo número. Modelo que devolve dezenove itens não desalinha a base.
3. **A prova é lida em ordem, uma edição por lote.** A FGV monta o caderno em
   blocos contíguos por disciplina; mandar na ordem do caderno dá ao modelo o
   mesmo contexto que `sequenciar.py` usa, de graça.
4. **Grava a cada lote.** A conta gratuita da Groq dá 8.000 tokens por
   minuto, o que põe a base inteira em algumas horas. Acumular tudo para
   gravar no fim significa perder tudo em qualquer interrupção — e uma
   execução de horas *vai* ser interrompida. Assim, repetir o comando
   continua de onde parou: a consulta só traz quem ainda não é `'modelo'`.

    python3 -m oabase_ingest.classificar_ia --exame 46 --carregar
    python3 -m oabase_ingest.classificar_ia --carregar
"""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
import time

from .groq import conversar

LOTE = 20

INSTRUCAO = """Você classifica questões da 1ª fase do Exame de Ordem (OAB/FGV) \
na disciplina do conteúdo programático.

Responda SOMENTE com JSON: {"itens": [{"n": <número da questão>, "d": "<slug>"}]}

Slugs permitidos, e nenhum outro:
%s

Regras:
- Uma disciplina por questão, a principal.
- Questão de processo vai para a disciplina processual correspondente.
- Ética e Estatuto da OAB cobre honorários, prerrogativas, impedimento, \
sociedade de advogados e infração disciplinar.
- Não invente slug. Se não souber, escolha o mais provável da lista."""


def psql(sql: str, conexao: str) -> str:
    r = subprocess.run(
        ["psql", conexao, "-tAF\x1f", "-v", "ON_ERROR_STOP=1", "-c", sql],
        capture_output=True, text=True,
    )
    if r.returncode != 0:
        raise SystemExit(f"psql falhou:\n{r.stderr[:600]}")
    return r.stdout


def executar(sql: str, conexao: str) -> bool:
    r = subprocess.run(
        ["psql", conexao, "-v", "ON_ERROR_STOP=1", "-q", "-f", "-"],
        input=sql, capture_output=True, text=True,
    )
    if r.returncode != 0:
        print(f"    ✗ psql: {r.stderr[:300]}", file=sys.stderr)
        return False
    return True


def _lit(v: str) -> str:
    return "'" + v.replace("'", "''") + "'"


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--exame", type=int, help="uma edição só")
    p.add_argument("--carregar", action="store_true")
    p.add_argument("--pausa", type=float, default=1.0)
    args = p.parse_args(argv)

    conexao = os.environ.get("SUPABASE_CONNECTION_STRING")
    chave = os.environ.get("GROQ_API_KEY")
    if not conexao or not chave:
        print("✗ defina SUPABASE_CONNECTION_STRING e GROQ_API_KEY", file=sys.stderr)
        return 1

    disciplinas = [
        l for l in psql(
            "select slug from public.disciplinas order by slug", conexao
        ).strip().split("\n") if l
    ]
    sistema = INSTRUCAO % "\n".join(disciplinas)
    validos = set(disciplinas)

    filtro = f"and e.edicao = {args.exame}" if args.exame else ""
    # Só o enunciado, e cortado: as alternativas dobram o tamanho do lote e
    # quase nunca mudam a disciplina — e o que limita aqui é token por minuto.
    linhas = psql(
        "select q.id, e.edicao, q.numero, left(q.enunciado, 600) "
        "from public.questoes q join public.exames e on e.id = q.exame_id "
        "where q.classificacao_origem not in ('humano', 'modelo') "
        f"  {filtro} "
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
        print("nada a classificar — tudo já passou pelo modelo")
        return 0

    print(f"→ {len(questoes)} questões, em lotes de {LOTE}", flush=True)
    por_chave = {(e, n): qid for qid, e, n, _ in questoes}
    total = 0

    def despachar(edicao: int, bloco: list[tuple[int, str]]) -> None:
        nonlocal total
        if not bloco:
            return
        resposta = conversar(
            chave,
            sistema,
            "\n\n".join(f"Questão {n}: {t}" for n, t in bloco),
        )
        atribuicoes = [
            (por_chave[(edicao, int(i["n"]))], i["d"])
            for i in resposta.get("itens", [])
            if isinstance(i, dict)
            and i.get("d") in validos
            and (edicao, int(i.get("n", -1))) in por_chave
        ]

        if atribuicoes and args.carregar:
            sql = "\n".join(
                "update public.questoes set disciplina_id = "
                f"(select id from public.disciplinas where slug = {_lit(slug)}), "
                "classificacao_origem = 'modelo', atualizado_em = now() "
                # Revisão humana nunca é sobrescrita por script.
                f"where id = {_lit(qid)}::uuid and not disciplina_confirmada;"
                for qid, slug in atribuicoes
            )
            if not executar(sql, conexao):
                return

        total += len(atribuicoes)
        print(
            f"  {edicao}º · {bloco[0][0]}–{bloco[-1][0]}: "
            f"{len(atribuicoes)}/{len(bloco)} · total {total}",
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

    print(f"\n{total} de {len(questoes)} classificadas por modelo")
    if not args.carregar:
        print("(ensaio — nada gravado. Repita com --carregar.)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
