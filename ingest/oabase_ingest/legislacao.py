"""Ingestão de texto de lei a partir do Planalto.

A fonte é o `planalto.gov.br`, que é o texto oficial compilado. Duas coisas
merecem registro por terem custado tempo:

1. O servidor recusa o User-Agent padrão do `curl`/`urllib` — responde nada e
   estoura o tempo. Com cabeçalho de navegador, responde em dois segundos.
2. As páginas são HTML antigo em ISO-8859-1, com quebra de linha no meio das
   frases. Um artigo não é um parágrafo do HTML: é um trecho que começa em
   "Art. N" e vai até o próximo, com incisos e parágrafos espalhados por
   várias linhas cruas que precisam ser recompostas.

O que este módulo NÃO faz: escrever comentário. Comentário é autoral e é o
diferencial do produto — o texto entra com `indexavel = false` e só vai ao
índice quando alguém escrever a análise.
"""

from __future__ import annotations

import re
import unicodedata
import urllib.request
from dataclasses import dataclass, field

from .carregar import _lit, executar

NAVEGADOR = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)

# Marcadores estruturais. Linha que não casa com nenhum é continuação da
# anterior — é assim que a quebra no meio da frase é desfeita.
# O número aceita separador de milhar porque o Código Civil escreve os dois
# jeitos — `Art. 1.337` e `Art. 1337` na mesma página. Exigir exatamente três
# dígitos após o ponto separa o milhar do ponto final da abreviatura.
#
# A letra do artigo (`Art. 58-A`) vem sempre colada ao número; o travessão da
# grafia antiga vem cercado de espaços ("Art. 13 - O resultado..."). É só essa
# diferença que separa os dois — sem ela, o "O" de "O resultado" virava um
# artigo "13-O" e o artigo 13 sumia. Só no CP e na CLT eram quase 300 assim.
#
# O ordinal vem em `<sup>o</sup>` e, sem a tag, sobra um "o" separado por
# espaço. Daí o `\s?` antes dele; e ele só conta se não for seguido de letra,
# senão engoliria a primeira palavra de um caput que comece com "o".
# O ponto depois de "Art" é opcional: as leis dos anos 60 e 70 escrevem
# "Art 1º" sem ele — na Lei 5.584/70 isso derrubava 20 dos 21 artigos. Exigir
# o dígito logo em seguida é o que impede que "Artigo incluído pela Lei..."
# das notas de alteração seja lido como começo de artigo.
INICIO_ARTIGO = re.compile(
    r"^Art\.?\s*(\d+(?:\.\d{3})*)"
    r"(?:\.|\s?[ºo°](?![A-Za-zÀ-ÿ])|-([A-Z])(?![a-zà-ÿ]))?"
)
# O parágrafo abre frase nova, então vem seguido de maiúscula, travessão ou
# parêntese. Uma citação continua a frase em minúscula — "§ 1º do art. 159",
# no caput do art. 179 do CPP, é referência e não estrutura.
INICIO_PARAGRAFO = re.compile(
    r"^(§\s*\d+\s*[ºo°.]?\s*[-–—A-ZÀ-Ý(]|Parágrafo\s+único)"
)
INICIO_INCISO = re.compile(r"^([IVXLCDM]+)\s*[-–—](?:\s|$)")
INICIO_ALINEA = re.compile(r"^([a-z])\)\s")
ORDINAL_SOLTO = re.compile(r"[ºª°oa]")


@dataclass
class Lei:
    slug: str
    nome: str
    sigla: str
    ano: int
    disciplina: str
    url: str
    resumo: str
    # Onde parar. A Constituição, por exemplo, continua no ADCT, que reinicia
    # a numeração dos artigos e colidiria com a chave (lei, artigo).
    parar_em: str | None = None


@dataclass
class Artigo:
    numero: str
    slug: str
    caput: str
    paragrafos: list[str] = field(default_factory=list)


LEIS: list[Lei] = [
    Lei(
        "constituicao-federal", "Constituição Federal", "CF/88", 1988,
        "direito-constitucional",
        "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm",
        "A norma mais cobrada do exame. Direitos fundamentais, organização do Estado e controle de constitucionalidade aparecem em toda edição.",
        parar_em="ATO DAS DISPOSI",
    ),
    Lei(
        "codigo-civil", "Código Civil", "CC", 2002, "direito-civil",
        "https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm",
        "Base de Direito Civil na prova: responsabilidade civil, contratos, direitos reais e família concentram a maior parte das questões.",
    ),
    Lei(
        "codigo-penal", "Código Penal", "CP", 1940, "direito-penal",
        "https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm",
        "Parte geral e crimes contra a pessoa e o patrimônio dominam a incidência em Direito Penal.",
    ),
    Lei(
        "codigo-de-processo-civil", "Código de Processo Civil", "CPC", 2015,
        "direito-processual-civil",
        "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105.htm",
        "Procedimento comum, tutelas e recursos: a disciplina processual de maior peso na prova.",
    ),
    Lei(
        "codigo-de-processo-penal", "Código de Processo Penal", "CPP", 1941,
        "direito-processual-penal",
        "https://www.planalto.gov.br/ccivil_03/decreto-lei/del3689compilado.htm",
        "Inquérito, prisões, provas e recursos criminais — o que a banca cobra em Processo Penal.",
    ),
    Lei(
        "estatuto-da-oab", "Estatuto da Advocacia e da OAB", "Lei 8.906/94", 1994,
        "etica-e-estatuto-da-oab",
        "https://www.planalto.gov.br/ccivil_03/leis/l8906.htm",
        "Fonte direta do bloco que abre a prova. Material curto e estável, com a melhor relação entre volume cobrado e volume a estudar.",
    ),
    Lei(
        "codigo-de-defesa-do-consumidor", "Código de Defesa do Consumidor", "CDC",
        1990, "direito-do-consumidor",
        "https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm",
        "Relação de consumo, vícios e responsabilidade do fornecedor. Poucas questões, mas de resolução rápida.",
    ),
    Lei(
        "clt", "Consolidação das Leis do Trabalho", "CLT", 1943,
        "direito-do-trabalho",
        "https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452compilado.htm",
        "Contrato de trabalho, jornada, rescisão e FGTS — a base do bloco trabalhista.",
    ),

    # ------------------------------------------------------------------
    # Segunda leva.
    #
    # Os oito códigos acima cobrem sete disciplinas e deixavam **nove sem
    # artigo nenhum** no banco — Tributário sem CTN, Previdenciário sem a
    # 8.213, Empresarial sem nada. Na tela de estudo isso aparecia como "sem
    # material ainda" em metade da prova, o que era verdade e não devia ser.
    #
    # O critério para entrar aqui é o mesmo do resto do projeto: norma que a
    # 1ª fase cobra de forma recorrente e que existe em texto compilado no
    # Planalto. Disciplina sem norma central — Filosofia do Direito — não
    # ganha entrada de mentira só para preencher a lista.
    # ------------------------------------------------------------------
    Lei(
        "codigo-tributario-nacional", "Código Tributário Nacional", "CTN", 1966,
        "direito-tributario",
        "https://www.planalto.gov.br/ccivil_03/leis/l5172compilado.htm",
        "Obrigação, crédito e lançamento tributário. Junto com o art. 150 da Constituição, responde por quase toda a incidência de Tributário.",
    ),
    Lei(
        "estatuto-da-crianca-e-do-adolescente",
        "Estatuto da Criança e do Adolescente", "ECA", 1990,
        "estatuto-da-crianca-e-do-adolescente",
        "https://www.planalto.gov.br/ccivil_03/leis/l8069.htm",
        "Proteção integral, medidas socioeducativas e conselho tutelar — bloco curto, de leitura direta e cobrança previsível.",
    ),
    Lei(
        "lei-das-sa", "Lei das Sociedades por Ações", "Lei 6.404/76", 1976,
        "direito-empresarial",
        "https://www.planalto.gov.br/ccivil_03/leis/l6404compilada.htm",
        "Companhia, ações, órgãos de administração e direitos do acionista: a parte societária do bloco empresarial.",
    ),
    Lei(
        "lei-de-recuperacao-e-falencia", "Lei de Recuperação e Falência",
        "Lei 11.101/05", 2005, "direito-empresarial",
        "https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2005/lei/l11101.htm",
        "Recuperação judicial, extrajudicial e falência. Em Empresarial, é onde a banca mais gosta de montar caso concreto.",
    ),
    Lei(
        "lei-de-beneficios-da-previdencia", "Lei de Benefícios da Previdência Social",
        "Lei 8.213/91", 1991, "direito-previdenciario",
        "https://www.planalto.gov.br/ccivil_03/leis/l8213cons.htm",
        "Segurados, carência e benefícios do RGPS — a norma que sustenta praticamente todo o bloco previdenciário.",
    ),
    Lei(
        "lei-de-crimes-ambientais", "Lei de Crimes Ambientais", "Lei 9.605/98",
        1998, "direito-ambiental",
        "https://www.planalto.gov.br/ccivil_03/leis/l9605.htm",
        "Responsabilidade penal e administrativa por dano ambiental, inclusive da pessoa jurídica.",
    ),
    Lei(
        "lei-do-processo-administrativo", "Lei do Processo Administrativo Federal",
        "Lei 9.784/99", 1999, "direito-administrativo",
        "https://www.planalto.gov.br/ccivil_03/leis/l9784.htm",
        "Princípios da administração, motivação, invalidação e prazos do processo administrativo.",
    ),
    Lei(
        "lei-de-licitacoes", "Lei de Licitações e Contratos", "Lei 14.133/21",
        2021, "direito-administrativo",
        "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm",
        "Modalidades, critérios de julgamento e contratos administrativos na lei que substituiu a 8.666.",
    ),
    Lei(
        "lindb", "Lei de Introdução às Normas do Direito Brasileiro", "LINDB",
        1942, "direito-internacional",
        "https://www.planalto.gov.br/ccivil_03/decreto-lei/del4657compilado.htm",
        "Vigência, conflito de leis no tempo e no espaço. É a porta de entrada tanto de Internacional quanto da parte geral do Civil.",
    ),
    Lei(
        "lei-do-processo-do-trabalho", "Lei do Processo do Trabalho",
        "Lei 5.584/70", 1970, "direito-processual-do-trabalho",
        "https://www.planalto.gov.br/ccivil_03/leis/l5584.htm",
        "Normas de processo do trabalho fora da CLT: alçada, honorários periciais e assistência judiciária.",
    ),
]

# Direitos Humanos continua sem norma aqui, e é decisão, não esquecimento.
# O Pacto de São José está no Decreto 678/1992, cuja página traz **duas
# numerações na mesma URL**: os três artigos do decreto e, logo abaixo, os
# oitenta e dois "ARTIGO N" do tratado — que colidiriam com os primeiros na
# chave (lei, artigo). Resolver isso exige um "começar_em" que ainda não
# existe, e meia convenção carregada é pior do que nenhuma.
#
# Filosofia do Direito não tem norma central por definição. A tela de estudo
# diz isso em vez de fingir que tem.


def baixar(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": NAVEGADOR})
    with urllib.request.urlopen(req, timeout=120) as r:
        bruto = r.read()
    m = re.search(rb"charset=([\w-]+)", bruto[:4000], re.IGNORECASE)
    codificacao = m.group(1).decode() if m else "iso-8859-1"
    try:
        return bruto.decode(codificacao, errors="replace")
    except LookupError:
        return bruto.decode("iso-8859-1", errors="replace")


def em_linhas(html_bruto: str) -> list[str]:
    """HTML do Planalto → linhas de texto, preservando a quebra estrutural."""
    import html as escape

    t = re.sub(r"(?is)<(script|style).*?</\1>", " ", html_bruto)
    # A quebra estrutural vira um marcador que não existe em texto de lei, e
    # não "\n". A diferença parece cosmética e não é: o HTML do Planalto
    # quebra linha no meio do texto, na largura do editor de quem digitou —
    # no CTN, "Art." fica numa linha e "3º Tributo é toda prestação..." na
    # seguinte. Tratando a quebra de origem como estrutura, o marcador do
    # artigo se parte ao meio e o artigo inteiro desaparece: eram 124 dos 218
    # do Código Tributário, e nada no relatório dizia que faltava — só o
    # total, que ninguém compara com o número real da lei.
    t = re.sub(r"(?i)</p>|<br\s*/?>|</tr>|</div>", "\x00", t)
    t = escape.unescape(re.sub(r"<[^>]+>", "", t))
    # Espaço não separável aparece muito e atrapalha os marcadores.
    t = t.replace("\xa0", " ")
    cruas = [
        linha for linha in (" ".join(l.split()) for l in t.split("\x00")) if linha
    ]

    # "Art. 1º" costuma ser escrito `Art. 1<sup>o</sup>`, e a superscrita cai
    # numa linha só dela. Solta, ela viraria a primeira palavra do caput
    # ("o Toda pessoa é capaz..."). Colar de volta na linha anterior devolve o
    # ordinal ao número — vale igual para "§ 1" seguido de "o".
    # O "§" também se solta, mas ele abre o que vem depois: no art. 121 do CP
    # o parágrafo aparece como "§" numa linha e "1º Se o agente..." na outra.
    # Esse cola para a frente; o ordinal cola para trás.
    linhas: list[str] = []
    pendente = ""
    for linha in cruas:
        if pendente:
            linha, pendente = f"{pendente} {linha}", ""
        elif linha in ("§", "§§"):
            pendente = linha
            continue
        if linhas and ORDINAL_SOLTO.fullmatch(linha):
            linhas[-1] += linha
        else:
            linhas.append(linha)
    return linhas


def _slug(numero: str) -> str:
    texto = unicodedata.normalize("NFD", numero.lower())
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")
    return "artigo-" + re.sub(r"[^a-z0-9]+", "-", texto).strip("-")


def extrair_artigos(linhas: list[str], parar_em: str | None = None) -> list[Artigo]:
    artigos: list[Artigo] = []
    atual: Artigo | None = None
    segmento: list[str] = []
    por_slug: dict[str, Artigo] = {}

    def fechar_segmento() -> None:
        if atual is None or not segmento:
            return
        texto = " ".join(segmento).strip()
        if not texto:
            return
        if not atual.caput:
            # O travessão da grafia antiga às vezes cai na linha seguinte ao
            # número ("Art. 155" / "- Subtrair, para si..."), então a limpeza
            # precisa valer aqui também, e não só na linha do artigo.
            atual.caput = texto.lstrip("-–—").strip()
        else:
            atual.paragrafos.append(texto)

    for linha in linhas:
        # O marcador de parada também aparece no sumário, no topo da página,
        # antes de qualquer artigo — parar ali devolveria zero. Só vale a
        # ocorrência que vem depois do corpo já ter começado.
        if artigos and parar_em and linha.upper().startswith(parar_em.upper()):
            break

        inicio = INICIO_ARTIGO.match(linha)
        if inicio:
            fechar_segmento()
            numero = inicio.group(1).replace(".", "") + (
                f"-{inicio.group(2)}" if inicio.group(2) else ""
            )
            slug = _slug(numero)
            # O compilado do Planalto imprime a redação original e, logo
            # abaixo, cada nova redação — a vigente é sempre a ÚLTIMA. Guardar
            # a primeira significaria publicar texto revogado, que num produto
            # de estudo é pior do que não publicar nada. Por isso a repetição
            # zera o artigo e reabre a coleta, mantendo a posição original na
            # lista (que é a ordem numérica).
            anterior = por_slug.get(slug)
            if anterior is not None:
                anterior.caput = ""
                anterior.paragrafos.clear()
                atual = anterior
            else:
                atual = Artigo(numero=numero, slug=slug, caput="")
                artigos.append(atual)
                por_slug[slug] = atual
            # Sobra o travessão da grafia antiga, que é pontuação e não texto.
            resto = linha[inicio.end():].strip().lstrip("-–—").strip()
            segmento = [resto] if resto else []
            continue

        if atual is None:
            continue

        if (
            INICIO_PARAGRAFO.match(linha)
            or INICIO_INCISO.match(linha)
            or INICIO_ALINEA.match(linha)
        ):
            fechar_segmento()
            segmento = [linha]
        else:
            segmento.append(linha)

    fechar_segmento()

    # Artigo sem caput nenhum é ruído de sumário. Caput curto, não: "(Vetado)."
    # tem dez caracteres e é exatamente o que o aluno precisa ver ao procurar
    # o art. 15 do CDC.
    return [a for a in artigos if a.caput]


def ordem_do_numero(numero: str) -> int:
    """Posição do artigo na lei: 5, 5-A e 6 viram 500, 501 e 600.

    Derivada do número, não da ordem de chegada — uma recarga parcial não pode
    reordenar o que já está gravado.
    """
    casa = re.match(r"^(\d+)(?:-([A-Z]+))?", numero)
    if not casa:
        return 0
    letra = casa.group(2)
    deslocamento = ord(letra[0]) - ord("A") + 1 if letra else 0
    return int(casa.group(1)) * 100 + deslocamento


def _array(valores: list[str]) -> str:
    if not valores:
        return "'{}'::text[]"
    return "array[" + ",".join(_lit(v) for v in valores) + "]::text[]"


def sql_da_lei(lei: Lei) -> str:
    # A disciplina vai na própria linha da lei, e não só repetida em cada
    # artigo: é a pergunta que a tela de estudo faz ("qual é a norma central
    # de Tributário?") e que uma agregação sobre 7.654 linhas responderia caro.
    disciplina = (
        "(select id from public.disciplinas where slug = "
        f"{_lit(lei.disciplina)})"
    )
    return (
        "insert into public.leis (slug, nome, sigla, ano, resumo, disciplina_id)"
        f" values ({_lit(lei.slug)},{_lit(lei.nome)},{_lit(lei.sigla)},{lei.ano},"
        f"{_lit(lei.resumo)},{disciplina})\n"
        "on conflict (slug) do update set nome = excluded.nome,"
        " sigla = excluded.sigla, ano = excluded.ano, resumo = excluded.resumo,"
        " disciplina_id = excluded.disciplina_id;\n"
    )


def sql_dos_artigos(lei: Lei, artigos: list[Artigo], lote: int = 400) -> str:
    partes: list[str] = []
    for i in range(0, len(artigos), lote):
        linhas = ",\n  ".join(
            f"((select id from public.leis where slug = {_lit(lei.slug)}),"
            f"(select id from public.disciplinas where slug = {_lit(lei.disciplina)}),"
            f"{_lit(a.numero)},{_lit(a.slug)},{_lit(a.caput)},{_array(a.paragrafos)},"
            f"{ordem_do_numero(a.numero)})"
            for a in artigos[i : i + lote]
        )
        partes.append(
            "insert into public.artigos\n"
            "  (lei_id, disciplina_id, numero, slug, caput, paragrafos, ordem)\n"
            f"values\n  {linhas}\n"
            "on conflict (lei_id, slug) do update set\n"
            "  caput = excluded.caput,\n"
            "  paragrafos = excluded.paragrafos,\n"
            "  ordem = excluded.ordem,\n"
            "  atualizado_em = now()\n"
            # O texto oficial se atualiza sozinho enquanto ninguém escreveu
            # sobre ele. A partir do momento em que existe comentário, a linha
            # passa a ser trabalho autoral — e uma recarga não pode passar por
            # cima dele em silêncio. Mudança de lei comentada é revisão humana.
            "where public.artigos.comentario = '{}';\n"
        )
    return "\n".join(partes)


def main() -> None:
    import argparse
    import os

    parser = argparse.ArgumentParser(
        description="Baixa o texto oficial das leis no Planalto e carrega em `artigos`."
    )
    parser.add_argument(
        "--lei", action="append",
        help="slug da lei; repetível. Sem isso, roda todas.",
    )
    parser.add_argument(
        "--carregar", action="store_true",
        help="executa o SQL. Sem isso, só relata o que seria carregado.",
    )
    parser.add_argument("--sql", help="grava o SQL gerado neste arquivo.")
    args = parser.parse_args()

    escolhidas = [l for l in LEIS if not args.lei or l.slug in args.lei]
    if not escolhidas:
        raise SystemExit(f"nenhuma lei casa com {args.lei}")

    blocos: list[str] = []
    for lei in escolhidas:
        artigos = extrair_artigos(em_linhas(baixar(lei.url)), lei.parar_em)
        if not artigos:
            raise SystemExit(f"{lei.sigla}: nenhum artigo extraído — não carrego vazio")
        segmentos = sum(len(a.paragrafos) for a in artigos)
        print(f"{lei.sigla:14} {len(artigos):5} artigos · {segmentos:6} segmentos")
        blocos.append(sql_da_lei(lei) + sql_dos_artigos(lei, artigos))

    sql = "begin;\n" + "\n".join(blocos) + "commit;\n"
    if args.sql:
        with open(args.sql, "w", encoding="utf-8") as saida:
            saida.write(sql)
        print(f"SQL em {args.sql} ({len(sql) / 1e6:.1f} MB)")

    if not args.carregar:
        print("\n(--carregar ausente: nada foi escrito no banco)")
        return

    conexao = os.environ.get("SUPABASE_CONNECTION_STRING")
    if not conexao:
        raise SystemExit("defina SUPABASE_CONNECTION_STRING")
    executar(conexao, sql)
    print("carregado.")


if __name__ == "__main__":
    main()
