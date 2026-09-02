"""Descoberta automática das provas no arquivo oficial da OAB.

`examedeordem.oab.org.br/EditaisProvas?NumeroExame=<id>` lista todos os PDFs
de uma edição, com rótulos legíveis e datados:

    27/04/2025 - Caderno de Prova - Tipo 1
    14/05/2025 - Gabaritos Definitivos - Prova Objetiva (1ª fase)

O `id` é interno, não é o número da edição — o mapa sai do próprio `<select>`
da página índice. A data da prova vem do rótulo do caderno, e não de palpite.
"""

from __future__ import annotations

import html
import json
import re
import time
import unicodedata
import urllib.parse
import urllib.request
from dataclasses import dataclass

BASE = "https://examedeordem.oab.org.br/EditaisProvas?NumeroExame="
UA = "OABase-ingest/1.0 (+coleta de provas públicas para estudo)"

ROMANOS = {
    "I": 1, "V": 5, "X": 10, "L": 50, "C": 100, "D": 500, "M": 1000,
}


@dataclass
class Edicao:
    numero: int
    id_interno: str
    nome: str
    prova_url: str | None = None
    gabarito_url: str | None = None
    data_prova: str | None = None
    # Edições mais antigas só publicam o gabarito preliminar no arquivo; o
    # "Resultado Definitivo" daquela época é lista de aprovados, não gabarito.
    # Misturar as duas origens sem registrar qual foi usada é perder
    # procedência — o mesmo erro das datas inventadas no seed.
    gabarito_definitivo: bool = False

    @property
    def completa(self) -> bool:
        return bool(self.prova_url and self.gabarito_url and self.data_prova)


def _obter(url: str, timeout: int = 90, tentativas: int = 6) -> bytes:
    """GET com recuo exponencial.

    O servidor da OAB devolve 502 depois de algumas dezenas de requisições
    seguidas — é limitação de banda, não bloqueio: esperar e repetir resolve.
    Tratar isso como falha definitiva descartaria metade do arquivo.
    """
    espera = 5.0
    for tentativa in range(1, tentativas + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except Exception as erro:
            transitorio = any(
                marca in str(erro) for marca in ("502", "503", "504", "429", "timed out")
            )
            if tentativa == tentativas or not transitorio:
                raise
            time.sleep(espera)
            espera *= 2
    raise RuntimeError("inalcançável")


def _baixar(url: str) -> str:
    return _obter(url).decode("utf-8", errors="ignore")


def _sem_acento(texto: str) -> str:
    # `ª` e `º` (indicadores ordinais) não são marcas combinantes: o NFD não
    # os decompõe e "1ª fase" nunca vira "1a fase". Trocar antes.
    texto = texto.replace("ª", "a").replace("º", "o").replace("°", "o")
    return "".join(
        c for c in unicodedata.normalize("NFD", texto)
        if unicodedata.category(c) != "Mn"
    )


def _romano(s: str) -> int | None:
    if not s or any(c not in ROMANOS for c in s):
        return None
    total = 0
    for i, c in enumerate(s):
        v = ROMANOS[c]
        total += -v if i + 1 < len(s) and v < ROMANOS[s[i + 1]] else v
    return total or None


def numero_da_edicao(nome: str) -> int | None:
    """"47º EXAME…" → 47 · "IV EXAME…" → 4 · "…2010.2" → 2."""
    if m := re.search(r"(\d+)\s*[ºo°]\s*EXAME", nome, re.I):
        return int(m.group(1))
    if m := re.search(r"UNIFICADO\s+2010\.(\d)", nome, re.I):
        return int(m.group(1))
    if m := re.match(r"\s*([IVXLC]+)\s+EXAME", _sem_acento(nome).upper()):
        return _romano(m.group(1))
    return None


def listar_edicoes() -> list[Edicao]:
    pagina = _baixar(BASE + "0")
    opcoes = re.findall(
        r'<option[^>]*value="(\d+)"[^>]*>(.*?)</option>', pagina, flags=re.S
    )
    edicoes = []
    for valor, rotulo in opcoes:
        nome = " ".join(html.unescape(re.sub(r"<[^>]+>", " ", rotulo)).split())
        numero = numero_da_edicao(nome)
        if numero and valor != "0":
            edicoes.append(Edicao(numero=numero, id_interno=valor, nome=nome))
    return sorted(edicoes, key=lambda e: e.numero, reverse=True)


def _para_iso(ddmmaaaa: str) -> str:
    d, m, a = ddmmaaaa.split("/")
    return f"{a}-{m}-{d}"


def detalhar(edicao: Edicao, pausa: float = 0.7) -> Edicao:
    """Preenche as URLs de prova e gabarito e a data da prova."""
    time.sleep(pausa)  # o arquivo é público, mas não é motivo para socá-lo
    pagina = _baixar(BASE + edicao.id_interno)

    pares = re.findall(
        r'<a[^>]+href="(https?://s\.oab\.org\.br[^"]+\.pdf)"[^>]*>(.*?)</a>',
        pagina, flags=re.S | re.I,
    )

    preliminar: tuple[str, str | None] | None = None

    for url, bruto in pares:
        rotulo = " ".join(html.unescape(re.sub(r"<[^>]+>", " ", bruto)).split())
        # Os rótulos alternam hífen simples e travessão; normalizar evita
        # depender de qual deles a OAB usou naquela edição.
        normalizado = _sem_acento(rotulo).lower().replace("–", "-").replace("—", "-")
        data = m.group(1) if (m := re.match(r"(\d{2}/\d{2}/\d{4})", rotulo)) else None

        # Reaplicações (Salvador, Porto Velho…) são provas paralelas, com
        # numeração e gabarito próprios. Não podem entrar como a prova oficial.
        if "reaplicacao" in normalizado or "examinandos de" in normalizado:
            continue
        if "1a fase" not in normalizado and "objetiva" not in normalizado \
                and "caderno de prova" not in normalizado:
            continue

        # O rótulo do caderno muda com a época:
        #   até o 17º ....... "Caderno de Prova 01"  (numerado)
        #   do 18º em diante  "Caderno de Prova - Tipo 1"
        # Sem aceitar as duas formas, as dezesseis primeiras edições ficam
        # invisíveis — foi por isso que elas constavam como "sem prova".
        #
        # O que NÃO pode entrar: "Caderno de Prova (Direito Civil)" e
        # semelhantes. Esses são os cadernos da 2ª fase, publicados na mesma
        # página, um por área de opção — prova discursiva, não objetiva.
        eh_caderno = "caderno de prova" in normalizado and "(" not in rotulo
        tipo_um = (
            "tipo 1" in normalizado
            or re.search(r"caderno de prova\s*0?1\b", normalizado) is not None
        )

        if eh_caderno and tipo_um:
            edicao.prova_url = url
            if data:
                edicao.data_prova = _para_iso(data)
        elif re.search(r"gabaritos? definitivos?", normalizado):
            edicao.gabarito_url = url
            edicao.gabarito_definitivo = True
        elif re.search(r"gabaritos? preliminar", normalizado):
            preliminar = (url, data)

    # Só cai no preliminar quando não existe definitivo publicado.
    if not edicao.gabarito_url and preliminar:
        edicao.gabarito_url = preliminar[0]
        edicao.gabarito_definitivo = False

    return edicao


def _copia_no_arquivo(url: str) -> str | None:
    """URL da cópia do Internet Archive, se existir.

    O `id_` no caminho pede os bytes originais, sem a barra de navegação que
    o Wayback injeta em página HTML. Sem ele, um PDF volta embrulhado e
    `pdftotext` recusa.
    """
    consulta = (
        "https://archive.org/wayback/available?url="
        + urllib.parse.quote(url, safe="")
    )
    try:
        req = urllib.request.Request(consulta, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=45) as r:
            dados = json.load(r)
    except Exception:
        return None

    instantaneo = (dados.get("archived_snapshots") or {}).get("closest")
    if not instantaneo or not instantaneo.get("available"):
        return None
    return re.sub(r"/web/(\d+)/", r"/web/\1id_/", instantaneo["url"], count=1)


def baixar_arquivo(url: str, destino) -> None:
    """Baixa da OAB; se a origem falhar de vez, tenta o Internet Archive.

    Não é redundância decorativa. Todas as edições de 3º a 31º devolvem 502
    permanente em `s.oab.org.br` — o corte é exato entre o 31º e o 32º, e
    parece migração de armazenamento que deixou os objetos antigos para trás.
    São documentos públicos, e o Archive tem cópia de parte deles.

    A cópia arquivada é o **mesmo arquivo** publicado pela banca, não uma
    transcrição: a procedência do enunciado continua sendo a fonte oficial.
    """
    try:
        destino.write_bytes(_obter(url, timeout=180))
        return
    except Exception as erro_origem:
        alternativa = _copia_no_arquivo(url)
        if not alternativa:
            raise
        print(f"    origem falhou ({erro_origem}); usando cópia do Internet Archive")
        # Sem `tentativas` alto aqui: o Archive limita por IP e responde 429
        # em série. Insistir muito numa execução em lote atrasa todas as
        # outras edições sem aumentar a chance desta.
        destino.write_bytes(_obter(alternativa, timeout=240, tentativas=3))
