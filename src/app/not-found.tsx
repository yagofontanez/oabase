import Link from "next/link";
import { Container } from "@/components/container";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Container className="flex max-w-[48ch] flex-col items-start gap-5 py-28">
          <span className="text-[0.68rem] font-semibold text-muted">
            Erro 404
          </span>
          <h1 className="text-4xl font-extrabold tracking-[-0.035em] sm:text-[3rem]">
            Essa página não existe
          </h1>
          <p className="text-body">
            O endereço pode ter mudado ou o conteúdo ainda não foi publicado.
            Comece pela legislação comentada ou pela ficha dos exames.
          </p>
          <div className="flex flex-wrap gap-4 pt-2">
            <Link
              href="/legislacao"
              className="rounded-full bg-brand-500 px-6 py-2.5 font-semibold text-white transition-colors hover:bg-brand-600"
            >
              Ver legislação
            </Link>
            <Link
              href="/exames"
              className="rounded-full border border-line px-6 py-2.5 font-semibold text-ink transition-colors hover:border-brand-300"
            >
              Ver exames
            </Link>
          </div>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
