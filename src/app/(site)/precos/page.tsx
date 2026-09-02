import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/container";
import { PageHeader } from "@/components/page-header";
import { JsonLd } from "@/lib/jsonld";
import { abs, site } from "@/lib/site";
import { planos } from "@/lib/planos";
import { diasAte, getProximoExame } from "@/lib/content/queries";
export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Planos e preços",
  description:
    "Acesso ao banco completo de questões comentadas, simulados, caderno de erros e revisão espaçada. Plano que dura até o dia da sua prova.",
  alternates: { canonical: "/precos" },
};
/* As perguntas descrevem o que existe hoje. Citar recurso que ainda não foi
   ao ar numa página de preço não é otimismo — é promessa que a pessoa paga
   para ter. */
const perguntas = [
  {
    q: "O que continua de graça?",
    a: "Toda a legislação comentada, as fichas dos exames e as estatísticas de incidência. Sem cadastro e sem limite de leitura.",
  },
  {
    q: "Posso desistir depois de pagar?",
    a: "Pode, em até 7 dias corridos, sem precisar justificar — é o direito de arrependimento do art. 49 do Código de Defesa do Consumidor. Basta escrever para o nosso contato e o valor volta integral.",
  },
  {
    q: "O que acontece quando eu faço a prova?",
    a: "O plano “Até a prova” vai até a data do exame que você escolheu ao assinar. Não há renovação automática nem cobrança surpresa depois.",
  },
  {
    q: "Como eu pago?",
    a: "Pix, cartão ou boleto, pela Asaas. Não há recorrência — você paga uma vez pelo período contratado, e o OABase não recebe os dados do seu cartão.",
  },
];
export default async function PrecosPage() {
  const proximo = await getProximoExame();
  const dias = diasAte(proximo.data);
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "@id": abs("/precos#faq"),
          mainEntity: perguntas.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        }}
      />

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: site.name,
          description: site.description,
          brand: { "@id": abs("/#organization") },
          offers: planos.map((plano) => ({
            "@type": "Offer",
            name: plano.nome,
            description: plano.resumo,
            price: plano.precoNumerico,
            priceCurrency: "BRL",
            availability: "https://schema.org/InStock",
            url: abs("/precos"),
          })),
        }}
      />

      <PageHeader
        crumbs={[
          { href: "/", label: "Início" },
          { href: "/precos", label: "Planos" },
        ]}
        eyebrow={`${proximo.edicao}º Exame · faltam ${dias} dias`}
        titulo={
          <>
            Um preço que cabe em quem{" "}
            <span className="text-ouro-500">ainda não é advogado</span>
          </>
        }
        descricao="Toda a legislação comentada e as estatísticas do site seguem abertas. O plano libera o banco de questões e as ferramentas de treino."
      />

      <Container className="py-16">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {planos.map((plano) => (
            <div
              key={plano.chave}
              // O destaque vem de um `ring` somado à borda, não de uma borda
              // mais grossa: `border-2` contra `border` faz o cartão em
              // destaque medir 2px a menos por dentro, e todo o conteúdo dele
              // — inclusive o botão — desce 1px em relação aos vizinhos. O
              // ring é desenhado por sombra e não ocupa espaço.
              className={`flex flex-col gap-6 rounded-2xl border bg-surface p-8 ${
                plano.destaque
                  ? "border-ouro-500 ring-1 ring-ouro-500 ring-inset"
                  : "border-line"
              }`}
            >
              <div className="flex flex-col gap-1">
                <span className="text-[0.86rem] font-semibold text-muted">
                  {plano.nome}
                </span>
                <span className="text-[3rem] leading-none font-bold tracking-[-0.025em] text-ink">
                  {plano.preco}
                </span>
                <span className="text-[0.86rem] text-muted">
                  {plano.periodo}
                </span>
              </div>

              <p className="text-[0.93rem] text-body">{plano.resumo}</p>

              <ul className="flex flex-1 flex-col gap-2.5 border-t border-line pt-6">
                {plano.itens.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2.5 text-[0.9rem] text-body"
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-[0.6em] block h-1.5 w-1.5 shrink-0 rounded-full ${
                        plano.destaque ? "bg-ouro-600" : "bg-brand-300"
                      }`}
                    />
                    {item}
                  </li>
                ))}
              </ul>

              <Link
                href={`/app/assinar?plano=${plano.chave}`}
                // Altura fixa pelo mesmo motivo da landing: rótulo que quebra
                // em duas linhas não pode deixar o botão mais alto que o do
                // cartão ao lado.
                className={`flex min-h-[3.4rem] items-center justify-center rounded-full px-4 text-center leading-tight font-semibold transition-colors ${
                  plano.destaque
                    ? "bg-ouro-500 text-brand-900 hover:bg-ouro-400"
                    : "border border-line text-ink hover:border-brand-300 hover:text-brand-600"
                }`}
              >
                {plano.cta}
              </Link>
            </div>
          ))}
        </div>

        <section className="mt-20 grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <h2 className="text-[1.9rem] leading-[1.08] font-semibold tracking-[-0.02em] sm:text-[2.3rem]">
            Antes de assinar
          </h2>

          <dl className="divide-y divide-line border-t border-line">
            {perguntas.map((item) => (
              <div key={item.q} className="flex flex-col gap-2 py-5">
                <dt className="font-semibold text-ink">{item.q}</dt>
                <dd className="max-w-[62ch] text-[0.93rem] text-muted">
                  {item.a}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <p className="mt-14 max-w-[68ch] text-[0.85rem] text-muted">
          Pagamento por Pix, cartão ou boleto, processado pela Asaas. Sem
          renovação automática. Ao assinar você aceita os{" "}
          <Link
            href="/termos"
            className="font-medium text-brand-600 underline decoration-brand-200 underline-offset-4"
          >
            Termos de Uso
          </Link>{" "}
          e a{" "}
          <Link
            href="/privacidade"
            className="font-medium text-brand-600 underline decoration-brand-200 underline-offset-4"
          >
            Política de Privacidade
          </Link>
          .
        </p>
      </Container>
    </>
  );
}
