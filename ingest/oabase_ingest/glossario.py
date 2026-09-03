"""Glossário de definições legais.

Cada verbete aponta para o artigo que define o termo, e a definição exibida é
o texto do próprio artigo — literal. O que este módulo acrescenta é curadoria:
qual termo merece verbete e onde ele está definido. É trabalho de índice, não
de doutrina, e é por isso que ele pode ser feito sem escrever uma linha sobre
direito.

Por que curado e não extraído por regex: das 73 ocorrências de "considera-se"
no acervo, boa parte não define termo nenhum — "considera-se praticado o crime
no lugar em que ocorreu a ação" é regra de competência, não definição de
"praticado". Separar uma coisa da outra exige saber o que é substantivo
definido e o que é particípio, e uma lista escrita à mão erra menos do que
uma heurística que erraria em silêncio.

O carregamento **confere**: termo cujo artigo não existe no acervo não entra,
e o relatório diz quais foram. Verbete apontando para o nada é pior do que
verbete nenhum.

    python3 -m oabase_ingest.glossario --sql /tmp/g.sql
    python3 -m oabase_ingest.glossario --carregar
"""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
import unicodedata

# (termo, lei, número do artigo, disciplina)
#
# A ordem é a do edital, para a revisão poder ser feita bloco a bloco.
TERMOS: list[tuple[str, str, str, str]] = [
    # ---- Ética e Estatuto da OAB ----
    ("Atividade privativa de advocacia", "estatuto-da-oab", "1", "etica-e-estatuto-da-oab"),
    ("Prerrogativas do advogado", "estatuto-da-oab", "7", "etica-e-estatuto-da-oab"),
    ("Sociedade de advogados", "estatuto-da-oab", "15", "etica-e-estatuto-da-oab"),
    ("Honorários advocatícios", "estatuto-da-oab", "22", "etica-e-estatuto-da-oab"),
    ("Infração disciplinar", "estatuto-da-oab", "34", "etica-e-estatuto-da-oab"),
    ("Suspensão (sanção disciplinar)", "estatuto-da-oab", "37", "etica-e-estatuto-da-oab"),

    # ---- Direito Civil ----
    ("Personalidade civil", "codigo-civil", "1", "direito-civil"),
    ("Início da personalidade", "codigo-civil", "2", "direito-civil"),
    ("Maioridade civil", "codigo-civil", "5", "direito-civil"),
    ("Domicílio", "codigo-civil", "70", "direito-civil"),
    ("Bem imóvel", "codigo-civil", "79", "direito-civil"),
    ("Negócio jurídico anulável por erro", "codigo-civil", "138", "direito-civil"),
    ("Dolo", "codigo-civil", "145", "direito-civil"),
    ("Coação", "codigo-civil", "151", "direito-civil"),
    ("Estado de perigo", "codigo-civil", "156", "direito-civil"),
    ("Lesão", "codigo-civil", "157", "direito-civil"),
    ("Fraude contra credores", "codigo-civil", "158", "direito-civil"),
    ("Decadência", "codigo-civil", "207", "direito-civil"),
    ("Mora", "codigo-civil", "394", "direito-civil"),
    ("Cláusula penal", "codigo-civil", "408", "direito-civil"),
    ("Ato ilícito", "codigo-civil", "186", "direito-civil"),
    ("Abuso de direito", "codigo-civil", "187", "direito-civil"),
    ("Responsabilidade objetiva", "codigo-civil", "927", "direito-civil"),
    ("Doação", "codigo-civil", "538", "direito-civil"),
    ("Compra e venda", "codigo-civil", "481", "direito-civil"),
    ("Locação de coisas", "codigo-civil", "565", "direito-civil"),
    ("Mandato", "codigo-civil", "653", "direito-civil"),
    ("Fiança", "codigo-civil", "818", "direito-civil"),
    ("Posse", "codigo-civil", "1196", "direito-civil"),
    ("Detentor", "codigo-civil", "1198", "direito-civil"),
    ("Usucapião extraordinária", "codigo-civil", "1238", "direito-civil"),
    ("Propriedade", "codigo-civil", "1228", "direito-civil"),
    ("União estável", "codigo-civil", "1723", "direito-civil"),
    ("Testamento", "codigo-civil", "1857", "direito-civil"),

    # ---- Direito Empresarial ----
    ("Empresário", "codigo-civil", "966", "direito-empresarial"),
    ("Sociedade limitada", "codigo-civil", "1052", "direito-empresarial"),
    ("Nome empresarial", "codigo-civil", "1155", "direito-empresarial"),
    ("Companhia aberta", "lei-das-sa", "4", "direito-empresarial"),
    ("Recuperação judicial", "lei-de-recuperacao-e-falencia", "47", "direito-empresarial"),
    ("Falência", "lei-de-recuperacao-e-falencia", "75", "direito-empresarial"),
    ("Patente de invenção", "lei-de-propriedade-industrial", "8", "direito-empresarial"),
    ("Marca", "lei-de-propriedade-industrial", "122", "direito-empresarial"),

    # ---- Direito do Consumidor ----
    ("Consumidor", "codigo-de-defesa-do-consumidor", "2", "direito-do-consumidor"),
    ("Fornecedor", "codigo-de-defesa-do-consumidor", "3", "direito-do-consumidor"),
    ("Direitos básicos do consumidor", "codigo-de-defesa-do-consumidor", "6", "direito-do-consumidor"),
    ("Vício do produto", "codigo-de-defesa-do-consumidor", "18", "direito-do-consumidor"),
    ("Publicidade enganosa", "codigo-de-defesa-do-consumidor", "37", "direito-do-consumidor"),
    ("Cláusula abusiva", "codigo-de-defesa-do-consumidor", "51", "direito-do-consumidor"),
    ("Repetição do indébito", "codigo-de-defesa-do-consumidor", "42", "direito-do-consumidor"),

    # ---- Direito Penal ----
    ("Tempo do crime", "codigo-penal", "4", "direito-penal"),
    ("Lugar do crime", "codigo-penal", "6", "direito-penal"),
    ("Crime consumado e tentado", "codigo-penal", "14", "direito-penal"),
    ("Arrependimento posterior", "codigo-penal", "16", "direito-penal"),
    ("Crime doloso e culposo", "codigo-penal", "18", "direito-penal"),
    ("Erro de tipo", "codigo-penal", "20", "direito-penal"),
    ("Excludentes de ilicitude", "codigo-penal", "23", "direito-penal"),
    ("Legítima defesa", "codigo-penal", "25", "direito-penal"),
    ("Inimputabilidade", "codigo-penal", "26", "direito-penal"),
    ("Concurso de pessoas", "codigo-penal", "29", "direito-penal"),
    ("Penas restritivas de direitos", "codigo-penal", "43", "direito-penal"),
    ("Circunstâncias judiciais", "codigo-penal", "59", "direito-penal"),
    ("Atenuantes", "codigo-penal", "65", "direito-penal"),
    ("Dosimetria trifásica", "codigo-penal", "68", "direito-penal"),
    ("Concurso material", "codigo-penal", "69", "direito-penal"),
    ("Concurso formal", "codigo-penal", "70", "direito-penal"),
    ("Crime continuado", "codigo-penal", "71", "direito-penal"),
    ("Prescrição pela pena máxima", "codigo-penal", "109", "direito-penal"),
    ("Furto", "codigo-penal", "155", "direito-penal"),
    ("Roubo", "codigo-penal", "157", "direito-penal"),
    ("Extorsão", "codigo-penal", "158", "direito-penal"),
    ("Estelionato", "codigo-penal", "171", "direito-penal"),
    ("Receptação", "codigo-penal", "180", "direito-penal"),
    ("Corrupção passiva", "codigo-penal", "317", "direito-penal"),
    ("Corrupção ativa", "codigo-penal", "333", "direito-penal"),
    ("Prevaricação", "codigo-penal", "319", "direito-penal"),

    # ---- Direito Processual Penal ----
    ("Prisão em flagrante", "codigo-de-processo-penal", "302", "direito-processual-penal"),
    ("Prisão preventiva", "codigo-de-processo-penal", "312", "direito-processual-penal"),
    ("Medidas cautelares diversas da prisão", "codigo-de-processo-penal", "319", "direito-processual-penal"),
    ("Emendatio libelli", "codigo-de-processo-penal", "383", "direito-processual-penal"),
    ("Mutatio libelli", "codigo-de-processo-penal", "384", "direito-processual-penal"),
    ("Continência", "codigo-de-processo-penal", "77", "direito-processual-penal"),
    ("Conexão", "codigo-de-processo-penal", "76", "direito-processual-penal"),
    ("Acareação", "codigo-de-processo-penal", "229", "direito-processual-penal"),

    # ---- Direito Constitucional ----
    ("Fundamentos da República", "constituicao-federal", "1", "direito-constitucional"),
    ("Objetivos fundamentais", "constituicao-federal", "3", "direito-constitucional"),
    ("Direitos sociais", "constituicao-federal", "6", "direito-constitucional"),
    ("Direitos dos trabalhadores", "constituicao-federal", "7", "direito-constitucional"),
    ("Sufrágio e voto", "constituicao-federal", "14", "direito-constitucional"),
    ("Entes federativos", "constituicao-federal", "18", "direito-constitucional"),
    ("Intervenção federal", "constituicao-federal", "34", "direito-constitucional"),
    ("Princípios da administração", "constituicao-federal", "37", "direito-constitucional"),
    ("Emenda constitucional", "constituicao-federal", "60", "direito-constitucional"),
    ("Legitimados para ADI", "constituicao-federal", "103", "direito-constitucional"),
    ("Meio ambiente ecologicamente equilibrado", "constituicao-federal", "225", "direito-constitucional"),

    # ---- Direito Tributário ----
    ("Limitações ao poder de tributar", "constituicao-federal", "150", "direito-tributario"),
    ("Impostos da União", "constituicao-federal", "153", "direito-tributario"),
    ("Matéria de lei complementar tributária", "constituicao-federal", "146", "direito-tributario"),
    ("Tributo", "codigo-tributario-nacional", "3", "direito-tributario"),
    ("Imposto", "codigo-tributario-nacional", "16", "direito-tributario"),
    ("Taxa", "codigo-tributario-nacional", "77", "direito-tributario"),
    ("Contribuição de melhoria", "codigo-tributario-nacional", "81", "direito-tributario"),
    ("Obrigação tributária", "codigo-tributario-nacional", "113", "direito-tributario"),
    ("Fato gerador", "codigo-tributario-nacional", "114", "direito-tributario"),
    ("Lançamento", "codigo-tributario-nacional", "142", "direito-tributario"),
    ("Suspensão do crédito tributário", "codigo-tributario-nacional", "151", "direito-tributario"),
    ("Extinção do crédito tributário", "codigo-tributario-nacional", "156", "direito-tributario"),

    # ---- Direito do Trabalho ----
    ("Empregado", "clt", "3", "direito-do-trabalho"),
    ("Empregador", "clt", "2", "direito-do-trabalho"),
    ("Intervalo intrajornada", "clt", "71", "direito-do-trabalho"),
    ("Justa causa", "clt", "482", "direito-do-trabalho"),
    ("Rescisão indireta", "clt", "483", "direito-do-trabalho"),
    ("Verbas incontroversas", "clt", "467", "direito-do-trabalho"),
    ("Ônus da prova no processo do trabalho", "clt", "818", "direito-processual-do-trabalho"),
    ("Exceção de incompetência territorial", "clt", "800", "direito-processual-do-trabalho"),

    # ---- Direito Processual Civil ----
    ("Cooperação processual", "codigo-de-processo-civil", "6", "direito-processual-civil"),
    ("Honorários de sucumbência", "codigo-de-processo-civil", "85", "direito-processual-civil"),
    ("Denunciação da lide", "codigo-de-processo-civil", "125", "direito-processual-civil"),
    ("Contagem em dias úteis", "codigo-de-processo-civil", "219", "direito-processual-civil"),
    ("Audiência de conciliação", "codigo-de-processo-civil", "334", "direito-processual-civil"),
    ("Tutela antecipada antecedente", "codigo-de-processo-civil", "303", "direito-processual-civil"),
    ("Sentença sem resolução de mérito", "codigo-de-processo-civil", "485", "direito-processual-civil"),
    ("Sentença com resolução de mérito", "codigo-de-processo-civil", "487", "direito-processual-civil"),
    ("Exceção de domínio", "codigo-de-processo-civil", "557", "direito-processual-civil"),

    # ---- Direito Administrativo ----
    ("Improbidade administrativa", "lei-de-improbidade", "9", "direito-administrativo"),
    ("Processo administrativo federal", "lei-do-processo-administrativo", "1", "direito-administrativo"),
    ("Modalidades de licitação", "lei-de-licitacoes", "28", "direito-administrativo"),
    ("Contratação direta", "lei-de-licitacoes", "72", "direito-administrativo"),

    # ---- Direitos Humanos e ECA ----
    ("Criança e adolescente", "estatuto-da-crianca-e-do-adolescente", "2", "estatuto-da-crianca-e-do-adolescente"),
    ("Proteção integral", "estatuto-da-crianca-e-do-adolescente", "1", "estatuto-da-crianca-e-do-adolescente"),
    ("Ato infracional", "estatuto-da-crianca-e-do-adolescente", "103", "estatuto-da-crianca-e-do-adolescente"),
    ("Medidas socioeducativas", "estatuto-da-crianca-e-do-adolescente", "112", "estatuto-da-crianca-e-do-adolescente"),
    ("Pessoa com deficiência", "estatuto-da-pessoa-com-deficiencia", "2", "direitos-humanos"),
    ("Pessoa idosa", "estatuto-do-idoso", "1", "direitos-humanos"),

    # ---- Direito Previdenciário ----
    ("Segurado obrigatório", "lei-de-beneficios-da-previdencia", "11", "direito-previdenciario"),
    ("Segurado facultativo", "lei-de-beneficios-da-previdencia", "13", "direito-previdenciario"),
    ("Período de carência", "lei-de-beneficios-da-previdencia", "24", "direito-previdenciario"),
    ("Salário de benefício", "lei-de-beneficios-da-previdencia", "29", "direito-previdenciario"),

    # ---- Direito Internacional ----
    ("Vigência da lei no tempo", "lindb", "1", "direito-internacional"),
    ("Lei do domicílio", "lindb", "7", "direito-internacional"),
    ("Homologação de sentença estrangeira", "lindb", "15", "direito-internacional"),

    # ---- Direito Ambiental ----
    ("Meio ambiente (definição legal)", "politica-nacional-do-meio-ambiente", "3", "direito-ambiental"),
    ("Responsabilidade penal da pessoa jurídica", "lei-de-crimes-ambientais", "3", "direito-ambiental"),
]


def psql(sql: str, conexao: str) -> str:
    r = subprocess.run(
        ["psql", conexao, "-tAF\x1f", "-v", "ON_ERROR_STOP=1", "-c", sql],
        capture_output=True, text=True,
    )
    if r.returncode != 0:
        raise SystemExit(f"psql falhou:\n{r.stderr[:600]}")
    return r.stdout


def _lit(v: str) -> str:
    return "'" + v.replace("'", "''") + "'"


def _slug(termo: str) -> str:
    texto = unicodedata.normalize("NFD", termo.lower())
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", texto).strip("-")


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--sql", help="grava o SQL em vez de aplicar")
    p.add_argument("--carregar", action="store_true")
    args = p.parse_args(argv)

    conexao = os.environ.get("SUPABASE_CONNECTION_STRING")
    if not conexao:
        print("✗ defina SUPABASE_CONNECTION_STRING", file=sys.stderr)
        return 1

    # Índice do acervo: o verbete só existe se o artigo existir.
    indice: dict[tuple[str, str], str] = {}
    for linha in psql(
        "select l.slug, a.numero, a.id from public.artigos a "
        "join public.leis l on l.id = a.lei_id",
        conexao,
    ).strip().split("\n"):
        if not linha:
            continue
        lei, numero, artigo_id = linha.split("\x1f")
        indice[(lei, numero)] = artigo_id

    valores: list[str] = []
    ausentes: list[str] = []
    slugs: set[str] = set()

    for termo, lei, numero, disciplina in TERMOS:
        artigo = indice.get((lei, numero))
        if not artigo:
            ausentes.append(f"{termo} ({lei} art. {numero})")
            continue
        slug = _slug(termo)
        if slug in slugs:
            ausentes.append(f"{termo} (slug repetido)")
            continue
        slugs.add(slug)
        valores.append(
            f"({_lit(slug)}, {_lit(termo)}, '', {_lit(artigo)}::uuid, "
            f"(select id from public.disciplinas where slug = {_lit(disciplina)}), true)"
        )

    print(f"{len(valores)} verbetes · {len(ausentes)} sem artigo no acervo")
    for a in ausentes:
        print(f"  ✗ {a}", file=sys.stderr)

    if not valores:
        return 1

    # `definicao` fica vazia de propósito: o texto exibido é o do artigo, lido
    # na hora. Copiar o caput para cá criaria duas verdades que sairiam de
    # sincronia na primeira alteração da lei.
    sql = (
        "insert into public.termos_glossario\n"
        "  (slug, termo, definicao, artigo_id, disciplina_id, indexavel)\n"
        "values\n  " + ",\n  ".join(valores) +
        "\non conflict (slug) do update set\n"
        "  termo = excluded.termo,\n"
        "  artigo_id = excluded.artigo_id,\n"
        "  disciplina_id = excluded.disciplina_id,\n"
        "  indexavel = excluded.indexavel;\n"
    )

    if args.sql:
        with open(args.sql, "w", encoding="utf-8") as f:
            f.write(sql)
        print(f"SQL em {args.sql}")

    if args.carregar:
        r = subprocess.run(
            ["psql", conexao, "-v", "ON_ERROR_STOP=1", "-q", "-f", "-"],
            input=sql, capture_output=True, text=True,
        )
        if r.returncode != 0:
            print(f"✗ psql falhou:\n{r.stderr[:600]}", file=sys.stderr)
            return 1
        print("✓ glossário carregado")
    elif not args.sql:
        print("\n(ensaio — nada gravado. Repita com --carregar.)")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
