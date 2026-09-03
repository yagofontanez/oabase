-- ============================================================================
-- O primeiro texto do blog, trazido para o repositório.
--
-- Ele foi escrito e inserido direto no banco, e ficou meses existindo em um
-- lugar só: a linha da tabela `posts` no projeto remoto. Um `db reset`, uma
-- restauração de backup anterior ou um banco novo o apagariam sem erro
-- nenhum — a página /blog simplesmente voltaria a dizer "nenhum texto
-- publicado ainda", e ninguém saberia o que faltava.
--
-- Texto autoral é o ativo caro deste projeto: é o que o portão de qualidade
-- protege, é o que decide quais páginas entram no índice, e é a única coisa
-- aqui que nenhum pipeline consegue refazer. Ele mora no git a partir de
-- agora, como o resto do que não pode ser perdido.
--
-- `on conflict (slug) do nothing`: no banco onde ele já existe, esta
-- migration não faz nada — inclusive não sobrescreve nenhuma revisão feita
-- depois. Ela existe para o banco onde ele *não* existe.
-- ============================================================================

insert into public.posts (slug, titulo, resumo, corpo, publicado_em) values
(
'artigos-mais-citados-nas-provas-da-oab',
'Os artigos que a OAB citou de forma expressa em 43 provas',
'Contamos, uma a uma, as 3.460 questões das provas de 2010 a 2026 e separamos os dispositivos que os enunciados nomeiam. O resultado surpreende menos pelo topo da lista do que pelo tamanho dela.',
$post$Existe uma diferença grande entre "o que mais cai" e "o que a prova diz que está cobrando". A primeira frase é o que todo cursinho promete; a segunda é o que dá para medir sem chutar. Este texto é sobre a segunda.

O acervo do OABase tem hoje 3.460 questões objetivas, extraídas dos cadernos oficiais do 3º ao 46º Exame de Ordem Unificado — 43 edições, com o gabarito publicado pela própria banca e 16 questões anuladas mantidas no acervo como material de estudo. Sobre esse conjunto passamos um procedimento simples e verificável: procurar, no enunciado e nas alternativas, citação expressa de artigo com a lei identificada.

## O número que interessa é o menor deles

De 3.460 questões, apenas 133 citam um artigo de forma expressa. Quatro por cento.

Esse é o dado mais útil do levantamento inteiro, e ele não está no topo da lista: está no tamanho dela. A FGV quase nunca escreve "nos termos do art. 155 do Código Penal". Ela narra um caso — um homem entra numa casa vazia, arromba uma porta, leva um aparelho — e pergunta qual alternativa está correta. O dispositivo está lá, inteiro, mas quem precisa nomeá-lo é você.

A consequência prática para quem estuda é direta: decorar número de artigo rende pouco. O que a prova exige é reconhecer o instituto dentro de uma história curta e saber qual regra se aplica. Ler o código de ponta a ponta prepara mal para isso; resolver questão e voltar ao dispositivo depois prepara bem.

## O que aparece quando a prova nomeia

Quando a banca cita, ela cita concentrado. Os dispositivos mais nomeados nas 43 provas, com o número de questões em que cada um aparece:

Art. 155 do Código Penal, furto, em 8 questões. Art. 157, roubo, e art. 163, dano, em 6 cada, junto com o art. 5º da Constituição. Art. 85 do Código de Processo Civil, honorários de sucumbência, e art. 129 do Código Penal, lesão corporal, em 4. Depois vêm, com 3 cada, o art. 121 do Código Penal, o art. 150 da Constituição, o art. 334 do Código de Processo Civil e os arts. 213 e 217-A do Código Penal.

Dois padrões saltam. O primeiro é que o Direito Penal domina a lista: dos onze dispositivos mais citados, sete estão no Código Penal. Faz sentido — crime é o ramo em que a subsunção do fato ao tipo é a própria pergunta, e o tipo tem número.

O segundo é que os artigos citados são os artigos centrais, não os exóticos. Furto, roubo, dano, lesão, homicídio. Honorários. Limitações ao poder de tributar. Audiência de conciliação. Nenhuma surpresa, e é justamente esse o ponto: a prova cobra o comum com profundidade, não o raro com superficialidade.

## Por que 106 artigos e não 5.756

O acervo de legislação do OABase tem 5.756 artigos de oito códigos, do texto compilado do Planalto. Desses, 106 têm pelo menos uma citação medida em prova.

É pouco, e é honesto que seja pouco. Cada vínculo entre uma questão e um artigo aqui é verificável: dá para abrir a questão, ler, e conferir que o número está escrito lá. O caminho fácil seria completar o resto por semelhança de texto e apresentar tudo junto como incidência. Isso encheria a lista e destruiria o único valor que ela tem, que é a diferença entre um número contado e um palpite bem apresentado.

O trabalho de ampliar essa medição existe, mas é humano: alguém lê a questão e afirma qual dispositivo ela cobra. Conforme isso avança, a lista acima muda — e quando mudar, vai continuar sendo contagem.

## O que fazer com isso na semana da prova

Se você tem pouco tempo, três conclusões práticas saem daqui.

Primeira: comece pelos tipos penais patrimoniais e pelas lesões. São os que a banca mais nomeia e, quando não nomeia, descreve em caso concreto — o retorno por hora de estudo é alto nos dois cenários.

Segunda: leia os artigos inteiros, com parágrafos e incisos, e não só o caput. Em furto, roubo, lesão e honorários, a pergunta quase sempre mora num parágrafo — qualificadora, causa de aumento, faixa de percentual.

Terceira: pare de perseguir o exótico. Em 43 provas medidas, a banca não recompensou quem sabia o artigo obscuro; recompensou quem sabia o artigo comum a fundo.$post$,
timestamptz '2026-09-02 14:02:06.583131+00'
)
on conflict (slug) do nothing;
