# Roadmap de produto — evolução do OABase

Este documento registra ideias para evoluir o OABase de uma plataforma focada
exclusivamente no Exame de Ordem para um sistema de execução de estudos de
Direito, preservando a preparação para a OAB como caminho especializado.

O princípio central é simples: o produto não deve apenas montar um cronograma.
Ele precisa ajudar a pessoa a decidir o que fazer agora, executar a atividade,
registrar o resultado e adaptar o caminho seguinte.

## Princípios

- A IA organiza tempo e sequência; não inventa conteúdo jurídico.
- Toda afirmação jurídica precisa apontar para uma fonte do acervo.
- Progresso, anotações e histórico pertencem ao aluno e não podem desaparecer
  quando a IA reorganizar o plano.
- Métricas exibidas precisam sair de atividade realmente registrada.
- Preparação para OAB e estudo livre têm contextos diferentes e não devem usar
  os mesmos pesos ou pressupostos.
- Uma funcionalidade deve reduzir uma decisão ou uma tarefa concreta de quem
  estuda; gamificação sem utilidade não é prioridade.

## 1. O que estudar hoje

**Status: entregue em setembro de 2026.** A primeira versão vive em
`/app/hoje`, entrou como acesso prioritário na navegação e passou a ser o
destino do próximo passo no painel. Ela combina o bloco vigente, revisões,
lei seca e questões numa sessão recalculada pelo tempo disponível. O botão de
início configura o modo foco com a duração e a disciplina da sessão.

Criar uma tela diária que reúna automaticamente:

- próximo bloco do roadmap;
- revisões vencidas;
- questões recomendadas;
- leitura pendente;
- tempo disponível naquele dia.

A pessoa poderia informar, por exemplo, que tem 40 minutos. O sistema montaria
uma sessão fechada: 15 minutos de leitura, 20 minutos de questões e 5 minutos
de revisão.

Essa tela deve ser a principal porta de entrada recorrente do produto. O
roadmap responde para onde a pessoa vai; a tela de hoje responde o que ela faz
agora.

## 2. Importação de ementa

**Status: entregue em setembro de 2026.** A rota `/app/ementa` aceita texto,
lista manual e PDF, extrai somente tópicos, sugere vínculos com as disciplinas
do acervo e exige uma revisão editável antes de substituir o roadmap. O PDF é
lido em memória e descartado; tópicos externos continuam identificados como
material do aluno ou professor.

Permitir que a pessoa cole ou envie a ementa de uma disciplina da faculdade.
O sistema identifica e organiza os tópicos, e a pessoa confirma a estrutura
antes de gerar o roadmap.

Entradas possíveis:

- texto colado;
- arquivo PDF;
- lista digitada manualmente;
- data da prova ou prazo opcional;
- tempo disponível por semana.

A IA pode organizar os tópicos e a carga horária, mas não deve produzir
explicações jurídicas. Tópicos sem correspondência no acervo continuam no
roadmap, claramente marcados como conteúdo externo.

## 3. Replanejamento automático

**Status: entregue em setembro de 2026.** O roadmap agora detecta blocos que
ficaram em semanas anteriores e planos que ultrapassariam a data da prova. A
pessoa pode informar uma nova disponibilidade, conferir duração, conclusão
prevista e distribuição semanal antes de confirmar. A confirmação inaugura
uma versão, preserva conclusões, estados e anotações na versão vigente e não
altera as linhas da versão anterior.

Quando a execução divergir do plano, o sistema deve oferecer uma correção
explícita:

> Você não concluiu dois blocos desta semana. Quer redistribuí-los?

O replanejamento deve considerar:

- blocos concluídos;
- blocos em andamento;
- atividades adiadas;
- tempo de foco realmente registrado;
- nova disponibilidade informada;
- aproximação da data da prova.

Replanejar nunca pode apagar estados, anotações ou versões anteriores.

## 4. Calendário real

**Status: entregue em setembro de 2026.** A rota `/app/calendario` distribui
os blocos do roadmap em dias reais, oferece visão semanal e mensal, permite
arrastar ou editar data e horário, registra dias indisponíveis e reagenda
pendências vencidas. O mesmo calendário pode ser exportado em `.ics` para
Google Calendar, Apple Calendar e Outlook; o lembrete matinal é opcional e
reaproveita o cron diário com idempotência por aluno e data.

Transformar as semanas do roadmap em atividades distribuídas por dia.

Funcionalidades:

- visualização semanal e mensal;
- arrastar atividades entre dias;
- definir dias indisponíveis;
- estabelecer horários preferidos;
- exportar para Google Calendar, Apple Calendar e arquivo `.ics`;
- lembretes de estudo;
- reagendamento de atividades não concluídas.

O calendário deve ser uma apresentação do roadmap, não uma segunda fonte de
verdade.

## 5. Sessão de estudo guiada

**Status: entregue em setembro de 2026.** Cada bloco agora abre uma mesa de
execução própria em `/app/sessao/<bloco>`, com cronômetro contínuo ou Pomodoro,
lei seca na própria tela, questões dirigidas, checklist e caderno. O fechamento
registra foco, leituras marcadas, respostas realmente gravadas, síntese e
pendências; o bloco só é concluído quando a pessoa confirma essa escolha.

Ao iniciar um bloco, abrir um modo de execução com:

- cronômetro ou Pomodoro;
- artigo ou material indicado;
- questões relacionadas;
- anotação do bloco;
- checklist do objetivo;
- resumo ao encerrar.

O encerramento registra tempo, materiais lidos, questões respondidas e
pendências. Esses dados alimentam a revisão semanal e o replanejamento.

## 6. Revisão semanal assistida

**Status: entregue em setembro de 2026.** A rota
`/app/revisao-semanal` fecha cada semana com métricas recalculadas no banco,
compara plano e execução, aponta matérias sem foco, recupera a memória das
sessões guiadas e transforma recomendações explicáveis em um compromisso
salvo para a semana seguinte. O histórico preserva a fotografia que sustentou
cada decisão, sem inventar nota de domínio.

No final de cada semana, apresentar um fechamento baseado em dados reais:

- blocos concluídos e pendentes;
- horas planejadas versus realizadas;
- matérias negligenciadas;
- questões respondidas;
- taxa de acerto quando houver volume suficiente;
- revisões acumuladas;
- sugestão de ajuste para a semana seguinte.

Não criar uma “nota de domínio” se o sistema não tiver evidência suficiente
para medi-la.

## 7. Caderno de lei seca

**Status: entregue em setembro de 2026.** Cada página de artigo agora permite
selecionar e colorir trechos, escrever nota pessoal, marcar leitura, agendar
revisão, sinalizar aparição em questão e registrar para qual prova o
dispositivo é importante. `/app/lei-seca` organiza o acervo pessoal com busca,
filtros e fila vencida; destaques e notas reaparecem no roadmap, na sessão
guiada e junto aos dispositivos mostrados depois de responder uma questão.

Permitir interação pessoal com os dispositivos do acervo:

- destacar trechos;
- escrever notas;
- marcar como lido;
- marcar para revisão;
- registrar que apareceu em uma questão;
- favoritar como importante para uma prova.

Os destaques devem reaparecer quando o mesmo artigo for recomendado em outro
bloco ou relacionado a uma questão respondida.

## 8. Flashcards vinculados à fonte

**Status: entregue em setembro de 2026.** `/app/flashcards` reúne criação,
biblioteca e sessão de revisão com quatro níveis de lembrança. Destaques do
Caderno de Lei Seca e enunciados de súmula viram cartões sem perder o link
para a fonte; cartões livres aparecem como anotação pessoal. O banco valida o
trecho oficial, calcula o próximo intervalo, preserva o histórico e coloca os
cartões vencidos na agenda de `/app/hoje`.

Criar revisão espaçada de cartões sem gerar afirmações jurídicas livres por
IA.

Regras:

- a pessoa pode criar o próprio cartão;
- o verso pode incluir trecho literal de lei ou súmula;
- todo cartão jurídico mantém link para sua fonte;
- cartões sem fonte são identificados como anotação pessoal;
- o calendário de revisão se integra à tela “O que estudar hoje”.

## 9. Metas personalizadas por bloco

**Status: entregue em setembro de 2026.** Cada bloco aceita metas de leitura,
questões, tempo de foco, resumos, revisão de anotações e um checklist próprio
de subtópicos. As quatro primeiras avançam somente pelas evidências das
sessões guiadas; as demais deixam explícito o controle manual. O progresso
aparece no bloco, no trilho lateral, durante a sessão e no PDF. Ao replanejar,
as metas e o progresso acumulado acompanham o bloco correspondente.

Além do estado do bloco, permitir definir um resultado verificável:

- ler determinada quantidade de artigos;
- resolver determinada quantidade de questões;
- completar um tempo de foco;
- escrever um resumo;
- revisar anotações;
- concluir uma lista própria de subtópicos.

O progresso do bloco deve ser derivado da meta escolhida. Marcação manual
continua disponível para atividades que o sistema não consegue medir.

## 10. Histórico e versões do roadmap

**Status: entregue em setembro de 2026.** `/app/roadmap/historico` apresenta
uma linha do tempo somente para consulta, com o motivo e a origem de cada
versão, fotografia dos blocos, metas, anotações e execução registrada. A tela
compara carga, itens incluídos, removidos, divididos ou redistribuídos. Novos
planos por conversa, ementa e replanejamento registram contexto e diagnóstico;
versões anteriores à funcionalidade são mantidas e identificadas como legadas.

Criar uma linha do tempo com:

- roadmaps anteriores;
- data e motivo de cada alteração;
- progresso preservado por versão;
- atividades removidas ou redistribuídas;
- comparação entre planejamento e execução;
- possibilidade de consultar uma versão antiga sem restaurá-la.

Esse histórico também permite explicar por que o sistema mudou uma
recomendação.

## 11. Compartilhamento com professor ou grupo

**Status: entregue em setembro de 2026.** A pessoa gera em
`/app/roadmap/compartilhar` um link privado, somente para leitura, com validade
e revogação imediata. A versão atual do roteiro é fixada no acesso; progresso,
anotações e revisões têm consentimentos separados, com conteúdo privado oculto
por padrão. O token puro aparece uma única vez e o banco guarda somente seu
hash. A página compartilhada não identifica a conta, não entra no sitemap e
recebe `noindex`, `nofollow`, `noarchive` e política sem referência.

Permitir gerar um link privado e revogável, inicialmente somente para leitura,
com:

- roadmap atual;
- progresso agregado;
- anotações selecionadas pela pessoa;
- revisão semanal;
- prazo da prova.

Uma evolução posterior pode incluir comentários de mentor, turmas, roadmaps
compartilhados e acompanhamento de grupos de estudo. Dados pessoais e
anotações privadas ficam ocultos por padrão.

## 12. Modo prova da faculdade

**Status: entregue em setembro de 2026.** `/app/prova` permite cadastrar uma
avaliação fora da OAB com data, disciplina, horas semanais, tópicos, materiais
indicados e dificuldade percebida. O roteiro é regressivo, prioriza o que a
pessoa declarou como difícil e reserva a última semana para revisão e simulado;
a origem dessa prioridade fica explícita e não usa incidência do Exame de Ordem.

Criar um fluxo específico dentro do estudo livre:

- nome da disciplina;
- nome ou tipo da avaliação;
- data da prova;
- tópicos da ementa;
- peso ou dificuldade percebida de cada tópico;
- materiais indicados pelo aluno ou professor;
- disponibilidade até a avaliação;
- roadmap regressivo a partir da data.

Pesos da OAB nunca devem influenciar esse modo. Quando não houver atividade
suficiente para medir dificuldade, o produto usa a percepção declarada pela
pessoa e identifica essa origem.

## Ordem recomendada

### Fase 1 — execução diária

1. “O que estudar hoje”.
2. Sessão de estudo guiada.
3. Metas personalizadas por bloco.
4. Revisão semanal assistida.

### Fase 2 — estudo livre completo

1. Importação de ementa.
2. Modo prova da faculdade.
3. Replanejamento automático.
4. Calendário e exportação `.ics`.

### Fase 3 — memória e acompanhamento

1. Caderno de lei seca.
2. Flashcards vinculados à fonte.
3. Histórico e versões do roadmap.
4. Compartilhamento com professor ou grupo.

## Próxima entrega recomendada

Construir “O que estudar hoje” junto com a sessão guiada. As duas usam dados
que o OABase já possui — roadmap, questões, legislação, revisão e foco — e
fecham o ciclo mais importante do produto:

1. decidir;
2. executar;
3. registrar;
4. adaptar.
