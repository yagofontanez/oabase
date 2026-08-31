/**
 * Traduz o erro do Supabase para algo acionável.
 *
 * A mensagem original vem em inglês e descreve o estado do sistema
 * ("Invalid login credentials"). Quem está na tela precisa saber o que
 * fazer a seguir, não como o servidor chama o problema.
 */
const MAPA: [RegExp, string][] = [
  [
    /invalid login credentials/i,
    "E-mail ou senha incorretos. Confira os dois e tente de novo.",
  ],
  [
    /email not confirmed/i,
    "Falta confirmar seu e-mail. Procure a mensagem que enviamos — inclusive no spam.",
  ],
  [
    /user already registered|already been registered/i,
    "Já existe uma conta com este e-mail. Tente entrar em vez de criar.",
  ],
  [
    /password should be at least/i,
    "A senha precisa ter pelo menos 8 caracteres.",
  ],
  [
    /unable to validate email|invalid format/i,
    "Esse e-mail parece inválido. Confira se não faltou algo.",
  ],
  [
    /rate limit|too many requests/i,
    "Muitas tentativas seguidas. Espere um minuto e tente de novo.",
  ],
  [
    /failed to fetch|network/i,
    "Não conseguimos falar com o servidor. Verifique sua conexão.",
  ],
];

export function mensagemDeErro(erro: unknown): string {
  const bruto = erro instanceof Error ? erro.message : String(erro ?? "");
  for (const [padrao, mensagem] of MAPA) {
    if (padrao.test(bruto)) return mensagem;
  }
  return "Não foi possível concluir agora. Tente novamente em instantes.";
}
