"""Texto da prova → questões estruturadas.

A âncora de segmentação é o número da questão sozinho numa linha. Buscar
"qualquer número isolado" produziria falsos positivos (numeração de artigo,
ano, valor); por isso o parser procura sempre e apenas o **próximo número
esperado**, em ordem. Um enunciado que contenha "13" solto não engana o
parser enquanto ele estiver à procura da questão 12.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

# A marcação da alternativa mudou entre edições: "(A)" nas provas recentes,
# "A)" nas mais antigas. O parêntese de abertura é opcional.
INICIO_ALTERNATIVA = re.compile(r"^\s*\(?([A-D])\)\s*(.*)$")

# A mesma marcação com a **letra ilegível**.
#
# No caderno do 35º Exame, a alternativa D da questão 77 sai da extração como
# `\x18)\x03 A CLT é omissa...`: a letra e o espaço caíram numa fonte CID sem
# tabela de caracteres e viraram índices de glifo, enquanto o resto da linha
# decodificou normalmente. A letra está lá — a página renderiza "D)" —, só
# não chegou como letra.
#
# Sem isto a linha não casa como início de alternativa e é engolida pela
# alternativa anterior: a questão fica com três alternativas e a C termina
# com o texto da D grudado. O parser recusa a prova inteira por isso, que é o
# comportamento certo, mas a causa é um caractere.
#
# A recuperação é **estrutural, não adivinhação**: só vale quando exatamente
# uma das quatro letras ainda falta, e é essa a letra devolvida. Com duas
# faltando não há o que inferir, e a linha volta a ser tratada como texto
# comum — de novo, o parser recusa e alguém olha.
ALTERNATIVA_SEM_LETRA = re.compile(r"^[^\w\s(]?\)[\s\x00-\x1f]+(\S.*)$")
# Depois da última questão vem o "questionário de percepção sobre a prova".
# Sem essa âncora ele é absorvido pela alternativa (D) da questão 80 — o
# parser não tem como saber sozinho onde a prova acabou.
FIM_DA_PROVA = re.compile(
    r"^\s*Question[áa]rio de percep[çc][ãa]o sobre a prova\b", re.IGNORECASE
)

# Rodapé de página.
#
# **A edição vem em numeral romano no rodapé** — "XXXV EXAME DE ORDEM
# UNIFICADO" —, e o prefixo aceito aqui era só decimal. O resultado é que o
# rodapé nunca casou como ruído e foi parar dentro da alternativa D de toda
# questão que fechava uma página: 656 questões do acervo, 19% da base,
# terminam com "IX EXAME DE ORDEM UNI" grudado no texto.
#
# Passou despercebido por anos porque não quebra nada — não derruba o parser,
# não falha validação, não some com questão. Só suja o texto que a pessoa
# paga para ler, no fim da última alternativa, onde ninguém revisa.
#
# **O numeral da edição é obrigatório** para casar "EXAME DE ORDEM", e essa
# exigência é o que separa rodapé de conteúdo. Sem ela o filtro come linha
# legítima: a questão 7 do 35º é sobre advogado formado no exterior e as
# alternativas quebram a linha exatamente antes de "Exame de Ordem,
# cumpridos os demais requisitos legais" — a alternativa C terminava em "e
# que seja aprovado no", truncada, sem erro nenhum. Rodapé traz a edição;
# frase de questão, não.
#
# O corte por coluna trunca as palavras do rodapé ("UNI", "UN", "UNIFI"), por
# isso o casamento é por prefixo e não pela frase inteira.
RUIDO = re.compile(
    r"^\s*(?:"
    r"(?:[IVXLC]+|\d+)\s*(?:EXAME DE ORDEM|EXAME DO ORDEM)"
    r"|PROVA APLICADA"
    r"|Tipo Branca|Tipo \w+"
    r"|FGV|Prova Objetiva"
    r"|P[áa]gina\s+\d"
    r")\b.*$",
    re.IGNORECASE,
)


class ErroDeParsing(RuntimeError):
    pass


@dataclass
class Questao:
    numero: int
    enunciado: str
    alternativas: dict[str, str] = field(default_factory=dict)

    def problemas(self) -> list[str]:
        """Validação por questão — o pipeline recusa carregar com problema."""
        erros = []
        # O limiar era 60, calibrado só nas provas modernas. As antigas usam
        # muito o enunciado de complemento, em que a frase termina nas
        # alternativas — "A dação em pagamento é" tem 22 caracteres e está
        # inteiro. Medido nas 3.360 questões das 42 provas que parseiam: o
        # menor enunciado legítimo tem 22, e os vinte mais curtos foram
        # conferidos um a um contra o PDF. Quem pega truncamento de verdade é
        # a checagem das alternativas logo abaixo, que exige as quatro.
        if len(self.enunciado) < 20:
            erros.append(f"enunciado curto demais ({len(self.enunciado)} chars)")
        faltando = sorted({"A", "B", "C", "D"} - set(self.alternativas))
        if faltando:
            erros.append(f"alternativas ausentes: {', '.join(faltando)}")
        for letra, texto in self.alternativas.items():
            # Alternativa de uma palavra é legítima e comum ("Francesa.",
            # "Abono."); o limiar existe só para pegar truncamento real.
            if len(texto) < 3:
                erros.append(f"alternativa {letra} curta demais")
        return erros


def _limpar(linhas: list[str]) -> list[str]:
    return [l for l in linhas if not RUIDO.match(l) and l.strip()]


def _juntar(partes: list[str]) -> str:
    """Junta linhas quebradas pela diagramação, normalizando espaços."""
    return re.sub(r"\s+", " ", " ".join(partes)).strip()


# O espaço entre a palavra e o número é opcional: na 25ª edição a questão 29
# sai como "Questão29" da extração, e exigir o espaço custava a prova inteira.
# O `*` depois do número marca questão anulada no próprio caderno (19ª, q22);
# a anulação já vem do gabarito, aqui ele só não pode impedir o casamento.
ANCORA_ROTULADA = re.compile(r"^\s*Quest[ãa]o\s*(\d+)\s*\*?\s*$", re.IGNORECASE)


def _usa_rotulo(linhas: list[str], total: int) -> bool:
    """A âncora da questão mudou de forma entre as edições.

    Da 32ª em diante o número aparece sozinho numa linha; até a 31ª vem
    precedido de "Questão". As duas formas **não** podem ser aceitas ao mesmo
    tempo: nas provas antigas o rodapé traz o número da página sozinho numa
    linha, e o parser casaria com ele antes de chegar à questão. Foi o que
    acontecia — as dez "questões" encontradas na 20ª eram números de página,
    e só o total errado impediu que virassem conteúdo.

    Por isso o estilo é decidido para o documento inteiro, e não linha a
    linha. Metade das questões rotuladas basta para não haver dúvida: nas
    modernas esse número é zero, nas antigas é oitenta.
    """
    rotuladas = {
        int(m.group(1))
        for linha in linhas
        if (m := ANCORA_ROTULADA.match(linha))
    }
    return len(rotuladas & set(range(1, total + 1))) >= total // 2


def _e_ancora(linha: str, numero: int, rotulada: bool) -> bool:
    if rotulada:
        m = ANCORA_ROTULADA.match(linha)
        return m is not None and int(m.group(1)) == numero
    return linha.strip() == str(numero)


def _dividir_blocos(
    texto: str, total: int, supridas: frozenset[int] = frozenset()
) -> dict[int, list[str]]:
    """
    Segmenta o texto em blocos, um por questão.

    `supridas` são os números que vêm de fora (remendo) e cuja âncora não
    existe no texto. Sem essa lista a busca é estritamente sequencial: ao não
    achar a âncora 57, o parser fica esperando por ela para sempre e as
    questões 58 em diante nunca são reconhecidas — foi assim que o 35º Exame
    apareceu como "56 de 80" quando 71 âncoras estavam legíveis no arquivo.

    A ausência é declarada, e não inferida: pular uma âncora só porque ela
    não apareceu transformaria uma prova mal extraída numa prova
    silenciosamente incompleta.
    """
    linhas = texto.splitlines()
    rotulada = _usa_rotulo(linhas, total)
    blocos: dict[int, list[str]] = {}
    esperado = 1
    atual: list[str] | None = None

    def proximo_no_texto(n: int) -> int:
        """O próximo número cuja âncora deve mesmo estar no texto."""
        while n <= total and n in supridas:
            n += 1
        return n

    esperado = proximo_no_texto(esperado)

    for linha in linhas:
        if esperado <= total and _e_ancora(linha, esperado, rotulada):
            atual = []
            blocos[esperado] = atual
            esperado = proximo_no_texto(esperado + 1)
            continue
        if FIM_DA_PROVA.match(linha):
            atual = None
            continue
        if atual is not None:
            atual.append(linha)

    esperados = [n for n in range(1, total + 1) if n not in supridas]
    if len(blocos) != len(esperados):
        faltando = [n for n in esperados if n not in blocos]
        raise ErroDeParsing(
            f"encontrei {len(blocos)} de {len(esperados)} questões; "
            f"faltam: {faltando[:10]}"
        )
    return blocos


def _parsear_bloco(numero: int, linhas: list[str]) -> Questao:
    linhas = _limpar(linhas)

    enunciado: list[str] = []
    alternativas: dict[str, list[str]] = {}
    atual: str | None = None

    for linha in linhas:
        m = INICIO_ALTERNATIVA.match(linha)
        letra_recuperada: str | None = None
        resto_recuperado = ""
        if not m:
            orfa = ALTERNATIVA_SEM_LETRA.match(linha)
            if orfa:
                ausentes = sorted({"A", "B", "C", "D"} - set(alternativas))
                if len(ausentes) == 1:
                    letra_recuperada = ausentes[0]
                    resto_recuperado = orfa.group(1)
        if m or letra_recuperada:
            letra = letra_recuperada or m.group(1)
            resto = m.group(2) if m else resto_recuperado
            # Uma questão tem exatamente um conjunto A–D. Reencontrar uma
            # letra já vista significa que saímos dela — em geral para o
            # questionário de percepção que fecha o caderno, cujas opções
            # sobrescreviam silenciosamente as alternativas reais da última
            # questão. Regra estrutural, não âncora de texto.
            if letra in alternativas:
                break
            atual = letra
            alternativas[atual] = [resto]
        elif atual:
            alternativas[atual].append(linha)
        else:
            enunciado.append(linha)

    return Questao(
        numero=numero,
        enunciado=_juntar(enunciado),
        alternativas={k: _juntar(v) for k, v in alternativas.items()},
    )


def parsear_prova(
    texto: str, total: int = 80, supridas: frozenset[int] = frozenset()
) -> list[Questao]:
    blocos = _dividir_blocos(texto, total, supridas)
    return [_parsear_bloco(n, blocos[n]) for n in sorted(blocos)]
