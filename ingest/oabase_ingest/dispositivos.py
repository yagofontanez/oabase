"""Vínculo entre questão e artigo de lei, a partir de citação no texto.

Por que regex e não modelo: o vínculo aqui é **verificável relendo a questão**
— ou o texto diz "art. 133 da CF/88" ou não diz. Um modelo acertaria mais
casos e erraria de forma invisível, e `artigos.incidencia` é justamente o
número que não pode ser palpite: ele ordena o que estudar primeiro.

O que este módulo NÃO faz, de propósito: adivinhar o artigo de uma questão que
não cita nenhum. A prova da FGV narra um caso e pede a alternativa correta;
**só 133 das 3.460 questões carregadas citam artigo** — 155 vínculos, em 106
artigos. As outras 3.327 ficam sem vínculo até alguém escrever o comentário —
e é assim que tem de ser, ou a incidência volta a ser ficção com cara de
medição. A proporção não melhora com mais edições: era 61 em 1.120 e é 133 em
3.460, praticamente o mesmo 4%.

Uso:
    python3 -m oabase_ingest.dispositivos --sql /tmp/v.sql   # ensaio
    python3 -m oabase_ingest.dispositivos --carregar
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
import unicodedata

# ---------------------------------------------------------------------------
# Leis reconhecidas
#
# A ordem importa: apelidos longos são testados antes dos curtos, senão "CF"
# casaria dentro de "CF/88" e "CC" dentro de "CCB". As siglas de duas letras
# são exigidas em maiúsculas no texto original — "cc" minúsculo aparece como
# preposição ("c/c") e como sílaba, e casaria em toda questão.
# ---------------------------------------------------------------------------
APELIDOS: list[tuple[str, tuple[str, ...], tuple[str, ...]]] = [
    # (slug, apelidos sem acento e minúsculos, siglas exigidas em maiúsculas)
    (
        "constituicao-federal",
        (
            "constituicao da republica federativa do brasil",
            "constituicao da republica",
            "constituicao federal",
            "carta magna",
            "crfb/88",
            "crfb",
            "cf/88",
        ),
        ("CF", "CRFB"),
    ),
    (
        "estatuto-da-oab",
        (
            "estatuto da advocacia e da oab",
            "estatuto da advocacia",
            "estatuto da oab",
            "lei n 8.906",
            "lei 8.906",
            "lei no 8.906",
        ),
        ("EAOAB",),
    ),
    (
        "codigo-de-defesa-do-consumidor",
        ("codigo de defesa do consumidor", "lei 8.078", "lei n 8.078"),
        ("CDC",),
    ),
    (
        "codigo-de-processo-civil",
        ("codigo de processo civil", "cpc/15", "cpc/2015"),
        ("CPC",),
    ),
    (
        "codigo-de-processo-penal",
        ("codigo de processo penal",),
        ("CPP",),
    ),
    (
        "clt",
        ("consolidacao das leis do trabalho",),
        ("CLT",),
    ),
    (
        "codigo-civil",
        ("codigo civil", "cc/02", "cc/2002"),
        ("CC", "CCB"),
    ),
    (
        "codigo-penal",
        ("codigo penal",),
        ("CP",),
    ),
]

# Um número de artigo: "133", "1.015", "5º", "29-A".
_UM = r"\d{1,4}(?:\.\d{3})*\s*[ºo°]?(?:\s*-\s*[A-Z])?"

# "art. 5º", "arts. 20, 21 e 22", "artigo 133", "Art. 1.015".
#
# O bloco de números **para** no primeiro caractere que não pode fazer parte
# de uma lista de artigos. A versão anterior aceitava letras livremente e
# engolia o resto da frase: em "Art. 5º da Constituição Federal de 1988" ela
# extraía o artigo 5 e também um artigo "1988".
CITACAO = re.compile(
    rf"\b(?:art|arts|artigo|artigos)\s*\.?\s*"
    rf"(?P<numeros>{_UM}(?:\s*(?:,|e)\s*{_UM})*)",
    re.IGNORECASE,
)

NUMERO = re.compile(rf"({_UM})", re.IGNORECASE)


def numero_canonico(valor: str) -> str:
    """Forma comparável de um número de artigo.

    A numeração vinda do Planalto não é uniforme: na Constituição, o art. 5º
    está gravado como `5º` e os vizinhos como `6`, `7`. Em vez de reescrever
    texto de lei — que é o que a página exibe — a comparação normaliza os dois
    lados: tira ponto de milhar, marca de ordinal e espaço.
    """
    texto = valor.strip().upper().replace(".", "").replace(" ", "")
    texto = re.sub(r"[º°]", "", texto)
    texto = re.sub(r"(?<=\d)O$", "", texto)
    return texto

# Quanto texto depois da citação ainda conta como "a lei desta citação".
JANELA = 110


def sem_acento(texto: str) -> str:
    return "".join(
        c
        for c in unicodedata.normalize("NFD", texto)
        if unicodedata.category(c) != "Mn"
    )


def lei_da_janela(trecho: str) -> str | None:
    """Qual lei o trecho logo após a citação nomeia, se nomear alguma."""
    normalizado = sem_acento(trecho).lower()
    melhor: tuple[int, str] | None = None

    for slug, apelidos, siglas in APELIDOS:
        for apelido in apelidos:
            posicao = normalizado.find(apelido)
            if posicao >= 0 and (melhor is None or posicao < melhor[0]):
                melhor = (posicao, slug)
        for sigla in siglas:
            # No texto original: sigla de duas ou três letras só vale em caixa
            # alta, com fronteira de palavra dos dois lados.
            achado = re.search(rf"\b{sigla}\b", trecho)
            if achado and (melhor is None or achado.start() < melhor[0]):
                melhor = (achado.start(), slug)

    return melhor[1] if melhor else None


def numeros_do_bloco(bloco: str) -> list[str]:
    """Números de artigo citados em sequência ("arts. 20, 21 e 22")."""
    achados: list[str] = []
    for bruto in NUMERO.findall(bloco):
        numero = numero_canonico(bruto)
        if numero and numero not in achados:
            achados.append(numero)
    return achados


def citacoes(texto: str) -> list[tuple[str, str]]:
    """Pares (lei_slug, numero_do_artigo) citados no texto."""
    encontrados: list[tuple[str, str]] = []

    for achado in CITACAO.finditer(texto):
        bloco = achado.group("numeros")
        janela = texto[achado.end() : achado.end() + JANELA]
        # A lei pode estar dentro do próprio bloco ("art. 5º da CF/88, ...").
        slug = lei_da_janela(bloco + " " + janela)
        if not slug:
            continue
        for numero in numeros_do_bloco(bloco):
            par = (slug, numero)
            if par not in encontrados:
                encontrados.append(par)

    return encontrados


# ---------------------------------------------------------------------------
# Banco
# ---------------------------------------------------------------------------


def psql(sql: str, conexao: str) -> str:
    resultado = subprocess.run(
        ["psql", conexao, "-tAF\x1f", "-v", "ON_ERROR_STOP=1", "-c", sql],
        capture_output=True,
        text=True,
    )
    if resultado.returncode != 0:
        raise SystemExit(f"psql falhou:\n{resultado.stderr}")
    return resultado.stdout


def lit(valor: str) -> str:
    return "'" + valor.replace("'", "''") + "'"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--conexao", default=None, help="string de conexão do psql")
    parser.add_argument("--sql", help="grava o SQL neste caminho em vez de aplicar")
    parser.add_argument("--carregar", action="store_true", help="aplica no banco")
    argumentos = parser.parse_args()

    import os

    conexao = argumentos.conexao or os.environ.get("SUPABASE_CONNECTION_STRING")
    if not conexao:
        raise SystemExit("Defina SUPABASE_CONNECTION_STRING ou passe --conexao.")

    # Índice dos artigos: (lei_slug, numero) -> id.
    linhas = psql(
        "select l.slug, a.numero, a.id from public.artigos a "
        "join public.leis l on l.id = a.lei_id",
        conexao,
    )
    indice: dict[tuple[str, str], str] = {}
    for linha in linhas.strip().split("\n"):
        if not linha:
            continue
        slug, numero, artigo_id = linha.split("\x1f")
        indice[(slug, numero_canonico(numero))] = artigo_id

    questoes = psql(
        "select q.id, q.enunciado || ' ' || q.alternativas::text "
        "from public.questoes q",
        conexao,
    )

    pares: list[tuple[str, str]] = []
    sem_lei = 0
    citadas = 0

    for linha in questoes.strip().split("\n"):
        if not linha:
            continue
        questao_id, texto = linha.split("\x1f", 1)
        achados = citacoes(texto)
        if achados:
            citadas += 1
        for slug, numero in achados:
            artigo_id = indice.get((slug, numero))
            if artigo_id:
                pares.append((questao_id, artigo_id))
            else:
                sem_lei += 1

    pares = list(dict.fromkeys(pares))

    print(
        f"{citadas} questões citam artigo com lei identificada · "
        f"{len(pares)} vínculos · {sem_lei} citações sem artigo correspondente",
        file=sys.stderr,
    )

    if not pares:
        return 0

    valores = ",\n  ".join(
        f"({lit(q)}::uuid, {lit(a)}::uuid, 'citacao')" for q, a in pares
    )
    sql = (
        "insert into public.questao_artigos (questao_id, artigo_id, origem)\nvalues\n  "
        + valores
        # Vínculo humano nunca é sobrescrito por releitura do texto: quem
        # revisou sabe mais do que a expressão regular.
        + "\non conflict (questao_id, artigo_id) do nothing;\n"
    )

    if argumentos.sql:
        with open(argumentos.sql, "w", encoding="utf-8") as arquivo:
            arquivo.write(sql)
        print(f"SQL gravado em {argumentos.sql}", file=sys.stderr)

    if argumentos.carregar:
        psql(sql, conexao)
        print("vínculos carregados", file=sys.stderr)
    elif not argumentos.sql:
        print(sql)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
