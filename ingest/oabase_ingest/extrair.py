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


# Rodapé de página, para ser removido **na cauda de cada coluna** e em lugar
# nenhum mais.
#
# Casar estes trechos no texto inteiro seria perigoso: "Exame de Ordem"
# aparece dentro de questão de Ética, e "tipo" dentro de questão de Penal.
# Na última linha de uma coluna, não: ali só existe rodapé.
#
# O padrão é largo de propósito porque o recorte por coluna **corta o rodapé
# no meio da palavra** — o mesmo rodapé sai como "UNIFICADO", "NIFICADO",
# "IFICADO", "PROVA APLICADA" e "PROVA APLICAD" em provas diferentes.
# Tentar enumerar as formas foi o erro que deixou 1.313 alternativas sujas
# depois de um conserto que parecia ter funcionado: a lista de variantes de
# um texto truncado arbitrariamente não fecha.
#
# **As fronteiras de palavra não são zelo, são correção.** Sem elas,
# `IFICADO` casa dentro de "qualificado" — e a alternativa "D) furto
# qualificado e cárcere privado." sumiu inteira da questão 63 do 25º Exame.
# O parser recusou a prova, que é o comportamento certo e o que fez o erro
# aparecer em dez minutos em vez de ficar no acervo.
# **"EXAME DE ORDEM" e "Conselho Federal" ficam de fora**, embora estejam em
# todo rodapé: eles também estão dentro de questão de Ética, que fala do
# exame e do Conselho o tempo todo. Um marcador que aparece nos dois lados
# não separa nada.
#
# Os que sobraram são muito mais raros em conteúdo, mas **não são exclusivos
# de rodapé**: o enunciado da questão 4 do 40º Exame diz "aprovação no Exame
# de Ordem Unificado". Ele sobrevive porque a poda só olha o topo e o pé da
# coluna, e ele está no meio — mas a mesma frase caindo na borda seria
# comida. Daí o limite de comprimento em `_e_linha_de_rodape`: rodapé é
# fragmento curto, linha de questão ocupa a largura da coluna.
_RODAPE = re.compile(
    r"\b(?:UN|N)?IFICADO\b"
    r"|PROVA APLICAD"
    r"|\bP[ÁA]GINA\s*\d"
    r"|\bTIPO\s*0?\d"
    r"|\bTipo\s+(?:Branca|Amarela|Azul|Verde|Rosa|Cinza)\b",
    re.IGNORECASE,
)

# Número de página solto, com ou sem travessão. Não é "50%." nem "1992." —
# a exigência de não haver letra nem sinal de porcentagem é o que separa os
# dois, e ela vale só na cauda.
_NUMERO_DE_PAGINA = re.compile(r"^[\s\-–—]*\d{1,3}[\s\-–—]*$")

# Glifo que não decodificou. Aparece no rodapé de algumas edições como
# caractere de uso privado (U+F020 e vizinhos).
_SO_ILEGIVEL = re.compile(r"^[\s-\x00-\x1f]*$")


# Rodapé é fragmento; linha de questão ocupa a largura da coluna. O mais
# longo medido nas 44 provas tem 47 caracteres
# ("XXXV EXAME DE ORDEM UNIFICADO – TIPO 1 – BRANCA"); linha de conteúdo na
# borda da coluna passa de 55. O limite é a segunda trava, e existe porque a
# primeira — o marcador — não é exclusiva de rodapé.
_MAX_RODAPE = 60


def _e_linha_de_rodape(linha: str) -> bool:
    return len(linha.strip()) <= _MAX_RODAPE and bool(_RODAPE.search(linha))


# Quantas linhas do fim da coluna são examinadas. O rodapé mais alto medido
# nas 44 provas ocupa quatro linhas somando as duas colunas; doze dá folga
# sem alcançar o corpo da última alternativa.
_LINHAS_DE_CAUDA = 12


def _sem_rodape(texto: str) -> str:
    """
    Corta o rodapé do fim de uma coluna de página.

    O rodapé ia parar dentro da alternativa D de toda questão que fechava
    página. Não derruba o parser, não falha validação: só suja o texto que a
    pessoa paga para ler, no ponto em que ninguém revisa.

    **Cortar por geometria seria mais elegante e não é seguro.** Medido nas
    44 provas: texto de questão desce até 0,927 da altura da página e o
    rodapé começa em 0,930. Um ponto e meio de folga não é limiar, é sorte.

    **Cortar linha a linha do fim também não basta**, e foi a primeira
    tentativa: o rodapé ocupa várias linhas, e a última delas pode ser um
    pedaço sem marcador nenhum — "DA EM 02/04/2017", o que sobra de "PROVA
    APLICADA EM..." depois do corte por coluna. A poda parava ali e deixava
    todo o resto do rodapé para trás.

    A regra que funciona: **do primeiro marcador forte até o fim**. Depois de
    um marcador de rodapé, na cauda de uma coluna, não existe mais conteúdo.

    Os marcadores são fortes no sentido literal — medido no acervo inteiro,
    nenhum aparece em texto legítimo de questão. É o que separa `IFICADO`
    (que só existe em rodapé truncado) de "Exame de Ordem", que é conteúdo
    corriqueiro em questão de Ética e por isso **não** entra na lista.
    """
    linhas = texto.splitlines()

    # ---- cabeçalho -------------------------------------------------------
    # Parte das edições repete a identificação no **topo** da página, e não
    # só no rodapé: no 40º, "40º EXAME DO ORDEM UNIFICADO" abre a coluna da
    # direita e ia parar na alternativa D da última questão da coluna da
    # esquerda, que é onde o bloco ainda estava aberto.
    #
    # Aqui a poda é linha a linha e só enquanto casa, **nunca por número
    # solto**: logo abaixo do cabeçalho vem a âncora da questão, que é
    # exatamente um número sozinho numa linha. Descartá-la custaria a prova.
    while linhas and (
        not linhas[0].strip()
        or _e_linha_de_rodape(linhas[0])
        or _SO_ILEGIVEL.match(linhas[0])
    ):
        linhas.pop(0)

    # ---- rodapé ----------------------------------------------------------
    inicio_da_cauda = max(0, len(linhas) - _LINHAS_DE_CAUDA)
    cortou = False
    for i in range(inicio_da_cauda, len(linhas)):
        if _e_linha_de_rodape(linhas[i]):
            linhas = linhas[:i]
            cortou = True
            break

    # Sobra do rodapé sem marcador: linha em branco, número de página solto,
    # glifo que não decodificou. O número solto só é descartado **depois** de
    # um marcador ter sido encontrado — sem essa condição, uma questão que
    # começasse no pé da coluna perderia a âncora e sumiria da prova.
    while linhas:
        ultima = linhas[-1]
        if (
            not ultima.strip()
            or _SO_ILEGIVEL.match(ultima)
            or (cortou and _NUMERO_DE_PAGINA.match(ultima))
        ):
            linhas.pop()
            continue
        break
    return "\n".join(linhas)


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
                _sem_rodape(
                    _recorte(
                        pdf, pagina, coluna * largura_coluna, largura_coluna, altura
                    )
                )
            )
    return "\n".join(partes)


def texto_simples(pdf: Path) -> str:
    """Extração em coluna única — usada no gabarito, que é uma grade."""
    return subprocess.run(
        ["pdftotext", "-layout", str(pdf), "-"],
        capture_output=True, text=True, check=True,
    ).stdout
