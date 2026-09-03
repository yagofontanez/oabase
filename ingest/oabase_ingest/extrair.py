"""PDF → texto em ordem de leitura.

O caderno de prova da FGV é diagramado em duas colunas. `pdftotext -layout`
sozinho entrelaça as colunas na mesma linha: o enunciado da questão 1 sai
grudado no da questão 3, e qualquer segmentação depois disso produz lixo
convincente — o pior tipo de erro, porque passa despercebido.

A solução é recortar cada coluna pela caixa de página e extrair uma de cada
vez, preservando a ordem de leitura real.
"""

from __future__ import annotations

import re
import subprocess
from pathlib import Path


class ErroDeExtracao(RuntimeError):
    pass


def _pdfinfo(pdf: Path) -> dict[str, str]:
    saida = subprocess.run(
        ["pdfinfo", str(pdf)], capture_output=True, text=True, check=True
    ).stdout
    dados = {}
    for linha in saida.splitlines():
        if ":" in linha:
            chave, valor = linha.split(":", 1)
            dados[chave.strip()] = valor.strip()
    return dados


def dimensoes(pdf: Path) -> tuple[int, int, int]:
    """Devolve (paginas, largura, altura) em pontos."""
    info = _pdfinfo(pdf)
    paginas = int(info["Pages"])
    m = re.search(r"([\d.]+)\s*x\s*([\d.]+)", info.get("Page size", ""))
    if not m:
        raise ErroDeExtracao(f"não consegui ler o tamanho da página de {pdf}")
    return paginas, int(float(m.group(1))), int(float(m.group(2)))


def _recorte(pdf: Path, pagina: int, x: int, largura: int, altura: int) -> str:
    return subprocess.run(
        [
            "pdftotext", "-layout",
            "-f", str(pagina), "-l", str(pagina),
            "-x", str(x), "-y", "0",
            "-W", str(largura), "-H", str(altura),
            str(pdf), "-",
        ],
        capture_output=True, text=True, check=True,
    ).stdout


def texto_em_ordem_de_leitura(
    pdf: Path, colunas: int = 2, ignorar: frozenset[int] = frozenset()
) -> str:
    """
    Extrai o PDF coluna a coluna, página a página.

    `ignorar` descarta páginas inteiras antes de qualquer segmentação. Existe
    por causa de um defeito real do arquivo de origem: no caderno do 35º
    Exame, seis páginas trazem fontes CID sem tabela de caracteres
    (`pdffonts` mostra `uni = no`), e o texto extraído delas é uma
    substituição consistente — sai lixo, e lixo que **parece** texto.

    Deixar esse lixo no fluxo é pior do que descartá-lo: ele não tem âncora
    de questão legível, então o bloco da questão anterior segue engolindo
    tudo até a próxima âncora válida, e o resultado é uma alternativa de uma
    questão boa terminando com meia página de símbolos. A página some inteira
    e as questões que estavam nela entram por remendo, conferidas contra a
    renderização do PDF oficial.
    """
    paginas, largura, altura = dimensoes(pdf)
    largura_coluna = largura // colunas

    partes: list[str] = []
    for pagina in range(1, paginas + 1):
        if pagina in ignorar:
            continue
        for coluna in range(colunas):
            partes.append(
                _recorte(pdf, pagina, coluna * largura_coluna, largura_coluna, altura)
            )
    return "\n".join(partes)


def texto_simples(pdf: Path) -> str:
    """Extração em coluna única — usada no gabarito, que é uma grade."""
    return subprocess.run(
        ["pdftotext", "-layout", str(pdf), "-"],
        capture_output=True, text=True, check=True,
    ).stdout
