"""Preenche `questoes.embedding`.

A coluna existe no schema desde o começo e está vazia: o projeto não tem
chave de nenhum serviço de embeddings — a Groq, que gera o plano de estudos,
não oferece esse endpoint. Enquanto isso, `questoes_parecidas` funciona com
dispositivo em comum e semelhança de texto, e passa a usar o vetor sozinha
assim que ele existir.

Este módulo fala o protocolo `POST /embeddings` da OpenAI, que é o mesmo da
Vercel AI Gateway, do Azure OpenAI e de vários provedores compatíveis. A
escolha é de quem configura, não do código:

    EMBEDDINGS_URL=https://api.openai.com/v1/embeddings
    EMBEDDINGS_API_KEY=...
    EMBEDDINGS_MODELO=text-embedding-3-small   # 1536 dimensões

**1536 não é negociável**: é o tamanho declarado em `vector(1536)`. Um modelo
de outra dimensão é recusado antes de gravar qualquer coisa — meia base com
vetores de tamanhos diferentes é pior do que base nenhuma.

Uso:
    python3 -m oabase_ingest.embeddings --limite 50   # ensaio curto
    python3 -m oabase_ingest.embeddings               # tudo que falta
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request

DIMENSOES = 1536
LOTE = 64


def psql(sql: str, conexao: str) -> str:
    resultado = subprocess.run(
        ["psql", conexao, "-tAF\x1f", "-v", "ON_ERROR_STOP=1", "-c", sql],
        capture_output=True,
        text=True,
    )
    if resultado.returncode != 0:
        raise SystemExit(f"psql falhou:\n{resultado.stderr}")
    return resultado.stdout


def embeddings(textos: list[str], url: str, chave: str, modelo: str) -> list[list[float]]:
    corpo = json.dumps({"model": modelo, "input": textos}).encode("utf-8")
    pedido = urllib.request.Request(
        url,
        data=corpo,
        headers={
            "Authorization": f"Bearer {chave}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(pedido, timeout=120) as resposta:
            dados = json.loads(resposta.read())
    except urllib.error.HTTPError as erro:
        detalhe = erro.read().decode("utf-8", "replace")[:300]
        raise SystemExit(f"Provedor respondeu {erro.code}: {detalhe}")

    vetores = [item["embedding"] for item in dados["data"]]
    for vetor in vetores:
        if len(vetor) != DIMENSOES:
            raise SystemExit(
                f"O modelo {modelo} devolve {len(vetor)} dimensões; a coluna "
                f"é vector({DIMENSOES}). Escolha outro modelo ou altere a "
                f"coluna — nunca grave metade da base com o tamanho errado."
            )
    return vetores


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--conexao", default=None)
    parser.add_argument("--limite", type=int, default=0, help="0 = tudo que falta")
    parser.add_argument(
        "--refazer",
        action="store_true",
        help="recalcula inclusive o que já tem vetor",
    )
    argumentos = parser.parse_args()

    conexao = argumentos.conexao or os.environ.get("SUPABASE_CONNECTION_STRING")
    if not conexao:
        raise SystemExit("Defina SUPABASE_CONNECTION_STRING ou passe --conexao.")

    chave = os.environ.get("EMBEDDINGS_API_KEY")
    if not chave:
        raise SystemExit(
            "EMBEDDINGS_API_KEY não configurada. Sem ela não há o que fazer — "
            "e `questoes_parecidas` continua funcionando por dispositivo em "
            "comum e semelhança de texto."
        )
    url = os.environ.get("EMBEDDINGS_URL", "https://api.openai.com/v1/embeddings")
    modelo = os.environ.get("EMBEDDINGS_MODELO", "text-embedding-3-small")

    filtro = "" if argumentos.refazer else "where q.embedding is null"
    limite = f"limit {argumentos.limite}" if argumentos.limite > 0 else ""
    linhas = psql(
        f"select q.id, replace(q.enunciado, E'\\n', ' ') from public.questoes q "
        f"{filtro} order by q.id {limite}",
        conexao,
    )

    pendentes = [
        linha.split("\x1f", 1)
        for linha in linhas.strip().split("\n")
        if linha
    ]
    if not pendentes:
        print("nada a fazer: todas as questões já têm vetor", file=sys.stderr)
        return 0

    print(f"{len(pendentes)} questões · modelo {modelo}", file=sys.stderr)

    feitas = 0
    for inicio in range(0, len(pendentes), LOTE):
        fatia = pendentes[inicio : inicio + LOTE]
        vetores = embeddings([t for _, t in fatia], url, chave, modelo)

        # `update ... from (values ...)` faz o lote inteiro numa ida ao banco.
        valores = ",".join(
            f"('{qid}'::uuid, '[{','.join(f'{v:.6f}' for v in vetor)}]'::extensions.vector)"
            for (qid, _), vetor in zip(fatia, vetores)
        )
        psql(
            "update public.questoes q set embedding = novo.vetor "
            f"from (values {valores}) as novo(id, vetor) where q.id = novo.id",
            conexao,
        )
        feitas += len(fatia)
        print(f"  {feitas}/{len(pendentes)}", file=sys.stderr)

    print("pronto", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
