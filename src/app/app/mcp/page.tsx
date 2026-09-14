import type { Metadata } from "next";
import Link from "next/link";
import { CartaoDeConexao } from "@/components/cartao-de-conexao";
import { CampoEnderecoMcp } from "@/components/campo-endereco-mcp";
import { formatarData } from "@/lib/format";
import { ENDERECO_MCP, GUIAS_DE_CONEXAO } from "@/lib/mcp";
import { planos } from "@/lib/planos";
import { supabaseServidor, usuarioAtual } from "@/lib/supabase/servidor";

export const metadata: Metadata = {
  title: "Assistentes de IA",
  robots: { index: false, follow: false },
};

function Bloco({
  titulo,
  descricao,
  children,
  id,
}: {
  titulo: string;
  descricao: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      className="superficie grid gap-6 p-7 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10 lg:p-8"
    >
      <div className="flex flex-col gap-1.5">
        <h2 className="text-[1.15rem] font-bold text-ink">{titulo}</h2>
        <p className="max-w-[38ch] text-[0.93rem] text-muted">{descricao}</p>
      </div>
      <div className="lg:border-l lg:border-line lg:pl-10">{children}</div>
    </section>
  );
}

export default async function McpAppPage() {
  const [usuario, supabase] = await Promise.all([
    usuarioAtual(),
    supabaseServidor(),
  ]);

  const { data: assinaturas } = await supabase
    .from("assinaturas")
    .select("plano, status, inicio, fim")
    .order("fim", { ascending: false })
    .limit(1);
  const assinatura = assinaturas?.[0] ?? null;

  // `cortesia` não está em `planos.ts` de propósito — o que está lá é o que
  // dá para comprar, e cortesia se concede por SQL. Mesmo tratamento da tela
  // de configurações.
  const cortesia = assinatura?.plano === "cortesia";
  const planoAtivo = assinatura?.status === "ativa";
  const nomeDoPlano = cortesia
    ? "Cortesia"
    : assinatura
      ? (planos.find((p) => p.chave === assinatura.plano)?.nome ??
        assinatura.plano)
      : null;

  const acesso = planoAtivo
    ? "questões, correção comentada e revisão espaçada liberadas"
    : "só as ferramentas que não dependem de plano";

  return (
    <div className="painel-conteudo flex max-w-[980px] flex-col gap-6">
      <header className="flex flex-col gap-2">
        <span className="rotulo self-start">Conecte o seu assistente</span>
        <h1 className="text-[clamp(1.75rem,3vw,2.15rem)] leading-[1.08] font-extrabold tracking-[-0.035em] text-ink">
          Assistentes de IA
        </h1>
        <p className="max-w-[62ch] text-body">
          Copie o endereço, cole no seu assistente e autorize. A conexão fica
          ligada a esta conta — {usuario?.email} — e o que o assistente alcança
          é exatamente o que você alcança aqui.
        </p>
      </header>

      <section className="superficie flex flex-wrap items-center justify-between gap-4 p-6">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-[0.7rem] font-bold tracking-[0.14em] text-muted uppercase">
            Esta conta
          </span>
          <p className="truncate text-[1rem] font-bold text-ink">{usuario?.email}</p>
          <p className="text-[0.84rem] text-muted">
            {planoAtivo ? (
              <>
                Plano {nomeDoPlano} · {acesso}.{" "}
                {assinatura?.fim &&
                  `Válido até ${formatarData(String(assinatura.fim).slice(0, 10))}.`}
              </>
            ) : (
              <>
                {nomeDoPlano ? `Plano ${nomeDoPlano} · ` : "Sem plano ativo · "}
                {acesso}.
              </>
            )}
          </p>
        </div>
        {!planoAtivo && (
          <Link
            href="/app/assinar"
            className="rounded-full bg-brand-600 px-5 py-2.5 text-[0.9rem] font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Ver planos
          </Link>
        )}
      </section>

      <Bloco
        titulo="O endereço"
        descricao="Um endereço só para todo mundo — a autorização é que decide de quem é a conexão. Não existe chave para cole."
        id="endereco"
      >
        <div className="flex flex-col gap-2">
          <CampoEnderecoMcp texto={ENDERECO_MCP} />
          <p className="text-[0.84rem] leading-relaxed text-muted">
            No primeiro uso o assistente abre a autorização do OABase. Como você
            já está logado, é só aprovar — sem redigitar senha.
          </p>
        </div>
      </Bloco>

      <Bloco
        titulo="Conecte no seu assistente"
        descricao="Claude, ChatGPT e Cursor cobrem a maioria; qualquer cliente que aceite servidor MCP remoto por endereço funciona do mesmo jeito."
        id="passo-a-passo"
      >
        <div className="grid gap-3 lg:grid-cols-2">
          {GUIAS_DE_CONEXAO.map((guia) => (
            <CartaoDeConexao key={guia.chave} guia={guia} />
          ))}
        </div>
      </Bloco>

      <Bloco
        titulo="O que fica liberado"
        descricao="A mesma fronteira do site vale no assistente. Ele não consulta nem registra nada que a sua conta não pudesse."
      >
        <div className="flex flex-col gap-3">
          <div className="rounded-[14px] border border-line bg-paper p-4">
            <span className="text-[0.7rem] font-bold tracking-[0.14em] text-brand-700 uppercase">
              Conta logada
            </span>
            <ul className="mt-2.5 flex flex-wrap gap-2">
              {["buscar_legislacao", "buscar_sumulas", "consultar_roadmap", "preparar_sessao_de_estudo", "abrir_sessao_de_estudo", "salvar_sessao_de_estudo", "encerrar_sessao_de_estudo", "ver_meu_progresso", "consultar_revisao_semanal"].map((ferramenta) => (
                <li key={ferramenta} className="rounded-full bg-brand-50 px-3 py-1.5 font-mono text-[0.7rem] font-semibold text-brand-700">{ferramenta}</li>
              ))}
            </ul>
            <p className="mt-3 text-[0.84rem] leading-relaxed text-body">
              Legislação, súmulas, seu plano de estudos e o registro de sessões.
            </p>
          </div>
          <div className="rounded-[14px] border border-ouro-200 bg-ouro-50 p-4">
            <span className="text-[0.7rem] font-bold tracking-[0.14em] text-ouro-700 uppercase">
              Plano ativo
            </span>
            <ul className="mt-2.5 flex flex-wrap gap-2">
              {["buscar_questoes", "registrar_resposta", "explicar_questao", "consultar_revisoes_pendentes", "revisar_flashcard"].map((ferramenta) => (
                <li key={ferramenta} className="rounded-full bg-white px-3 py-1.5 font-mono text-[0.7rem] font-semibold text-ouro-700">{ferramenta}</li>
              ))}
            </ul>
            <p className="mt-3 text-[0.84rem] leading-relaxed text-body">
              Questões, correção comentada e revisão espaçada. A fila nunca traz
              o gabarito antes da sua resposta.
            </p>
          </div>
        </div>
      </Bloco>

      <Bloco
        titulo="Desconectar e segurança"
        descricao="Você continua no controle da conexão em qualquer momento."
      >
        <div className="flex flex-col gap-2 text-[0.88rem] leading-relaxed text-body">
          <p>Remover o conector no seu assistente encerra o acesso na hora.</p>
          <p>
            Não existe token para vazar: a autorização usa a mesma proteção do
            “continuar com Google”, e cada chamada é validada separadamente no
            OABase.
          </p>
          <p>
            Ferramentas de pagamento, clientes, suporte, moderação e redação
            editorial não existem no servidor MCP.
          </p>
        </div>
      </Bloco>

      <p className="text-[0.86rem] text-muted">
        Quer a lista completa de ferramentas e as dúvidas comuns? A página{" "}
        <Link href="/mcp" className="font-semibold text-brand-700 underline-offset-2 hover:underline">
          MCP de estudos
        </Link>{" "}
        explica tudo.
      </p>
    </div>
  );
}