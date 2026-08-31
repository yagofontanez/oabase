"""PDF do gabarito definitivo → {número da questão: alternativa ou None}.

O arquivo traz os quatro tipos de prova (1 a 4) em seções, cada uma como uma
grade de linhas alternadas: uma linha de números, a linha de respostas logo
abaixo. `*` marca questão anulada — que sai dos simulados mas continua
valendo como conteúdo, então vira `None` e não um erro.
"""

from __future__ import annotations

import re
from pathlib import Path

from .extrair import texto_simples

# O rótulo do tipo mudou de forma ao longo das edições:
#   "43º EXAME DE ORDEM - PROVA TIPO 1"
#   "40º EXAME DE ORDEM UNIFICADO - TIPO 1"
# Exigir "EXAME" na mesma linha cobre as duas e ainda descarta a tabela de
# conversão do fim do arquivo, que traz "TIPO 1 TIPO 2 TIPO 3 TIPO 4" solto.
TIPO_NA_LINHA = re.compile(r"(?:TIPO|PROVA)\s+(\d)", re.IGNORECASE)


def _tipo_do_cabecalho(linha: str) -> int | None:
    """O rótulo do tipo mudou de forma entre as edições:

        "43º EXAME DE ORDEM - PROVA TIPO 1"
        "40º EXAME DE ORDEM UNIFICADO - TIPO 1"
        "XXXIX EXAME DE ORDEM UNIFICADO - PROVA 1"
        "PROVA TIPO 1"

    O que as três têm em comum e a tabela de conversão do fim do arquivo
    não tem é ocorrer **uma única vez** na linha — lá aparece
    "TIPO 1 TIPO 2 TIPO 3 TIPO 4" de uma vez só.
    """
    achados = TIPO_NA_LINHA.findall(linha)
    return int(achados[0]) if len(achados) == 1 else None
LINHA_NUMEROS = re.compile(r"^\s*\d+(\s+\d+)+\s*$")
LINHA_RESPOSTAS = re.compile(r"^\s*[A-D*](\s+[A-D*])+\s*$")


class ErroDeGabarito(RuntimeError):
    pass


def ler_gabarito(pdf: Path, tipo: int = 1) -> dict[int, str | None]:
    linhas = texto_simples(pdf).splitlines()

    # Isola a seção do tipo pedido: da sua âncora até o próximo cabeçalho.
    inicio = fim = None
    for i, linha in enumerate(linhas):
        encontrado = _tipo_do_cabecalho(linha)
        if encontrado is None:
            continue
        if encontrado == tipo and inicio is None:
            inicio = i + 1
        elif inicio is not None:
            fim = i
            break
    if inicio is None:
        raise ErroDeGabarito(f"não encontrei a seção do tipo {tipo} em {pdf.name}")

    trecho = linhas[inicio : fim if fim is not None else len(linhas)]

    gabarito: dict[int, str | None] = {}
    for i, linha in enumerate(trecho):
        if not LINHA_NUMEROS.match(linha):
            continue
        # A linha de respostas é a próxima linha não vazia.
        resposta = next(
            (
                trecho[j]
                for j in range(i + 1, min(i + 4, len(trecho)))
                if trecho[j].strip()
            ),
            "",
        )
        if not LINHA_RESPOSTAS.match(resposta):
            continue

        numeros = [int(n) for n in linha.split()]
        letras = resposta.split()
        if len(numeros) != len(letras):
            raise ErroDeGabarito(
                f"grade desalinhada: {len(numeros)} números para {len(letras)} respostas"
            )
        for numero, letra in zip(numeros, letras):
            gabarito[numero] = None if letra == "*" else letra

    if not gabarito:
        raise ErroDeGabarito(f"nenhuma resposta lida do tipo {tipo}")
    return gabarito
