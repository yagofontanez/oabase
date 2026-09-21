import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/container";
import { FormularioInteresseConcursos } from "@/components/formulario-interesse-concursos";
import { PageHeader } from "@/components/page-header";
import { JsonLd } from "@/lib/jsonld";
import { abs } from "@/lib/site";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Concursos jurídicos: legislação e estudo em Direito",
  description:
    "OABase está preparando uma frente para concursos jurídicos. Estude legislação e acompanhe a chegada de trilhas para tribunais, procuradorias, defensoria, MP e delegado.",
  alternates: { canonical: "/concursos" },
};

const CARREIRAS = [
  {
    titulo: "Tribunais",
    texto: "Para quem mira TJ, TRF, TRT e os cargos jurídicos que têm a lei seca como base recorrente.",
  },
  {
    titulo: "Procuradorias",
    texto: "Um caminho para organizar o estudo de Direito Público, Civil, Processual e legislação especial por edital.",
  },
  {
    titulo: "Defensoria e Ministério Público",
    texto: "Carreiras com leitura profunda de legislação e uma preparação que não cabe em uma lista solta de PDFs.",
  },
  {
    titulo: "Delegado de Polícia",
    texto: "Foco em Direito Penal, Processo Penal e legislação penal especial, em uma trilha que respeite o edital.",
  },
];

export default function Concursos() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "Concursos jurídicos | OABase",
          description: metadata.description,
          url: abs("/concursos"),
          inLanguage: "pt-BR",
        }}
      />

      <PageHeader
        crumbs={[
          { href: "/", label: "Início" },
          { href: "/concursos", label: "Concursos jurídicos" },
        ]}
        eyebrow="Nova frente"
        titulo={
          <>
            Estudo jurídico para a <span className="text-ouro-500">carreira</span> que vem depois
          </>
        }
        descricao="OAB é uma etapa. Para quem segue em concursos jurídicos, o que continua importando é dominar a lei, entender o contexto e estudar com direção. É essa frente que o OABase está preparando."
      />

      <Container className="flex flex-col gap-16 py-16">
        <section className="grid gap-8 lg:grid-cols-[1.1fr_.9fr] lg:items-start">
          <div className="flex flex-col gap-5">
            <h2 className="text-[1.9rem] leading-[1.08] font-semibold tracking-[-0.02em] sm:text-[2.3rem]">
              A mesma base de Direito. Outra linha de chegada.
            </h2>
            <p className="max-w-[64ch] text-[1.02rem] leading-relaxed text-body">
              A legislação aberta do OABase já serve a quem estuda além da OAB.
              A próxima etapa é organizar essa base para os editais e as
              carreiras jurídicas, sem transformar o estudo em cópia de
              conteúdo ou promessa vazia.
            </p>
            <p className="max-w-[64ch] text-[1.02rem] leading-relaxed text-body">
              Vamos começar pelo que é comum a essas provas: lei seca confiável,
              contexto de estudo e trilhas que deixam claro o que priorizar.
              Banco de questões específico só entra quando houver fonte e uso
              juridicamente seguros.
            </p>
            <Link
              href="/legislacao"
              className="self-start rounded-full border border-brand-200 px-5 py-2.5 text-[0.94rem] font-semibold text-brand-700 transition-colors hover:bg-brand-50"
            >
              Explorar a legislação aberta →
            </Link>
          </div>

          <aside className="rounded-[20px] border border-ouro-200 bg-ouro-50/60 p-6 sm:p-7">
            <p className="text-[0.8rem] font-bold tracking-[0.08em] text-ouro-700 uppercase">
              Primeiro passo
            </p>
            <h2 className="mt-2 text-[1.35rem] leading-tight font-semibold tracking-[-0.015em] text-ink">
              Diga qual carreira você estuda
            </h2>
            <p className="mt-2 text-[0.94rem] leading-relaxed text-body">
              Isso define por onde a primeira versão deve começar. Sem conta e
              sem compromisso.
            </p>
            <div className="mt-5">
              <FormularioInteresseConcursos />
            </div>
          </aside>
        </section>

        <section className="flex flex-col gap-6" aria-labelledby="carreiras">
          <div className="flex max-w-[64ch] flex-col gap-2">
            <p className="text-[0.8rem] font-bold tracking-[0.08em] text-brand-700 uppercase">
              Onde vamos começar
            </p>
            <h2 id="carreiras" className="text-[1.65rem] leading-tight font-semibold tracking-[-0.02em] sm:text-[2rem]">
              Concursos jurídicos, não concursos em geral
            </h2>
            <p className="text-body leading-relaxed">
              A proposta não é dispersar o produto em todas as áreas. É levar
              a base jurídica que já existe para as carreiras em que ela faz
              diferença todos os dias.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {CARREIRAS.map((carreira) => (
              <article key={carreira.titulo} className="rounded-[18px] border border-line bg-paper p-6">
                <h3 className="text-[1.12rem] font-semibold text-ink">{carreira.titulo}</h3>
                <p className="mt-2 text-[0.94rem] leading-relaxed text-body">{carreira.texto}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-hairline pt-12" aria-labelledby="agora">
          <div className="max-w-[66ch]">
            <p className="text-[0.8rem] font-bold tracking-[0.08em] text-brand-700 uppercase">
              O que já existe
            </p>
            <h2 id="agora" className="mt-2 text-[1.65rem] leading-tight font-semibold tracking-[-0.02em] sm:text-[2rem]">
              A base já está aberta para consulta
            </h2>
            <p className="mt-3 text-body leading-relaxed">
              Legislação, súmulas e busca continuam abertas e sem limite de
              leitura. A frente de concursos nasce em cima desse acervo — não
              como uma cópia dele em URLs novas.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/legislacao" className="text-[0.94rem] font-semibold text-brand-700 hover:text-brand-800">
                Legislação →
              </Link>
              <Link href="/sumulas" className="text-[0.94rem] font-semibold text-brand-700 hover:text-brand-800">
                Súmulas →
              </Link>
              <Link href="/busca" className="text-[0.94rem] font-semibold text-brand-700 hover:text-brand-800">
                Buscar no acervo →
              </Link>
            </div>
          </div>
        </section>
      </Container>
    </>
  );
}
