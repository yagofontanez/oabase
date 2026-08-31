# Pipeline de ingestão

Transforma um caderno de prova da FGV em questões estruturadas no Supabase.

Roda com **stdlib do Python + `pdftotext` + `psql`**. Nenhum `pip install`:
qualquer máquina com poppler-utils e o cliente do Postgres executa.

```bash
cd ingest
export SUPABASE_CONNECTION_STRING=...        # só necessário com --carregar

python3 -m oabase_ingest.pipeline \
    --prova   caderno-43.pdf \
    --gabarito gabarito-43.pdf \
    --edicao 43 --ano 2025 --data 2025-04-27
```

Sem `--carregar` roda em **modo seco**: extrai, segmenta, valida e escreve
`saida/exame-N.json` sem tocar no banco. É assim que se audita uma prova
antes de publicar. Com `--carregar`, faz o upsert.

## Descoberta automática

`descobrir.py` lê o arquivo oficial em
`examedeordem.oab.org.br/EditaisProvas?NumeroExame=<id>`, que lista todos os
PDFs de cada edição com rótulos datados. O `id` é interno e sai do `<select>`
da página índice; a data da prova vem do rótulo do caderno, não de palpite.

```bash
python3 -m oabase_ingest.lote --manifesto        # mapeia as 46 edições
python3 -m oabase_ingest.lote --de 32 --ate 46   # modo seco
python3 -m oabase_ingest.lote --de 32 --ate 46 --carregar
```

## Estado da cobertura

| Faixa | Situação |
|---|---|
| 32º–46º | **14 ingeridas** (o 35º falha, ver abaixo) |
| 18º–31º | Bloqueadas: `s.oab.org.br` devolve **502 persistente** nesses arquivos — falha na origem, não rate limit. Confirmado com GET direto: o 32º responde 200, o 31º não. |
| 2º–17º | O arquivo não usa o rótulo "Caderno de Prova - Tipo 1" nessa época; a descoberta não os encontra. |
| 35º | A página 17 do caderno tem a codificação de fonte corrompida no PDF de origem (`pdffonts` mostra `uni = no` em todas as fontes) — as questões 57 a 59 extraem como lixo. Sem OCR, não há o que fazer. |
| 47º | Prova ainda não aplicada. |

## Variações reais entre edições

Cada uma destas quebrou o parser e foi corrigida com dado real na mão:

- **Marcação da alternativa**: `(A)` nas provas recentes, `A)` nas antigas.
- **Cabeçalho do gabarito**: `PROVA TIPO 1`, `UNIFICADO - TIPO 1` e `PROVA 1`
  aparecem em edições diferentes. A regra que funciona é aceitar a linha com
  **uma única** ocorrência de tipo — a tabela de conversão do fim do arquivo
  traz quatro de uma vez.
- **Fim da questão**: em vez de ancorar no texto do questionário de percepção
  (que muda de edição para edição), a regra é estrutural: uma questão tem
  exatamente um conjunto A–D, e reencontrar uma letra significa que saímos
  dela. Sem isso, as opções do questionário sobrescreviam silenciosamente as
  alternativas da questão 80.
- **Alternativa de uma palavra**: "Francesa.", "Abono." são legítimas; a
  validação de comprimento mínimo precisou baixar de 8 para 3 caracteres.
- **Gabarito preliminar**: até o 32º, o arquivo só publica o preliminar. A
  procedência fica registrada em `exames.gabarito_definitivo`.

## As três armadilhas que o pipeline resolve

**Duas colunas.** O caderno é diagramado em duas colunas e `pdftotext -layout`
entrelaça as duas na mesma linha — o enunciado da questão 1 sai grudado no da
questão 3. `extrair.py` recorta cada coluna pela caixa de página e extrai uma
de cada vez. Sem isso a segmentação produz lixo convincente, que é o pior tipo
de erro porque passa despercebido.

**Números falsos.** A âncora de segmentação é o número da questão sozinho numa
linha, mas enunciados estão cheios de números soltos (artigo, ano, valor). O
parser procura sempre e apenas o **próximo número esperado**, em ordem: um "13"
no meio do texto não engana quem está à procura da questão 12.

**Fim da prova.** Depois da última questão vem o questionário de percepção. Sem
âncora de fim, ele é absorvido pela alternativa (D) da questão 80.

## Validação antes da escrita

Nada é gravado se alguma questão falhar: total diferente do esperado,
alternativa faltando, enunciado curto demais, ou questão sem gabarito. É mais
barato falhar a carga inteira do que descobrir dado corrompido com centenas de
páginas no ar.

## Classificação por disciplina

`classificar.py` usa um **léxico determinístico**, não LLM: roda sem chave de
API, é auditável linha a linha e erra de forma previsível.

`sequenciar.py` corrige o resultado usando um fato da prova: a FGV monta o
caderno em **blocos contíguos por disciplina**. Questão sem classificação entre
vizinhos iguais herda a disciplina deles; questão isolada discordando de ambos
os vizinhos, com confiança baixa, é tratada como erro de léxico.

**Acurácia medida no 43º Exame: ~78%** contra revisão manual — abaixo da barra
de 90% do projeto. Por isso a carga marca `questoes.disciplina_confirmada =
false`, e nada que dependa de disciplina (estatísticas, filtros, questões
similares) deve ler linha não confirmada.

Enunciado, alternativas, gabarito e anulação vêm de fonte oficial e são
confiáveis. A disciplina é palpite até alguém revisar.

## Idempotência

O upsert bate em `(exame_id, numero)` — a chave natural. Rodar dez vezes dá o
mesmo resultado de rodar uma. O `slug` é o único campo deliberadamente **não**
atualizado no conflito: reclassificar disciplina não pode mudar a URL de uma
página já indexada.
