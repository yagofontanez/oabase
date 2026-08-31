import Link from "next/link";
import { Container } from "@/components/container";
import { Wordmark } from "@/components/wordmark";

/**
 * Chrome das telas de conta: só o necessário.
 *
 * Uma tela de foco não tem menu nem rodapé — cada link ali é um convite a
 * abandonar a tarefa. Fica a marca, para orientar, e uma saída explícita.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 flex-col">
      <div className="border-b border-line/70">
        <Container className="flex h-[70px] items-center justify-between gap-6">
          <Link href="/" aria-label="OABase, página inicial">
            <Wordmark />
          </Link>
          <Link
            href="/"
            className="rounded-full px-4 py-2 text-[0.92rem] font-medium text-muted transition-colors hover:bg-brand-50 hover:text-brand-700"
          >
            Voltar ao site
          </Link>
        </Container>
      </div>

      <div className="flex flex-1 flex-col justify-center">{children}</div>
    </main>
  );
}
