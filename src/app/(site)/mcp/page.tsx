import type { Metadata } from "next";
import { Container } from "@/components/container";
import { PageHeader } from "@/components/page-header";
import { JsonLd } from "@/lib/jsonld";
import { abs } from "@/lib/site";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "MCP de estudos do OABase",
  description: "Conecte o OABase ao seu assistente de IA e estude com legislação, questões, progresso e sessões guiadas.",
  alternates: { canonical: abs("/mcp") },
};

const ferramentas = [
  ["buscar_legislacao", "Encontre artigos e súmulas por texto ou número."],
  ["buscar_sumulas", "Consulte enunciados oficiais com a fonte."],
  ["buscar_questoes", "Monte uma fila sem revelar o gabarito antes da hora."],
  ["explicar_questao", "Leia apenas comentários autorais já publicados."],
  ["registrar_resposta", "Responda e deixe o banco fazer a correção."],
  ["ver_meu_progresso", "Veja acertos, erros e revisões vencidas."],
  ["o_que_estudar_agora", "Receba o próximo bloco do seu roadmap."],
  ["abrir_sessao_de_estudo", "Comece uma sessão de foco ligada ao plano."],
] as const;

const perguntas = [
  ["O MCP consegue ver meus dados?", "Só quando você fornece o token da sua própria sessão. A mesma RLS do OABase continua decidindo o que pode ser lido, e uma conta nunca enxerga dados de outra."],
  ["O assistente pode inventar uma explicação?", "A ferramenta de explicação só devolve comentário autoral publicado. Quando a questão ainda não foi comentada, o MCP informa isso em vez de preencher a lacuna com texto não revisado."],
  ["Ele tem acesso ao painel administrativo?", "Não. O servidor não oferece ferramentas de pagamentos, clientes, moderação, redação editorial ou qualquer operação interna."],
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
        descricao="O MCP conecta clientes de IA ao acervo e ao seu progresso no OABase. Você continua estudando com fontes reais, mas pode pedir ajuda no lugar em que já conversa com sua IA."
      />
      <Container className="py-16">
        <section className="grid overflow-hidden rounded-[26px] bg-brand-900 text-white shadow-[0_22px_60px_rgba(8,58,49,.14)] lg:grid-cols-[1.05fr_.95fr]">
          <div className="p-7 sm:p-10">
            <span className="text-[0.7rem] font-bold tracking-[0.14em] text-ouro-200 uppercase">Como funciona</span>
            <h2 className="mt-3 max-w-[17ch] text-[clamp(1.8rem,4vw,2.8rem)] leading-[1.02] font-extrabold tracking-[-0.05em] text-white">A conversa entende o que você está estudando.</h2>
            <p className="mt-4 max-w-[54ch] text-[0.94rem] leading-relaxed text-brand-100">O cliente de IA chama uma ferramenta do OABase, o banco aplica as permissões e a resposta volta com o contexto necessário para continuar o estudo.</p>
            <div className="mt-7 grid gap-2.5 sm:grid-cols-3">{[["1", "Você pergunta", "“O que estudo agora?”"], ["2", "O MCP consulta", "roadmap e revisões"], ["3", "Você executa", "com fonte e registro"]].map(([numero, titulo, detalhe]) => <div key={numero} className="rounded-[15px] bg-white/8 p-3.5"><span className="text-[0.7rem] font-bold text-ouro-200">{numero}</span><strong className="mt-2 block text-[0.8rem] text-white">{titulo}</strong><span className="mt-1 block text-[0.72rem] leading-relaxed text-brand-100">{detalhe}</span></div>)}</div>
          </div>
          <div className="border-t border-white/10 bg-white/6 p-7 sm:p-10 lg:border-t-0 lg:border-l"><span className="text-[0.7rem] font-bold tracking-[0.14em] text-ouro-200 uppercase">Um exemplo</span><div className="mt-4 rounded-[17px] border border-white/10 bg-noite p-5 font-mono text-[0.78rem] leading-relaxed text-brand-100"><p><span className="text-ouro-200">Você:</span> Tenho 40 minutos e três revisões vencidas. O que faço?</p><p className="mt-4 border-t border-white/10 pt-4"><span className="text-ouro-200">Assistente:</span> Vou consultar suas revisões e o próximo bloco do roadmap, sem revelar gabarito antes de você responder.</p><p className="mt-4 border-t border-white/10 pt-4 text-white"><span className="text-brand-300">OABase:</span> 3 revisões vencidas · próximo bloco: Direito Constitucional · 40 min disponíveis.</p></div><p className="mt-4 text-[0.78rem] leading-relaxed text-brand-100">A IA organiza a próxima ação. A legislação e a correção continuam vindo do OABase.</p></div>
        </section>

        <section className="mt-20 grid gap-10 lg:grid-cols-[.7fr_1.3fr]"><div><span className="rotulo">Ferramentas</span><h2 className="mt-1 text-[1.9rem] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[2.3rem]">Tudo que o assistente pode fazer</h2></div><div className="grid gap-3 sm:grid-cols-2">{ferramentas.map(([nome, descricao]) => <article key={nome} className="rounded-[16px] border border-line bg-surface p-5"><code className="text-[0.78rem] font-bold text-brand-700">{nome}</code><p className="mt-2 text-[0.84rem] leading-relaxed text-body">{descricao}</p></article>)}</div></section>

        <section className="mt-20 grid gap-10 lg:grid-cols-[.7fr_1.3fr]"><div><span className="rotulo">Comece em dois minutos</span><h2 className="mt-1 text-[1.9rem] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[2.3rem]">Conecte um cliente local</h2><p className="mt-4 max-w-[36ch] text-[0.9rem] leading-relaxed text-body">O modo local é o caminho mais simples: o cliente inicia o servidor e conversa com ele via stdio.</p></div><div className="flex flex-col gap-5"><div><span className="text-[0.75rem] font-bold text-muted uppercase">1 · No terminal</span><pre className="mt-2 overflow-x-auto rounded-[16px] bg-noite p-5 text-[0.78rem] leading-relaxed text-brand-100"><code>OABASE_ACCESS_TOKEN=... pnpm mcp</code></pre></div><div><span className="text-[0.75rem] font-bold text-muted uppercase">2 · No cliente MCP</span><pre className="mt-2 overflow-x-auto rounded-[16px] bg-noite p-5 text-[0.72rem] leading-relaxed text-brand-100"><code>{CONFIGURACAO}</code></pre></div><p className="text-[0.78rem] leading-relaxed text-muted">A URL e a chave anônima do Supabase também precisam estar no ambiente. O token é o access token da sua sessão, nunca uma service role.</p></div></section>

        <section className="mt-20 rounded-[22px] border border-ouro-200 bg-ouro-50 p-6 sm:p-8"><span className="text-[0.7rem] font-bold tracking-[0.14em] text-ouro-700 uppercase">Regra de confiança</span><h2 className="mt-2 text-[1.45rem] font-bold text-ink">A IA não substitui a fonte.</h2><p className="mt-2 max-w-[75ch] text-[0.9rem] leading-relaxed text-body">O MCP reduz a decisão de “o que fazer agora”. Quando o assunto é Direito, a resposta precisa apontar para legislação, súmula ou comentário publicado. Se não houver fonte no acervo, o assistente deve dizer que não há base suficiente.</p></section>

        <section className="mt-20 grid gap-10 lg:grid-cols-[.7fr_1.3fr]"><div><span className="rotulo">Dúvidas comuns</span><h2 className="mt-1 text-[1.9rem] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[2.3rem]">Antes de conectar</h2></div><dl className="divide-y divide-line border-t border-line">{perguntas.map(([pergunta, resposta]) => <div key={pergunta} className="py-5"><dt className="text-[0.98rem] font-bold text-ink">{pergunta}</dt><dd className="mt-2 max-w-[68ch] text-[0.88rem] leading-relaxed text-body">{resposta}</dd></div>)}</dl></section>
      </Container>
    </>
  );
}
