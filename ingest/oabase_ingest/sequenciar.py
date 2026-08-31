"""Correção da classificação usando a ordem da prova.

A FGV monta o caderno em **blocos contíguos por disciplina**: as questões de
Ética vêm juntas, depois Filosofia, depois Constitucional, e assim por diante.
Isso é informação de graça que o léxico, olhando cada questão isolada, joga
fora.

Duas correções derivam disso:

1. **Preenchimento** — questão sem classificação cercada por vizinhos da
   mesma disciplina herda a disciplina deles. Resolve o enunciado que não
   contém nenhum termo do léxico.

2. **Filtro de outlier** — questão classificada como X, sozinha entre
   vizinhos Y de ambos os lados, é quase sempre erro de léxico: um termo
   genérico que pesou demais. Passa a Y, mas só quando a confiança dela era
   baixa e a dos vizinhos era alta.

O que a sequência **não** conserta é fronteira de bloco: se o léxico erra a
primeira questão de um bloco novo, o vizinho anterior a puxa para trás. Por
isso o resultado continua indo para revisão humana, não para o índice.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Palpite:
    numero: int
    disciplina: str | None
    confianca: float
    origem: str = "lexico"


def _vizinho(palpites: list[Palpite], i: int, passo: int) -> Palpite | None:
    j = i + passo
    while 0 <= j < len(palpites):
        if palpites[j].disciplina and palpites[j].origem == "lexico":
            return palpites[j]
        j += passo
    return None


def suavizar(
    palpites: list[Palpite],
    confianca_alta: float = 0.5,
    distancia_maxima: int = 3,
) -> list[Palpite]:
    """Aplica preenchimento e filtro de outlier sobre a sequência."""
    resultado = [Palpite(p.numero, p.disciplina, p.confianca, p.origem) for p in palpites]

    for i, atual in enumerate(resultado):
        anterior = _vizinho(palpites, i, -1)
        posterior = _vizinho(palpites, i, +1)
        if not anterior or not posterior:
            continue
        if anterior.disciplina != posterior.disciplina:
            continue
        # Só interpola dentro de uma vizinhança curta — dois blocos distantes
        # concordarem não diz nada sobre o que está no meio.
        if (atual.numero - anterior.numero > distancia_maxima
                or posterior.numero - atual.numero > distancia_maxima):
            continue
        if min(anterior.confianca, posterior.confianca) < confianca_alta:
            continue

        if atual.disciplina is None:
            resultado[i] = Palpite(
                atual.numero, anterior.disciplina, min(anterior.confianca, posterior.confianca),
                "sequencia:preenchimento",
            )
        elif atual.disciplina != anterior.disciplina and atual.confianca < confianca_alta:
            resultado[i] = Palpite(
                atual.numero, anterior.disciplina, min(anterior.confianca, posterior.confianca),
                "sequencia:outlier",
            )

    return resultado


def blocos(palpites: list[Palpite]) -> list[tuple[str | None, int, int]]:
    """Agrupa em (disciplina, primeira, última) — a leitura de auditoria."""
    saida: list[tuple[str | None, int, int]] = []
    for p in palpites:
        if saida and saida[-1][0] == p.disciplina:
            d, ini, _ = saida[-1]
            saida[-1] = (d, ini, p.numero)
        else:
            saida.append((p.disciplina, p.numero, p.numero))
    return saida
