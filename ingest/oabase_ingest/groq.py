"""Cliente mínimo da Groq, em JSON, para os classificadores.

Três coisas que custaram tempo e ficam registradas aqui para não custarem de
novo:

1. **`User-Agent` de urllib é barrado com 403 na borda.** O mesmo corpo, pelo
   curl, passa — o que faz o erro parecer chave inválida sem ser.
2. **O `gpt-oss` gasta orçamento de saída raciocinando.** No padrão, um lote
   de vinte itens termina com `finish_reason: length`: a resposta é cortada no
   meio do JSON e o lote inteiro volta vazio, sem erro nenhum. Esforço baixo e
   teto largo resolvem — a tarefa é rotular, não deliberar.
3. **429 é fila, e ela diz quanto esperar.** Chutar oito segundos quando o
   cabeçalho pede quarenta gasta as tentativas e devolve vazio; foi assim que
   um exame inteiro ficou sem classificação sem nada apontar a causa.
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request

URL = "https://api.groq.com/openai/v1/chat/completions"
MODELO = os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b")


def conversar(
    chave: str,
    sistema: str,
    usuario: str,
    *,
    tentativas: int = 6,
    teto: int = 3000,
) -> dict:
    """Uma pergunta, uma resposta em JSON. Falha devolve `{}` — nunca levanta.

    Quem chama está no meio de um lote de centenas: uma exceção aqui pararia a
    carga inteira por causa de um item, e o item volta na execução seguinte de
    graça, porque a origem no banco só muda quando o dado chega.
    """
    corpo = json.dumps(
        {
            "model": MODELO,
            "temperature": 0,
            "reasoning_effort": "low",
            "max_completion_tokens": teto,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": sistema},
                {"role": "user", "content": usuario},
            ],
        }
    ).encode()

    pedido = urllib.request.Request(
        URL,
        data=corpo,
        headers={
            "Authorization": f"Bearer {chave}",
            "Content-Type": "application/json",
            "User-Agent": "oabase-ingest/1.0",
        },
    )

    for tentativa in range(tentativas):
        try:
            with urllib.request.urlopen(pedido, timeout=180) as r:
                dados = json.loads(r.read())
            return json.loads(dados["choices"][0]["message"]["content"])
        except urllib.error.HTTPError as e:
            espera = 10.0 * (tentativa + 1)
            if e.code == 429:
                try:
                    espera = max(espera, float(e.headers.get("retry-after")))
                except (TypeError, ValueError):
                    pass
            print(f"    (rede: {e}; espera {espera:.0f}s)", file=sys.stderr)
            time.sleep(espera)
        except (urllib.error.URLError, TimeoutError) as e:
            espera = 10.0 * (tentativa + 1)
            print(f"    (rede: {e}; espera {espera:.0f}s)", file=sys.stderr)
            time.sleep(espera)
        except (KeyError, ValueError) as e:
            print(f"    (resposta ilegível: {e})", file=sys.stderr)
            return {}
    return {}
