import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/container";
import { PageHeader } from "@/components/page-header";
import { JsonLd } from "@/lib/jsonld";
import { formatarData } from "@/lib/format";
import { diasAte, getExames, getProximoExame } from "@/lib/content/queries";

export const revalidate = 3600;

/**
 * A porta de entrada de quem vem do vídeo.
 *
 * O TikTok promete "a prova da OAB inteira de graça, link no perfil", e o link
 * caía na home — que fala de plano de estudos e de faculdade, sem uma palavra
 * sobre prova grátis. Quem clicava não encontrava o que foi buscar. Esta
 * página repete a promessa do vídeo e tem um botão só.
 *
 * O exame é o que a RLS de fato abre (`exames.amostra_gratuita`): trocar a
 * amostra é um UPDATE, e a página acompanha. Sem amostra, ela não existe — e
 * sai do sitemap pela mesma condição em `urls.ts`.
 *
 * Ter endereço próprio é também o que mede o funil: o log do Caddy descarta a
 * query string, então um `?utm=` sumiria, mas o caminho fica.
 */
async function amostraGratuita() {
  const exames = await getExames();
  const ingeridos = exames.filter((e) => e.questoesCarregadas > 0);
  const amostra = ingeridos.find((e) => e.amostraGratuita);
  return amostra ? { amostra, outros: ingeridos.length - 1 } : null;
}

/** Depois do cadastro, a pessoa cai na primeira questão — não no painel. */
const DESTINO = "/app/questoes";

export async function generateMetadata(): Promise<Metadata> {
  const dados = await amostraGratuita();
  if (!dados) return {};
  const { amostra } = dados;
  return {
    title: `Prova da OAB grátis: o ${amostra.edicao}º Exame inteiro, com gabarito`,
    description: `Resolva as ${amostra.questoesCarregadas} questões do ${amostra.edicao}º Exame de Ordem de graça, com gabarito oficial da FGV, comentário em cada questão e revisão dos erros. Só precisa de uma conta, sem cartão.`,
    alternates: { canonical: "/prova-gratis" },
  };
}

export default async function ProvaGratis() {
  const [dados, proximo] = await Promise.all([amostraGratuita(), getProximoExame()]);
  if (!dados) notFound();
  const { amostra, outros } = dados;

  const quando = formatarData(amostra.data, { month: "long", year: "numeric" });
  const dias = diasAte(proximo.data);
  const gabarito = amostra.gabaritoDefinitivo ? "definitivo" : "preliminar";
  const criarConta = `/criar-conta?proximo=${DESTINO}`;
  const entrar = `/entrar?proximo=${DESTINO}`;

  const faq = [
    {
      q: "É de graça mesmo?",
      a: `É. As ${amostra.questoesCarregadas} questões do ${amostra.edicao}º Exame ficam abertas para qualquer conta, sem plano e sem cartão. Não há período de teste que vira cobrança.`,
    },
    {
      q: "Por que precisa criar conta?",
      a: "Porque a resolução guarda o que você respondeu: a taxa de acerto, o caderno de erros e a revisão das questões que você errou dependem disso. A conta é gratuita e dá para entrar com o Google.",
    },
    {
      q: "As questões são da prova de verdade?",
      a: `São. Foram extraídas do caderno oficial do ${amostra.edicao}º Exame de Ordem Unificado, aplicado em ${quando}, e corrigidas pelo gabarito ${gabarito} da FGV.`,
    },
    {
      q: "O que não está incluído?",
      a: `Os outros ${outros} exames do banco e o simulado cronometrado fazem parte do plano pago. A prova grátis é completa: dá para resolver as ${amostra.questoesCarregadas} questões do começo ao fim.`,
    },
  ];

  const botaoPrincipal =
    "flex min-h-12 items-center justify-center rounded-full bg-brand-600 px-7 font-semibold text-white transition-colors hover:bg-brand-700";
  const botaoSecundario =
    "flex min-h-12 items-center justify-center rounded-full border border-line bg-surface px-7 font-semibold text-ink transition-colors hover:border-brand-600";

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faq.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        }}
      />

      <PageHeader
        crumbs={[
          { href: "/", label: "Início" },
          { href: "/prova-gratis", label: "Prova grátis" },
        ]}
        eyebrow={`${amostra.edicao}º Exame · ${quando}`}
        titulo={
          <>
            A prova da OAB inteira.{" "}
            <span className="text-ouro-500">De graça.</span>
          </>
        }
        descricao={`As ${amostra.questoesCarregadas} questões do ${amostra.edicao}º Exame de Ordem, com gabarito oficial da FGV e comentário em cada uma. Crie a conta e comece pela primeira questão.`}
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href={criarConta} className={botaoPrincipal}>
            Fazer o {amostra.edicao}º grátis
          </Link>
          <Link href={entrar} className={botaoSecundario}>
            Já tenho conta
          </Link>
        </div>
        <p className="text-[0.86rem] text-muted">
          Conta gratuita · sem cartão · entra com o Google
          {dias > 0 && ` · faltam ${dias} dias para o ${proximo.edicao}º Exame`}
        </p>
      </PageHeader>

      <Container className="flex flex-col gap-16 py-16">
        <dl className="grid gap-x-10 gap-y-6 sm:grid-cols-3">
          {[
            [
              `${amostra.questoesCarregadas}`,
              "questões oficiais",
              "do caderno da prova, sem adaptação",
            ],
            [
              gabarito,
              "gabarito da FGV",
              amostra.gabaritoDefinitivo ? "publicado depois dos recursos" : "a OAB não publicou o definitivo desta edição",
            ],
            ["40", "acertos para passar", "a mesma régua da prova de verdade"],
          ].map(([valor, rotulo, nota]) => (
            <div key={rotulo} className="flex flex-col gap-1 border-t border-line pt-4">
              <dt className="text-[0.86rem] font-semibold text-muted">{rotulo}</dt>
              <dd className="text-[1.7rem] leading-none font-bold tracking-[-0.02em] text-ink">{valor}</dd>
              <dd className="text-[0.84rem] text-muted">{nota}</dd>
            </div>
          ))}
        </dl>

        <section className="flex flex-col gap-6">
          <h2 className="text-[1.9rem] leading-[1.08] font-semibold tracking-[-0.02em] sm:text-[2.3rem]">
            Como funciona
          </h2>
          <ol className="grid gap-4 sm:grid-cols-3">
            {[
              {
                titulo: "Crie a conta",
                texto: "Com e-mail ou com o Google. Não pedimos cartão.",
              },
              {
                titulo: "Responda",
                texto: "Uma questão por vez. Ao marcar, aparecem o gabarito e o comentário.",
              },
              {
                titulo: "Revise o que errou",
                texto: "A questão errada entra no caderno de erros e volta no dia certo para você revisar.",
              },
            ].map((passo, i) => (
              <li key={passo.titulo} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-6">
                <span className="text-[0.86rem] font-semibold text-brand-600 tabular-nums">{i + 1}</span>
                <span className="text-[1.1rem] font-semibold text-ink">{passo.titulo}</span>
                <span className="text-[0.95rem] leading-relaxed text-body">{passo.texto}</span>
              </li>
            ))}
          </ol>
          <p className="max-w-[70ch] text-[1.02rem] leading-relaxed text-body">
            Quer ver antes como a prova se dividiu entre as disciplinas? Está na{" "}
            <Link href={`/exames/${amostra.slug}`} className="font-semibold text-brand-600 underline underline-offset-4">
              página do {amostra.edicao}º Exame
            </Link>
            , aberta e sem conta.
          </p>
        </section>

        <section className="flex flex-col gap-6">
          <h2 className="text-[1.9rem] leading-[1.08] font-semibold tracking-[-0.02em] sm:text-[2.3rem]">
            Perguntas frequentes
          </h2>
          <dl className="flex max-w-[70ch] flex-col gap-6">
            {faq.map((item) => (
              <div key={item.q} className="flex flex-col gap-2 border-t border-line pt-4">
                <dt className="text-[1.05rem] font-semibold text-ink">{item.q}</dt>
                <dd className="text-[1rem] leading-relaxed text-body">{item.a}</dd>
              </div>
            ))}
          </dl>
          <p className="max-w-[70ch] text-[1.02rem] leading-relaxed text-body">
            Depois da prova grátis, os planos estão em{" "}
            <Link href="/precos" className="font-semibold text-brand-600 underline underline-offset-4">
              Planos
            </Link>
            .
          </p>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href={criarConta} className={botaoPrincipal}>
            Fazer o {amostra.edicao}º grátis
          </Link>
        </div>
      </Container>
    </>
  );
}
