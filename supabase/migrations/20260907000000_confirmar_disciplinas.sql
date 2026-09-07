-- Confirma em lote todas as questões que já têm disciplina atribuída.
--
-- São ~1.346 questões com classificação automática (lexico/sequencia/modelo)
-- que faltam confirmar. O UPDATE preserva classificacao_origem — o campo de
-- procedência continua dizendo de onde veio a classificação, mesmo depois de
-- confirmada por humano. Quem consome o dado sabe que a origem foi máquina.
--
-- As ~496 questões sem disciplina_id continuam sem confirmar (não têm palpite).

update public.questoes
   set disciplina_confirmada = true,
       atualizado_em = now()
 where not disciplina_confirmada
   and disciplina_id is not null;
