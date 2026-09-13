import type { Metadata } from "next";
import Link from "next/link";
import { MolduraAuth } from "@/components/auth/moldura";
import { FormularioCriarConta } from "./formulario";

export const metadata: Metadata = {
  title: "Criar conta",
  robots: { index: false, follow: true },
};
export default function CriarContaPage() {
  return (
    <MolduraAuth
      variante="criar"
      eyebrow="Conta gratuita"
      titulo="Monte seu plano de estudos"
      descricao="Crie sua conta e monte um plano para a próxima prova da faculdade, para uma disciplina inteira ou para o Exame de Ordem."
      rodape={
        <>
          Já tem conta?{" "}
          <Link
            href="/entrar"
            className="font-semibold text-brand-600 underline decoration-brand-200 underline-offset-4 transition-colors hover:decoration-brand-500"
          >
            Entrar
          </Link>
        </>
      }
    >
      <FormularioCriarConta />
    </MolduraAuth>
  );
}
