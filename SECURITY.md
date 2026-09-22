# Política de segurança

## Relatar vulnerabilidades

Não abra uma issue pública para falhas que possam expor dados, burlar assinaturas, alterar pagamentos, vazar gabaritos ou contornar RLS.

Use o [relato privado de vulnerabilidade do GitHub](https://github.com/yagofontanez/oabase/security/advisories/new) e informe: descrição, impacto, passos de reprodução, versões afetadas e, se possível, uma sugestão de correção.

O recebimento será confirmado assim que possível. Pedimos que você não divulgue a falha até que uma correção esteja disponível.

## Escopo sensível

- Políticas RLS e funções `security definer`.
- Autenticação e renovação de sessão.
- Endpoints de pagamento, webhook e cron.
- Respostas de questões e gabaritos.
- Dados de perfil, compra e suporte.
- Integrações MCP e OAuth.

## Boas práticas para desenvolvimento

Nunca envie service role, tokens, URLs assinadas, dumps reais ou dados de alunos. Use `.env.example` e dados sintéticos ao reproduzir um problema.
