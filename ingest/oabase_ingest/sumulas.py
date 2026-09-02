"""Súmulas Vinculantes do STF, da fonte oficial.

Por que súmula, e por que agora: a OAB cobra enunciado de súmula com
frequência, o texto é curto, é oficial e **não é opinião de ninguém** — dá
para trazer com a mesma disciplina de procedência da legislação, sem que
nada aqui dependa de alguém escrever comentário antes.

    python3 -m oabase_ingest.sumulas --sql /tmp/s.sql   # ensaio
    python3 -m oabase_ingest.sumulas --carregar

Três armadilhas do portal do STF, todas custaram tempo:

1. **O certificado não fecha sozinho.** `portal.stf.jus.br` apresenta o
   certificado folha mas **não envia o intermediário** (GlobalSign GCC R6
   AlphaSSL CA 2025). O navegador disfarça buscando o intermediário pela
   extensão AIA; `curl` e `urllib` não fazem isso e devolvem "unable to get
   local issuer certificate". A raiz R6 já está no sistema — falta só o elo do
   meio, que fica versionado em `certs/`. Desligar a verificação resolveria em
   uma linha e destruiria a única garantia de que o texto veio mesmo do STF,
   que é o ponto inteiro de ingerir da fonte oficial.

2. **Sem User-Agent de navegador, 403.** Não é bloqueio a robô — é filtro de
   borda, e o mesmo endereço responde 200 com o cabeçalho presente.

3. **A página de listagem que parece a certa é uma casca de JavaScript.**
   `verTexto.asp?servico=jurisprudenciaSumulaVinculante` devolve 54 KB sem uma
   súmula dentro. Quem tem o conteúdo no HTML é `sumariosumulas.asp?base=26`,
   e cada enunciado mora na página da própria súmula, na linha logo abaixo do
   título — antes de "Precedente Representativo".

**Súmula cancelada não entra.** O índice as marca com "(cancelada)" e elas
continuam existindo no acervo do tribunal, mas exibir enunciado cancelado como
se fosse direito vigente é o pior defeito possível numa base de estudo: quem
decora descobre na prova. A tabela não tem coluna para isso, e inventar uma
sem saber como a tela vai apresentar seria pior do que deixar de fora.
"""

from __future__ import annotations

import argparse
import html
import os
import re
import ssl
import subprocess
import sys
import time
import unicodedata
import urllib.request
from pathlib import Path

BASE = "https://portal.stf.jus.br/jurisprudencia/sumariosumulas.asp"

# O portal separa as duas séries por um número de base interno. São
# numerações independentes: a Súmula Vinculante 1 e a Súmula 1 tratam de
# assuntos diferentes, e é por isso que a chave no banco inclui `vinculante`.
BASES = {
    "vinculante": 26,
    "comum": 30,
}

INDICE = f"{BASE}?base={BASES['vinculante']}"
CERTIFICADOS = Path(__file__).resolve().parent.parent / "certs" / "stf-bundle.pem"

CABECALHOS = {
    # Ver a armadilha 2 do docstring: sem isto, 403.
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,*/*",
    "Accept-Language": "pt-BR,pt;q=0.9",
    "Referer": INDICE,
}

def _link(base: int) -> re.Pattern[str]:
    return re.compile(
        rf'<a[^>]+href="(sumariosumulas\.asp\?base={base}&(?:amp;)?sumula=\d+)"'
        r'[^>]*>\s*(S[úu]mula(?:\s+Vinculante)?(?:&nbsp;|\s)+(\d+))(.{0,60}?)</a>',
        re.I | re.S,
    )


CANCELADA = re.compile(r"cancel", re.I)


def _contexto() -> ssl.SSLContext:
    if not CERTIFICADOS.exists():
        raise SystemExit(
            f"cadeia ausente em {CERTIFICADOS}. Recrie com:\n"
            "  curl -sSo /tmp/i.crt "
            "http://secure.globalsign.com/cacert/gsgccr6alphasslca2025.crt\n"
            "  openssl x509 -inform DER -in /tmp/i.crt -out /tmp/i.pem\n"
            "  cat /tmp/i.pem /etc/ssl/certs/GlobalSign_Root_CA_-_R6.pem "
            f"> {CERTIFICADOS}"
        )
    return ssl.create_default_context(cafile=str(CERTIFICADOS))


def baixar(url: str, contexto: ssl.SSLContext) -> str:
    pedido = urllib.request.Request(url, headers=CABECALHOS)
    with urllib.request.urlopen(pedido, timeout=40, context=contexto) as resposta:
        bruto = resposta.read()
    # O portal declara ISO-8859-1 em algumas páginas e UTF-8 em outras; o
    # texto tem acento em toda linha, e errar aqui não quebra nada — só
    # grava "Súmula" com losango no meio, para sempre.
    for codificacao in ("utf-8", "latin-1"):
        try:
            return bruto.decode(codificacao)
        except UnicodeDecodeError:
            continue
    return bruto.decode("utf-8", errors="replace")


def _linhas(pagina: str) -> list[str]:
    limpo = re.sub(r"<script.*?</script>|<style.*?</style>", "", pagina, flags=re.S | re.I)
    texto = html.unescape(re.sub(r"<[^>]+>", "\n", limpo))
    texto = texto.replace("\xa0", " ")
    return [linha.strip() for linha in texto.split("\n") if linha.strip()]


def texto_da_sumula(pagina: str, numero: int, vinculante: bool = True) -> str | None:
    """O enunciado é a linha logo abaixo do título, e só ela.

    O resto da página são precedentes, legislação citada e acórdãos — texto
    que fala *sobre* a súmula. Confundir os dois encheria o banco de ementa
    de julgado no lugar do enunciado, e ninguém perceberia lendo o total.
    """
    linhas = _linhas(pagina)
    rotulo = r"S[úu]mula\s+Vinculante" if vinculante else r"S[úu]mula"
    alvo = re.compile(rf"^{rotulo}\s+{numero}\b", re.I)
    for i, linha in enumerate(linhas[:-1]):
        if alvo.match(linha):
            candidato = linhas[i + 1]
            if len(candidato) < 25 or candidato.lower().startswith("precedente"):
                return None
            return re.sub(r"\s+", " ", candidato).strip()
    return None


def _slug(numero: int, vinculante: bool) -> str:
    # Duas séries, dois prefixos: `sumula-vinculante-4` e `sumula-stf-473` são
    # enunciados distintos e precisam de URLs distintas.
    return f"sumula-vinculante-{numero}" if vinculante else f"sumula-stf-{numero}"


def _lit(valor: str) -> str:
    return "'" + valor.replace("'", "''") + "'"


def _sem_acento(texto: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", texto)
        if unicodedata.category(c) != "Mn"
    )


def coletar(
    vinculante: bool = True, pausa: float = 0.6
) -> list[tuple[int, str]]:
    contexto = _contexto()
    base = BASES["vinculante" if vinculante else "comum"]
    indice = baixar(f"{BASE}?base={base}", contexto)

    entradas: list[tuple[int, str]] = []
    vistos: set[int] = set()
    canceladas: list[int] = []

    for achado in _link(base).finditer(indice):
        caminho, _, numero_txt, cauda = achado.groups()
        numero = int(numero_txt)
        if numero in vistos:
            continue
        vistos.add(numero)
        if CANCELADA.search(_sem_acento(cauda)):
            canceladas.append(numero)
            continue

        url = "https://portal.stf.jus.br/jurisprudencia/" + caminho.replace(
            "&amp;", "&"
        )
        pagina = baixar(url, contexto)
        texto = texto_da_sumula(pagina, numero, vinculante)
        if texto:
            entradas.append((numero, texto))
            print(f"  {numero:>3}  {texto[:78]}")
        else:
            print(f"  {numero:>3}  ✗ enunciado não encontrado", file=sys.stderr)
        time.sleep(pausa)

    if canceladas:
        print(f"\n  canceladas, fora da carga: {canceladas}", file=sys.stderr)
    return entradas


def sql(entradas: list[tuple[int, str]], vinculante: bool) -> str:
    marca = "true" if vinculante else "false"
    valores = ",\n  ".join(
        f"('stf', {numero}, {_lit(_slug(numero, vinculante))}, {_lit(texto)},"
        f" {marca}, false)"
        for numero, texto in sorted(entradas)
    )
    return (
        "insert into public.sumulas\n"
        "  (tribunal, numero, slug, texto, vinculante, indexavel)\nvalues\n  "
        + valores
        # A chave inclui `vinculante`: a Súmula Vinculante 1 e a Súmula 1 são
        # enunciados diferentes, e sem isso a carga de uma série sobrescreveria
        # a outra em silêncio, com o total continuando certo.
        #
        # Mesma regra dos artigos: texto oficial se atualiza sozinho enquanto
        # ninguém escreveu sobre ele. A partir do comentário, a linha é
        # trabalho autoral e mudança de redação vira revisão humana.
        + "\non conflict (tribunal, numero, vinculante) do update set\n"
        "  texto = excluded.texto,\n"
        "  slug = excluded.slug\n"
        "where public.sumulas.comentario = '{}';\n"
    )


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--sql", help="grava o SQL neste caminho em vez de aplicar")
    p.add_argument("--carregar", action="store_true", help="aplica no banco")
    p.add_argument("--pausa", type=float, default=0.6)
    p.add_argument(
        "--serie", choices=("vinculante", "comum"), default="vinculante",
        help="vinculantes (62) ou súmulas comuns do STF (736)",
    )
    args = p.parse_args(argv)

    vinculante = args.serie == "vinculante"
    rotulo = "Súmulas Vinculantes" if vinculante else "Súmulas do STF"
    print(f"→ lendo as {rotulo} do portal oficial")
    entradas = coletar(vinculante=vinculante, pausa=args.pausa)
    if not entradas:
        print("✗ nenhuma súmula lida", file=sys.stderr)
        return 1
    print(f"\n{len(entradas)} {rotulo.lower()} em vigor")

    comando = sql(entradas, vinculante)
    if args.sql:
        Path(args.sql).write_text(comando, encoding="utf-8")
        print(f"SQL gravado em {args.sql}")

    if not args.carregar:
        if not args.sql:
            print("\n(ensaio — nada gravado. Repita com --carregar.)")
        return 0

    conexao = os.environ.get("SUPABASE_CONNECTION_STRING")
    if not conexao:
        print("✗ defina SUPABASE_CONNECTION_STRING", file=sys.stderr)
        return 1

    resultado = subprocess.run(
        ["psql", conexao, "-v", "ON_ERROR_STOP=1", "-q", "-f", "-"],
        input=comando, capture_output=True, text=True,
    )
    if resultado.returncode != 0:
        print(f"✗ psql falhou:\n{resultado.stderr[:800]}", file=sys.stderr)
        return 1
    print("✓ súmulas carregadas")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
