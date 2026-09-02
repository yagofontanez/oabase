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
| 3º–31º | **Bloqueadas na origem.** `s.oab.org.br` devolve **502 em todas**. Medido edição por edição: o 32º responde 200 e o 31º, 28º, 24º, 20º, 17º, 14º, 10º, 6º e 3º devolvem 502. O corte é exatamente entre o 31º e o 32º — tem cara de migração de armazenamento em que os objetos antigos não foram junto. Não é rate limit: espaçar, trocar User-Agent, mandar Referer e usar GET em vez de HEAD não muda nada. |
| 30º e 31º | Únicas duas com cópia no Internet Archive (das demais o Wayback não guardou nada — verificado uma a uma). **Ainda não recuperadas:** o Archive responde 429 a este IP de forma persistente, inclusive depois de cinco minutos sem nenhuma requisição. Insistir prolonga o bloqueio; a tentativa se faz de outra rede, ou noutro dia. |
| 2º | O arquivo não publica gabarito desta edição. |
| 35º | A página 17 do caderno tem a codificação de fonte corrompida no PDF de origem (`pdffonts` mostra `uni = no` em todas as fontes) — as questões 57 a 59 extraem como lixo. Sem OCR, não há o que fazer. |
| 47º | Prova ainda não aplicada. |

A descoberta já resolve as **44 edições que têm par prova+gabarito publicado**
(de 46 listadas; faltam o 2º, sem gabarito, e o 47º, não aplicado), com as
datas corretas vindas do edital. O que falta é só o arquivo do outro lado
responder. No dia em que responder, um comando fecha o serviço:

```bash
python3 -m oabase_ingest.lote --de 2 --ate 46 --carregar
```

O `lote` não aborta na primeira falha: cada edição que não baixa entra em
`pendentes` no resumo final, com o motivo. Rodar de novo é seguro — a carga é
idempotente por edição.

## Variações reais entre edições

Cada uma destas quebrou o parser e foi corrigida com dado real na mão:

- **Rótulo do caderno**: `Caderno de Prova - Tipo 1` do 18º em diante,
  `Caderno de Prova 01` até o 17º. Aceitar só a primeira forma deixava as
  dezesseis edições mais antigas invisíveis na descoberta — elas apareciam no
  manifesto como "sem prova" quando na verdade o link estava lá. Cuidado ao
  afrouxar: `Caderno de Prova (Direito Civil)` também casa com "caderno de
  prova", e é o caderno da **2ª fase**, um por área de opção. O filtro exige
  ausência de parêntese no rótulo.
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

# Legislação

`legislacao.py` baixa o texto oficial compilado do `planalto.gov.br` e carrega
em `artigos`. Oito códigos, **5.756 artigos**:

| Norma | Artigos | Norma | Artigos |
|---|---:|---|---:|
| Código Civil | 2.081 | Código Penal | 387 |
| Código de Processo Civil | 1.073 | Constituição Federal | 272 |
| CLT | 979 | CDC | 130 |
| Código de Processo Penal | 745 | Estatuto da OAB | 89 |

```bash
python3 -m oabase_ingest.legislacao --sql /tmp/l.sql   # ensaio, não grava
python3 -m oabase_ingest.legislacao --carregar
```

## O que a fonte tem de traiçoeiro

O HTML do Planalto é antigo, em ISO-8859-1, e quebra linha no meio das frases —
um artigo não é um parágrafo do HTML. Cada item abaixo custou uma rodada de
depuração e está coberto no código:

- **User-Agent.** Com o padrão do `curl`/`urllib` o servidor não responde e a
  requisição estoura o tempo. Com cabeçalho de navegador, responde em segundos.
- **A redação vigente é a última, não a primeira.** O compilado imprime o texto
  original e, abaixo, cada nova redação. Guardar a primeira publicaria o art.
  37 da CF na redação de 1988, revogada pela EC 19/1998.
- **Separador de milhar inconsistente.** O Código Civil escreve `Art. 1.337` e
  `Art. 1337` na mesma página. Ler só três dígitos transformava o 1337 em 133 e
  sobrescrevia o artigo 133.
- **Travessão da grafia antiga.** `Art. 13 - O resultado...` no CP e na CLT.
  Lido como artigo com letra, virava "13-O" e sumia com o artigo 13 — quase 300
  artigos assim entre os dois. O que separa: a letra de verdade vem colada
  (`Art. 58-A`), o travessão vem cercado de espaços.
- **Superscritos soltos.** `<sup>o</sup>` e `§` caem em linhas próprias. O
  ordinal cola na linha anterior; o `§` cola na seguinte, porque abre o que vem
  depois.
- **`§` citado não é `§` estrutural.** O caput do art. 179 do CPP começa em "No
  caso do § 1º do art. 159". Parágrafo de verdade abre frase nova, então vem
  seguido de maiúscula, travessão ou parêntese.
- **Sumário no topo.** A Constituição lista o ADCT no índice antes do art. 1º;
  parar na primeira ocorrência do marcador devolvia zero artigo.

## Cobertura

Vale conferir a cobertura contra o número final de cada código antes de confiar
na carga. Hoje: zero falhas de parser nos oito. As lacunas que restam são
artigos que a própria fonte não imprime — revogados sem texto e vetados (os
arts. 15, 16, 62, 85, 86, 89, 96 e 109 do CDC, por exemplo, foram vetados).

## Comentário é autoral

Este módulo carrega texto de lei e nada mais. Tudo entra com
`indexavel = false`, e o upsert tem `where public.artigos.comentario = '{}'`:
recarregar nunca passa por cima de análise escrita por gente.
