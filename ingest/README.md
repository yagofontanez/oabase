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
| 3º–46º | **43 ingeridas**, 3.460 questões — todas as publicadas menos o 35º |
| 2º | O arquivo não publica gabarito desta edição. |
| 35º | Único buraco: a página 17 do caderno tem a codificação de fonte corrompida no PDF de origem (`pdffonts` mostra `uni = no` em todas as fontes) — as questões 57 a 59 extraem como lixo. Sem OCR, não há o que fazer. |
| 47º | Prova ainda não aplicada. |

São **44 edições com par prova+gabarito publicado** (de 46 listadas; faltam o
2º, sem gabarito, e o 47º, não aplicado). Um comando faz todas:

```bash
python3 -m oabase_ingest.lote --de 2 --ate 46 --carregar
```

O `lote` não aborta na primeira falha: cada edição que não baixa entra em
`pendentes` no resumo final, com o motivo. Rodar de novo é seguro — a carga é
idempotente por edição, e o download é pulado quando o PDF já está em
`provas/`.

### O 502 era o esquema da URL, não o servidor

Os links saem da página do arquivo em `http://`. Em `http://`, o
`s.oab.org.br` devolve **502 para tudo publicado até o 31º Exame** e 200 para
o que é recente — o corte é exato entre o 31º e o 32º. O mesmo endereço em
`https://` devolve 200 e o PDF inteiro, em toda a faixa.

Isso custou uma investigação inteira na direção errada: como o corte era
limpo por edição, a explicação óbvia era migração de armazenamento que tinha
deixado os objetos antigos para trás, e as 29 edições foram dadas como
perdidas. Espaçamento, User-Agent, Referer, GET no lugar de HEAD e cópia no
Internet Archive foram todos testados — menos trocar quatro caracteres na
URL. Quando um erro de servidor se distribui com fronteira exata demais,
desconfie do cliente antes de desconfiar do servidor.

`_em_https()` em `descobrir.py` sobe o esquema dentro de `_obter`, então vale
também para os manifestos já salvos com `http://`.

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
- **Âncora da questão**: da 32ª em diante o número aparece sozinho numa linha;
  até a 31ª vem como `Questão 5`. As duas formas **não** podem ser aceitas ao
  mesmo tempo — nas provas antigas o rodapé traz o número da página sozinho
  numa linha, e o parser casava com ele antes de chegar à questão. Era assim
  que a 20ª "encontrava" dez questões que eram números de página; só o total
  errado impediu que virassem conteúdo. Por isso `_usa_rotulo()` decide o
  estilo para o documento inteiro antes de segmentar, e não linha a linha.
  O espaço depois de "Questão" é opcional: na 25ª a questão 29 sai como
  `Questão29`, e exigir o espaço custava a prova toda.
- **Enunciado de complemento**: as provas antigas usam muito a frase que
  termina nas alternativas — `A dação em pagamento é` tem 22 caracteres e
  está inteiro. O mínimo de 60, calibrado nas modernas, reprovava questão
  boa. Medido nas 3.360 questões das 42 provas que parseiam: o menor
  legítimo tem 22, e os vinte mais curtos foram conferidos contra o PDF.
  Baixou para 20 — quem pega truncamento de verdade é a exigência das
  quatro alternativas, não o comprimento do enunciado.
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
- **Número de questões**: a prova nem sempre tem 80. Os primeiros exames
  unificados tiveram **100** — o 3º é um deles. O `--total` era 80 fixo, e o
  3º entrava com as vinte últimas descartadas **sem erro nenhum**, porque
  parar em 80 é exatamente o que o parser fora mandado fazer. Agora o total
  sai de `max(gabarito)`, que é fonte oficial; o argumento continua existindo
  para forçar à mão.
- **Gabarito só como tabela de correspondência**: a 12ª não publica grade por
  tipo. O arquivo traz apenas a `TABELA DE CORRESPONDÊNCIA`, com o número que
  a questão recebeu em cada um dos quatro tipos e a resposta na quinta
  coluna — a mesma tabela que as outras edições trazem no fim e que o parser
  descarta de propósito. Quando não há grade, ela é lida como fonte.
- **Asterisco na âncora**: `Questão 22*` marca anulada no próprio caderno
  (19ª). A anulação vem do gabarito; aqui o `*` só não pode impedir o
  casamento da âncora.
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
