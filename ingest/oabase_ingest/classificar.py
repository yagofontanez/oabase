"""Classificação de questão em disciplina do edital.

Léxico determinístico em vez de LLM, por três motivos: roda sem chave de API,
é auditável linha a linha, e erra de forma previsível. A acurácia real é
medida contra uma amostra revisada à mão — sem essa medição o classificador
é fé, não engenharia.

Extensão natural: trocar `classificar` por um adaptador de LLM mantendo a
mesma assinatura, e usar este léxico como baseline de comparação.
"""

from __future__ import annotations

import re
import unicodedata

# Peso maior para termos longos e específicos: "recuperação judicial" decide,
# "prazo" não decide nada.
LEXICO: dict[str, list[str]] = {
    "etica-e-estatuto-da-oab": [
        "codigo de etica", "estatuto da advocacia", "conselho seccional",
        "tribunal de etica", "sociedade unipessoal de advocacia", "honorarios advocaticios",
        "advogado", "oab", "inscricao na ordem", "prerrogativa", "impedimento",
        "incompatibilidade", "estagiario", "censura", "suspensao do exercicio",
    ],
    "filosofia-do-direito": [
        "jusnaturalismo", "positivismo juridico", "kelsen", "hart", "dworkin",
        "hermeneutica", "aristoteles", "kant", "justica distributiva",
        "norma fundamental", "filosofia do direito",
    ],
    "direito-constitucional": [
        "constituicao federal", "controle de constitucionalidade", "acao direta de inconstitucionalidade",
        "adpf", "clausula petrea", "emenda constitucional", "supremo tribunal federal",
        "mandado de seguranca", "mandado de injuncao", "direitos fundamentais",
        "competencia legislativa", "poder constituinte", "repercussao geral",
    ],
    "direitos-humanos": [
        "corte interamericana", "pacto de sao jose", "convencao americana",
        "tratado internacional de direitos humanos", "direitos humanos", "onu",
    ],
    "direito-internacional": [
        "homologacao de sentenca estrangeira", "extradicao", "lindb", "mercosul",
        "competencia internacional", "carta rogatoria", "direito internacional",
    ],
    "direito-tributario": [
        "credito tributario", "lancamento tributario", "codigo tributario nacional",
        "icms", "iptu", "issqn", "imposto de renda", "contribuicao de melhoria",
        "imunidade tributaria", "isencao", "tributo", "fato gerador", "execucao fiscal",
    ],
    "direito-administrativo": [
        "ato administrativo", "licitacao", "improbidade administrativa", "servidor publico",
        "poder de policia", "desapropriacao", "concessao de servico publico",
        "administracao publica", "processo administrativo", "agente publico",
    ],
    "direito-ambiental": [
        "licenciamento ambiental", "area de preservacao permanente", "unidade de conservacao",
        "dano ambiental", "codigo florestal", "meio ambiente", "reserva legal",
    ],
    "direito-civil": [
        "responsabilidade civil", "usucapiao", "uniao estavel", "regime de bens",
        "testamento", "sucessao", "herdeiro", "posse", "propriedade", "servidao",
        "contrato de compra e venda", "locacao", "doacao", "obrigacao solidaria",
        "prescricao", "decadencia", "condominio", "alimentos", "curatela",
    ],
    "estatuto-da-crianca-e-do-adolescente": [
        "estatuto da crianca", "medida socioeducativa", "conselho tutelar",
        "adolescente", "ato infracional", "guarda", "adocao",
    ],
    "direito-do-consumidor": [
        "codigo de defesa do consumidor", "relacao de consumo", "vicio do produto",
        "fato do produto", "fornecedor", "consumidor", "publicidade enganosa",
        "direito de arrependimento",
    ],
    "direito-empresarial": [
        "recuperacao judicial", "falencia", "sociedade limitada", "sociedade anonima",
        "titulo de credito", "duplicata", "nota promissoria", "cheque", "endosso",
        "empresario individual", "propriedade industrial", "marca", "acionista",
    ],
    "direito-processual-civil": [
        "peticao inicial", "contestacao", "tutela provisoria", "cumprimento de sentenca",
        "codigo de processo civil", "agravo de instrumento", "apelacao", "coisa julgada",
        "litisconsorcio", "reconvencao", "juizo competente", "embargos de declaracao",
        "recurso especial", "sentenca", "revelia", "honorarios de sucumbencia",
    ],
    "direito-penal": [
        "codigo penal", "dolo eventual", "legitima defesa", "estado de necessidade",
        "concurso de crimes", "homicidio", "furto", "roubo", "estelionato",
        "tentativa", "tipicidade", "dosimetria", "livramento condicional", "pena privativa",
    ],
    "direito-processual-penal": [
        "inquerito policial", "prisao preventiva", "prisao em flagrante", "denuncia",
        "acao penal publica", "tribunal do juri", "habeas corpus", "recurso em sentido estrito",
        "codigo de processo penal", "audiencia de custodia", "cadeia de custodia",
    ],
    "direito-do-trabalho": [
        "contrato de trabalho", "vinculo empregaticio", "aviso previo", "fgts",
        "horas extras", "jornada de trabalho", "justa causa", "rescisao contratual",
        "consolidacao das leis do trabalho", "empregado", "empregador", "adicional noturno",
    ],
    "direito-processual-do-trabalho": [
        "reclamacao trabalhista", "justica do trabalho", "recurso ordinario",
        "tribunal superior do trabalho", "dissidio coletivo", "execucao trabalhista",
        "audiencia inaugural",
    ],
    "direito-previdenciario": [
        "regime geral de previdencia", "aposentadoria", "auxilio-doenca", "inss",
        "beneficio previdenciario", "salario de beneficio", "contribuicao previdenciaria",
        "pensao por morte",
    ],
}


def _normalizar(texto: str) -> str:
    sem_acento = "".join(
        c for c in unicodedata.normalize("NFD", texto.lower())
        if unicodedata.category(c) != "Mn"
    )
    return re.sub(r"\s+", " ", sem_acento)


# Pré-compila as buscas com fronteira de palavra.
_PADROES = {
    disciplina: [(termo, re.compile(rf"\b{re.escape(termo)}\b")) for termo in termos]
    for disciplina, termos in LEXICO.items()
}


def pontuar(texto: str) -> dict[str, float]:
    alvo = _normalizar(texto)
    placar: dict[str, float] = {}
    for disciplina, padroes in _PADROES.items():
        total = 0.0
        for termo, padrao in padroes:
            ocorrencias = len(padrao.findall(alvo))
            if ocorrencias:
                # Termo com mais palavras é mais específico; peso proporcional.
                total += ocorrencias * (1 + termo.count(" "))
        if total:
            placar[disciplina] = total
    return placar


def classificar(texto: str) -> tuple[str | None, float]:
    """Devolve (disciplina, confiança). Confiança é a margem sobre o 2º lugar."""
    placar = pontuar(texto)
    if not placar:
        return None, 0.0
    ordenado = sorted(placar.items(), key=lambda kv: kv[1], reverse=True)
    melhor, pontos = ordenado[0]
    segundo = ordenado[1][1] if len(ordenado) > 1 else 0.0
    confianca = (pontos - segundo) / pontos
    return melhor, confianca
