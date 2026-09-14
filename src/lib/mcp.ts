import { urlMcp } from "./site";

/**
 * Endereço do servidor MCP do OABase.
 *
 * O mesmo endereço serve todo mundo: a autorização OAuth é que liga a conexão
 * à conta de quem aprovou. Não existe chave para colar — o assistente faz o
 * login com a conta OABase no primeiro uso.
 */
export const ENDERECO_MCP = urlMcp();

export type GuiaDeConexao = {
  chave: string;
  nome: string;
  resumo: string;
  /** Lista numerada de passos. Cada `\n` dentro do passo vira quebra de linha. */
  passos: string[];
  /** Comando opcional a rodar antes dos passos (ex.: Claude Code). */
  comando?: string;
};

/**
 * Guias por assistente. O texto fala da interface humana (rótulos podem
 * mudar de nome com o tempo), e o passo final é sempre o mesmo: autorizar
 * com a conta OABase.
 */
export const GUIAS_DE_CONEXAO: GuiaDeConexao[] = [
  {
    chave: "claude",
    nome: "Claude",
    resumo: "Conector OAuth no navegador, no desktop e no app — sem baixar nada.",
    passos: [
      "Abra o Claude (claude.ai, desktop ou aplicativo) e vá em Personalizar → Conectores.",
      "Clique no + e escolha “Adicionar conector personalizado”.",
      "Selecione “Web” e cole o endereço do OABase.",
      "Toque em “Adicionar” e autorize a conexão com a sua conta OABase.",
    ],
  },
  {
    chave: "chatgpt",
    nome: "ChatGPT",
    resumo: "Via conector personalizado, no Modo de desenvolvedor (planos pagos).",
    passos: [
      "Em Configurações do ChatGPT, ative o Modo de desenvolvedor (em “Segurança e login” ou “Avançado”).",
      "Vá em Connectors (ou Plugins) e crie um conector personalizado.",
      "Dê um nome (ex.: OABase) e cole o endereço do OABase.",
      "Conclua a autorização com a sua conta OABase.",
    ],
  },
  {
    chave: "claude-code",
    nome: "Claude Code",
    resumo: "Para quem estuda pelo terminal. Autenticação via OAuth na sessão.",
    comando: `claude mcp add --transport http oabase ${ENDERECO_MCP}`,
    passos: [
      "Rode o comando ao lado no seu terminal.",
      "Abra uma sessão do Claude Code e execute /mcp.",
      "Escolha o servidor “oabase” e conclua o login no navegador.",
    ],
  },
  {
    chave: "cursor",
    nome: "Cursor",
    resumo: "Gerenciador nativo de servidores MCP, no tipo HTTP.",
    passos: [
      "Vá em Configurações → Ferramentas e MCP.",
      "Toque em “Novo servidor MCP” e escolha o tipo HTTP (Streamable).",
      "Cole o endereço do OABase e instale.",
      "Autorize a conexão com a sua conta OABase.",
    ],
  },
];