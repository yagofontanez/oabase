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
# Depois da última questão vem o "questionário de percepção sobre a prova".
# Sem essa âncora ele é absorvido pela alternativa (D) da questão 80 — o
# parser não tem como saber sozinho onde a prova acabou.
FIM_DA_PROVA = re.compile(
    r"^\s*Question[áa]rio de percep[çc][ãa]o sobre a prova\b", re.IGNORECASE
)

RUIDO = re.compile(
    r"^\s*(\d+\s*)?(EXAME DE ORDEM|EXAME DO ORDEM|Tipo Branca|Tipo \w+|"
    r"Ordem dos Advogados do Brasil|FGV|Prova Objetiva)\b.*$",
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


def _dividir_blocos(texto: str, total: int) -> dict[int, list[str]]:
    linhas = texto.splitlines()
    rotulada = _usa_rotulo(linhas, total)
    blocos: dict[int, list[str]] = {}
    esperado = 1
    atual: list[str] | None = None

    for linha in linhas:
        if esperado <= total and _e_ancora(linha, esperado, rotulada):
            atual = []
            blocos[esperado] = atual
            esperado += 1
            continue
        if FIM_DA_PROVA.match(linha):
            atual = None
            continue
        if atual is not None:
            atual.append(linha)

    if len(blocos) != total:
        faltando = [n for n in range(1, total + 1) if n not in blocos]
        raise ErroDeParsing(
            f"encontrei {len(blocos)} de {total} questões; faltam: {faltando[:10]}"
        )
    return blocos


def _parsear_bloco(numero: int, linhas: list[str]) -> Questao:
    linhas = _limpar(linhas)

    enunciado: list[str] = []
    alternativas: dict[str, list[str]] = {}
    atual: str | None = None

    for linha in linhas:
        m = INICIO_ALTERNATIVA.match(linha)
        if m:
            letra = m.group(1)
            # Uma questão tem exatamente um conjunto A–D. Reencontrar uma
            # letra já vista significa que saímos dela — em geral para o
            # questionário de percepção que fecha o caderno, cujas opções
            # sobrescreviam silenciosamente as alternativas reais da última
            # questão. Regra estrutural, não âncora de texto.
            if letra in alternativas:
                break
            atual = letra
            alternativas[atual] = [m.group(2)]
        elif atual:
            alternativas[atual].append(linha)
        else:
            enunciado.append(linha)

    return Questao(
        numero=numero,
        enunciado=_juntar(enunciado),
        alternativas={k: _juntar(v) for k, v in alternativas.items()},
    )


def parsear_prova(texto: str, total: int = 80) -> list[Questao]:
    blocos = _dividir_blocos(texto, total)
    return [_parsear_bloco(n, blocos[n]) for n in sorted(blocos)]
