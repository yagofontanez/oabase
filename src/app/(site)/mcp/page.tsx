import type { Metadata } from "next";
import Link from "next/link";
import { CartaoDeConexao } from "@/components/cartao-de-conexao";
import { CampoEnderecoMcp } from "@/components/campo-endereco-mcp";
import { Container } from "@/components/container";
import { PageHeader } from "@/components/page-header";
import { JsonLd } from "@/lib/jsonld";
import { ENDERECO_MCP, GUIAS_DE_CONEXAO } from "@/lib/mcp";
import { abs } from "@/lib/site";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "MCP de estudos do OABase",
  description: "Copie o endereço, cole no seu assistente de IA e estude com legislação, questões, progresso e sessões guiadas.",
  alternates: { canonical: abs("/mcp") },
};

const ferramentas = [
  ["buscar_legislacao", "Encontre artigos e súmulas por texto ou número."],
  ["buscar_sumulas", "Consulte exclusivamente súmulas oficiais com a fonte."],
  ["buscar_questoes", "Monte uma fila sem revelar o gabarito antes da hora."],
  ["explicar_questao", "Leia o comentário autoral depois de responder."],
  ["registrar_resposta", "Responda sem duplicar tentativas em caso de retry."],
  ["ver_meu_progresso", "Veja acertos, erros e revisões vencidas."],
  ["consultar_roadmap", "Consulte blocos, datas e metas do plano vigente."],
  ["preparar_sessao_de_estudo", "Encaixe revisões e metas no tempo disponível."],
  ["abrir_sessao_de_estudo", "Comece uma sessão de foco ligada ao roadmap."],
  ["salvar_sessao_de_estudo", "Preserve o andamento sem encerrar a sessão."],
  ["encerrar_sessao_de_estudo", "Registre foco, síntese e pendências reais."],
  ["consultar_revisoes_pendentes", "Reúna questões e flashcards vencidos."],
  ["revisar_flashcard", "Avalie a lembrança e reagende a próxima revisão."],
  ["consultar_revisao_semanal", "Leia a semana com métricas calculadas no banco."],
] as const;

const perguntas = [
  ["O MCP consegue ver meus dados?", "Só depois de você conectar e autorizar sua própria conta. Cada requisição é validada separadamente e a mesma RLS do OABase continua decidindo o que pode ser lido."],
  ["O assistente pode ver a correção antes da resposta?", "Não. A fila não contém o gabarito e até o comentário autoral só é liberado depois que o OABase confirma uma tentativa sua."],
  ["Uma falha pode duplicar minha resposta?", "Não quando o cliente repete a mesma chave de idempotência: o banco devolve o primeiro resultado sem criar outra tentativa."],
  ["Ele tem acesso ao painel administrativo?", "Não. O servidor não oferece ferramentas de pagamentos, clientes, moderação, redação editorial ou qualquer operação interna."],
  ["Preciso de login e de assinatura?", "O assistente acessa exatamente o que a sua conta pode acessar. Legislação, súmulas, roadmap, sessões guiadas e progresso respondem com a conta logada; questões, correção comentada e revisão espaçada entram com plano ativo — a mesma fronteira do site."],
  ["Qual assistente funciona?", "Qualquer cliente que aceite um servidor MCP remoto por endereço. Claude, ChatGPT e Cursor têm guia aqui embaixo; o mesmo endereço vale para qualquer cliente que fale Streamable HTTP."],
] as const;

const CONFIGURACAO = '{ "mcpServers": { "oabase-estudos": { "command": "pnpm", "args": ["--dir", "/caminho/oabase", "mcp"], "env": { "OABASE_ACCESS_TOKEN": "..." } } } }';

export default function McpPage() {
  return (
    <>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "TechArticle", "@id": abs("/mcp"), headline: "MCP de estudos do OABase", description: metadata.description, inLanguage: "pt-BR" }} />
      <PageHeader
        crumbs={[{ href: "/", label: "Início" }, { href: "/mcp", label: "MCP de estudos" }]}
        eyebrow="OABase como parceiro de estudo"
        titulo={<>Estude conversando com o seu <span className="text-ouro-500">assistente</span></>}
        descricao="Copie o endereço abaixo, cole no seu assistente de IA e autorize com a sua conta. Em um minuto o OABase vira mais uma ferramenta da sua conversa."
      />
      <Container className="py-16">
        <section className="grid overflow-hidden rounded-[26px] bg-brand-900 text-white shadow-[0_22px_60px_rgba(8,58,49,.14)] lg:grid-cols-[1.05fr_.95fr]">
          <div className="p-7 sm:p-10">
            <span className="text-[0.7rem] font-bold tracking-[0.14em] text-ouro-200 uppercase">Como funciona</span>
            <h2 className="mt-3 max-w-[17ch] text-[clamp(1.8rem,4vw,2.8rem)] leading-[1.02] font-extrabold tracking-[-0.05em] text-white">A conversa entende o que você está estudando.</h2>
            <p className="mt-4 max-w-[54ch] text-[0.94rem] leading-relaxed text-brand-100">O cliente de IA chama uma ferramenta do OABase, o banco aplica as permissões e a resposta volta com o contexto necessário para continuar o estudo.</p>
            <div className="mt-7 grid gap-2.5 sm:grid-cols-3">{[["1", "Você pergunta", "“O que estudo agora?”"], ["2", "O MCP consulta", "roadmap e revisões"], ["3", "Você executa", "com fonte e registro"]].map(([numero, titulo, detalhe]) => <div key={numero} className="rounded-[15px] bg-white/8 p-3.5"><span className="text-[0.7rem] font-bold text-ouro-200">{numero}</span><strong className="mt-2 block text-[0.8rem] text-white">{titulo}</strong><span className="mt-1 block text-[0.72rem] leading-relaxed text-brand-100">{detalhe}</span></div>)}</div>
          </div>
          <div className="border-t border-white/10 bg-white/6 p-7 sm:p-10 lg:border-t-0 lg:border-l"><span className="text-[0.7rem] font-bold tracking-[0.14em] text-ouro-200 uppercase">Um exemplo</span><div className="mt-4 rounded-[17px] border border-white/10 bg-noite p-5 font-mono text-[0.78rem] leading-relaxed text-brand-100"><p><span className="text-ouro-200">Você:</span> Tenho 40 minutos. O que faço?</p><p className="mt-4 border-t border-white/10 pt-4"><span className="text-ouro-200">Assistente:</span> Vou encaixar as revisões vencidas e uma meta do próximo bloco nesse tempo.</p><p className="mt-4 border-t border-white/10 pt-4 text-white"><span className="text-brand-300">OABase:</span> 10 min de revisão · 30 min de Direito Constitucional · meta: direitos fundamentais.</p></div><p className="mt-4 text-[0.78rem] leading-relaxed text-brand-100">A divisão do tempo vem dos seus dados. A legislação e a correção continuam vindo do OABase.</p></div>
        </section>

        <section className="mt-20 overflow-hidden rounded-[26px] bg-brand-900 text-white shadow-[0_22px_60px_rgba(8,58,49,.14)]">
          <div className="p-7 sm:p-10">
            <span className="text-[0.7rem] font-bold tracking-[0.14em] text-ouro-200 uppercase">Conecte em um minuto</span>
            <h2 className="mt-3 max-w-[24ch] text-[clamp(1.8rem,4vw,2.6rem)] leading-[1.04] font-extrabold tracking-[-0.05em] text-white">Copie o endereço, cole no assistente e autorize.</h2>
            <p className="mt-4 max-w-[60ch] text-[0.92rem] leading-relaxed text-brand-100">Sem arquivos, sem token, sem terminal. O mesmo endereço serve todo mundo — a autorização OAuth é que liga a conexão à sua conta.</p>
            <ol className="mt-7 flex flex-col gap-4 sm:grid sm:grid-cols-3 sm:gap-3">
              {[["1", "Copie o endereço", "está no campo escuro abaixo", ""], ["2", "Cole no seu assistente", "como servidor MCP remoto", ""], ["3", "Autorize", "com a sua conta OABase", ""]].map(([numero, titulo, detalhe]) => <li key={numero} className="rounded-[15px] bg-white/8 p-4"><strong className="block text-[0.82rem] text-white"><span className="mr-2 text-ouro-200">{numero}</span>{titulo}</strong><span className="mt-1 block text-[0.72rem] leading-relaxed text-brand-100">{detalhe}</span></li>)}
            </ol>
            <div className="mt-7">
              <CampoEnderecoMcp texto={ENDERECO_MCP} variante="escura" />
            </div>
            <p className="mt-3 text-[0.76rem] leading-relaxed text-brand-100">No primeiro uso o seu assistente abre a autorização do OABase — você só aprova, sem redigitar senha. Veja o guia do seu assistente abaixo.</p>
            <div className="mt-7 flex flex-wrap items-center gap-2 border-t border-white/10 pt-5">
              <span className="text-[0.78rem] font-semibold text-brand-100">Guia rápido:</span>
              {GUIAS_DE_CONEXAO.map((guia) => <a key={guia.chave} href={`#conectar-${guia.chave}`} className="rounded-full border border-white/15 px-3.5 py-1.5 text-[0.78rem] font-semibold text-white/85 transition-colors hover:border-ouro-300 hover:text-ouro-200">{guia.nome}</a>)}
              <Link href="/app/mcp" className="ml-auto rounded-full bg-ouro-400 px-4 py-2 text-[0.8rem] font-bold text-brand-900 transition-colors hover:bg-ouro-200">Já tenho conta — terminar em 2 minutos</Link>
            </div>
          </div>
        </section>

        <section className="mt-20 grid gap-10 lg:grid-cols-[.7fr_1.3fr]"><div><span className="rotulo">Passo a passo</span><h2 className="mt-1 text-[1.9rem] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[2.3rem]">Conecte no seu assistente</h2><p className="mt-4 max-w-[38ch] text-[0.9rem] leading-relaxed text-body">O passo final é sempre o mesmo: autorizar a conexão com a conta OABase. A partir daí, o assistente consulta e registra direto do seu ciclo de estudos.</p></div><div className="grid gap-3 lg:grid-cols-2">{GUIAS_DE_CONEXAO.map((guia) => <CartaoDeConexao key={guia.chave} guia={guia} id={`conectar-${guia.chave}`} />)}</div></section>

        <section className="mt-20 grid gap-10 lg:grid-cols-[.7fr_1.3fr]"><div><span className="rotulo">Ferramentas</span><h2 className="mt-1 text-[1.9rem] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[2.3rem]">Tudo que o assistente pode fazer</h2></div><div className="grid gap-3 sm:grid-cols-2">{ferramentas.map(([nome, descricao]) => <article key={nome} className="rounded-[16px] border border-line bg-surface p-5"><code className="text-[0.78rem] font-bold text-brand-700">{nome}</code><p className="mt-2 text-[0.84rem] leading-relaxed text-body">{descricao}</p></article>)}</div></section>

        <section className="mt-20 rounded-[22px] border border-ouro-200 bg-ouro-50 p-6 sm:p-8"><span className="text-[0.7rem] font-bold tracking-[0.14em] text-ouro-700 uppercase">Regra de confiança</span><h2 className="mt-2 text-[1.45rem] font-bold text-ink">A IA não substitui a fonte.</h2><p className="mt-2 max-w-[75ch] text-[0.9rem] leading-relaxed text-body">O MCP reduz a decisão de “o que fazer agora”. Quando o assunto é Direito, a resposta precisa apontar para legislação, súmula ou comentário publicado. Se não houver fonte no acervo, o assistente deve dizer que não há base suficiente.</p></section>

        <section className="mt-20 grid gap-10 lg:grid-cols-[.7fr_1.3fr]"><div><span className="rotulo">Dúvidas comuns</span><h2 className="mt-1 text-[1.9rem] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[2.3rem]">Antes de conectar</h2></div><dl className="divide-y divide-line border-t border-line">{perguntas.map(([pergunta, resposta]) => <div key={pergunta} className="py-5"><dt className="text-[0.98rem] font-bold text-ink">{pergunta}</dt><dd className="mt-2 max-w-[68ch] text-[0.88rem] leading-relaxed text-body">{resposta}</dd></div>)}</dl></section>

        <details className="mt-20 rounded-[22px] border border-line bg-surface p-2">
          <summary className="flex cursor-pointer items-center justify-between gap-4 rounded-[16px] px-4 py-3.5 select-none">
            <span className="flex flex-col">
              <strong className="text-[1.02rem] font-bold text-ink">Para desenvolvedores</strong>
              <span className="text-[0.8rem] text-muted">Modo local via stdio, servidor HTTP próprio e metadata OAuth.</span>
            </span>
            <span aria-hidden="true" className="text-[1.3rem] font-light text-muted">+</span>
          </summary>
          <div className="flex flex-col gap-5 px-4 pt-2 pb-4 sm:px-6 sm:pb-6">
            <p className="max-w-[75ch] text-[0.86rem] leading-relaxed text-body">A maior parte de quem usa não precisa disto. O endereço remoto acima já faz a conexão com autorização. Para rodar o servidor na sua máquina — desenvolvimento, experimentos — o processo local lê o token da sessão:</p>
            <pre className="overflow-x-auto rounded-[16px] bg-noite p-5 text-[0.78rem] leading-relaxed text-brand-100"><code>OABASE_ACCESS_TOKEN=... pnpm mcp</code></pre>
            <pre className="overflow-x-auto rounded-[16px] bg-noite p-5 text-[0.72rem] leading-relaxed text-brand-100"><code>{CONFIGURACAO}</code></pre>
            <p className="max-w-[75ch] text-[0.86rem] leading-relaxed text-body">Em produção, use o endpoint HTTPS do OABase ({ENDERECO_MCP}). O cliente descobre o OAuth automaticamente; não cole token em prompt ou ferramenta. O servidor valida o token no Supabase a cada requisição, anuncia a metadata OAuth em <code>/.well-known/oauth-protected-resource/mcp</code> e nunca habilita ferramentas de administração.</p>
          </div>
        </details>
      </Container>
    </>
  );
}