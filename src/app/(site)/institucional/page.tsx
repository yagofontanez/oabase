import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/container";
import { PageHeader } from "@/components/page-header";
import { JsonLd } from "@/lib/jsonld";
import { operador } from "@/lib/legal";
import { abs, site } from "@/lib/site";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "OABase para instituições: faculdades e cursinhos",
  description:
    "Licença institucional do OABase para faculdades de Direito e cursinhos preparatórios: questões oficiais, simulados e desempenho por disciplina, com piloto gratuito para uma turma.",
  alternates: { canonical: abs("/institucional") },
};

const faixas = [
  { alunos: "1 a 99 alunos", preco: "R$ 6,00" },
  { alunos: "100 a 499 alunos", preco: "R$ 4,50" },
  { alunos: "500 ou mais", preco: "R$ 3,00" },
];

const packs = [
  { assentos: "50 assentos", preco: "R$ 1.200,00" },
  { assentos: "100 assentos", preco: "R$ 2.000,00" },
  { assentos: "250 assentos", preco: "R$ 4.000,00" },
];

const niveis = [
  {
    nome: "Turma (piloto)",
    itens: [
      "Alunos com acesso completo à plataforma",
      "Relatório de uso e desempenho da turma",
    ],
  },
  {
    nome: "Institucional",
    destaque: true,
    itens: [
      "Tudo do nível Turma",
      "Acompanhamento por disciplina",
      "Onboarding e treinamento",
      "Suporte prioritário",
    ],
  },
  {
    nome: "Marca própria + Integração",
    itens: [
      "Subdomínio com a marca da instituição",
      "Integração via API/MCP",
    ],
  },
];

const contato = `mailto:${operador.email}?subject=${encodeURIComponent(
  "Licença institucional do OABase",
)}`;

export default function InstitucionalPage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          "@id": abs("/institucional"),
          name: "OABase para instituições",
          inLanguage: "pt-BR",
          isPartOf: { "@id": abs("/#website") },
          about: {
            "@type": "Service",
            name: "Licença institucional do OABase",
            provider: { "@id": abs("/#organization") },
            areaServed: "BR",
          },
        }}
      />

      <PageHeader
        crumbs={[
          { href: "/", label: "Início" },
          { href: "/institucional", label: "Para instituições" },
        ]}
        eyebrow="Faculdades de Direito e cursinhos"
        titulo={
          <>
            O OABase na sua <span className="text-ouro-500">turma</span>
          </>
        }
        descricao="Questões oficiais, simulados no formato da prova, caderno de erros e revisão espaçada para os alunos. Relatório de desempenho por disciplina para a instituição."
      >
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={contato}
            className="rounded-full bg-brand-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Falar sobre o piloto
          </a>
          <a
            href="/proposta-institucional.pdf"
            className="rounded-full border border-line px-6 py-3 font-semibold text-ink transition-colors hover:border-brand-300 hover:text-brand-600"
          >
            Baixar a proposta (PDF)
          </a>
        </div>
      </PageHeader>

      <Container className="py-16">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-line bg-surface p-8">
            <h2 className="text-[1.2rem] font-bold text-ink">
              Para os alunos
            </h2>
            <ul className="mt-4 flex flex-col gap-2.5">
              {[
                "Simulados cronometrados e banco completo de questões da OAB",
                "Caderno de erros automático e revisão espaçada",
                "Roadmap, calendário, sessões de foco e flashcards",
                "Desempenho por disciplina com a régua real da prova",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-[0.95rem] text-body">
                  <span aria-hidden="true" className="mt-[0.6em] block h-1.5 w-1.5 shrink-0 rounded-full bg-brand-300" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-8">
            <h2 className="text-[1.2rem] font-bold text-ink">
              Para a instituição
            </h2>
            <ul className="mt-4 flex flex-col gap-2.5">
              {[
                "Visibilidade de desempenho por disciplina, para agir antes da prova",
                "Nada para montar: banco de questões e ferramentas já prontos",
                "Conteúdo de fonte oficial, revisado antes de publicar",
                "Relatório de uso para a coordenação",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-[0.95rem] text-body">
                  <span aria-hidden="true" className="mt-[0.6em] block h-1.5 w-1.5 shrink-0 rounded-full bg-brand-300" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <section className="mt-20">
          <h2 className="text-[1.9rem] leading-[1.08] font-semibold tracking-[-0.02em] sm:text-[2.3rem]">
            Níveis
          </h2>
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {niveis.map((nivel) => (
              <div
                key={nivel.nome}
                className={`flex flex-col gap-4 rounded-2xl border bg-surface p-8 ${
                  nivel.destaque ? "border-ouro-500 ring-1 ring-ouro-500 ring-inset" : "border-line"
                }`}
              >
                <h3 className="text-[1.05rem] font-semibold text-ink">
                  {nivel.nome}
                </h3>
                <ul className="flex flex-1 flex-col gap-2.5 border-t border-line pt-5">
                  {nivel.itens.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-[0.92rem] text-body">
                      <span
                        aria-hidden="true"
                        className={`mt-[0.6em] block h-1.5 w-1.5 shrink-0 rounded-full ${
                          nivel.destaque ? "bg-ouro-600" : "bg-brand-300"
                        }`}
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-20 grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-[1.9rem] leading-[1.08] font-semibold tracking-[-0.02em] sm:text-[2.3rem]">
              Investimento
            </h2>
            <p className="mt-4 max-w-[52ch] text-[1rem] text-body">
              Licença por aluno/mês, paga pela instituição, com desconto por
              volume. Contrato semestral ou anual, com nota fiscal. Cursinhos
              podem optar pelo pack &ldquo;até a prova&rdquo;, com assentos
              válidos até a edição.
            </p>
          </div>

          <div className="flex flex-col gap-6">
            <div className="overflow-hidden rounded-2xl border border-line bg-surface">
              <table className="w-full text-left text-[0.95rem]">
                <caption className="sr-only">
                  Preço por aluno conforme o volume de licenças
                </caption>
                <thead className="bg-sunk text-[0.82rem] tracking-[0.06em] text-muted uppercase">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Alunos licenciados</th>
                    <th className="px-6 py-3 text-right font-semibold">Por aluno/mês</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {faixas.map((f) => (
                    <tr key={f.alunos}>
                      <td className="px-6 py-4 text-body">{f.alunos}</td>
                      <td className="px-6 py-4 text-right font-semibold text-ink tabular-nums">
                        {f.preco}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="overflow-hidden rounded-2xl border border-line bg-surface">
              <table className="w-full text-left text-[0.95rem]">
                <caption className="sr-only">
                  Pack até a prova para cursinhos
                </caption>
                <thead className="bg-sunk text-[0.82rem] tracking-[0.06em] text-muted uppercase">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Pack até a prova</th>
                    <th className="px-6 py-3 text-right font-semibold">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {packs.map((p) => (
                    <tr key={p.assentos}>
                      <td className="px-6 py-4 text-body">{p.assentos}</td>
                      <td className="px-6 py-4 text-right font-semibold text-ink tabular-nums">
                        {p.preco}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="mt-20 rounded-2xl border border-ouro-200 bg-ouro-50 p-8 sm:p-10">
          <span className="text-[0.8rem] font-bold tracking-[0.12em] text-ouro-600 uppercase">
            Sem risco
          </span>
          <h2 className="mt-2 text-[1.5rem] leading-tight font-semibold tracking-[-0.02em] text-ink sm:text-[1.9rem]">
            Piloto gratuito para uma turma
          </h2>
          <p className="mt-3 max-w-[62ch] text-[1rem] text-body">
            Liberamos de 30 a 60 dias para uma turma, sem custo e sem
            compromisso. No fim, a instituição recebe um relatório de
            desempenho e decide se faz sentido seguir com a licença.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              href={contato}
              className="rounded-full bg-brand-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Começar o piloto
            </a>
            <Link
              href="/precos"
              className="text-[0.95rem] font-medium text-brand-700 underline-offset-4 hover:underline"
            >
              Ver os planos individuais
            </Link>
          </div>
        </section>

        <p className="mt-16 text-[0.88rem] text-muted">
          {site.name} é um serviço educacional independente, sem vínculo com a
          OAB ou com a banca examinadora. Dúvidas?{" "}
          <a
            href={`mailto:${operador.email}`}
            className="font-medium text-brand-700 underline-offset-4 hover:underline"
          >
            {operador.email}
          </a>
          .
        </p>
      </Container>
    </>
  );
}
