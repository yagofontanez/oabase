import type { Metadata } from "next";
import Link from "next/link";
import { MolduraAuth } from "@/components/auth/moldura";
import { FormularioEntrar } from "./formulario";

export const metadata: Metadata = {
  title: "Entrar",
  robots: { index: false, follow: true },
};

export default function EntrarPage() {
  return (
    <MolduraAuth
      eyebrow="Área de estudos"
      titulo="Bem-vindo de volta"
      descricao="Entre para continuar seu roadmap, retomar uma sessão ou revisar o que você estudou — na faculdade ou para a OAB."
      rodape={
        <>
          Ainda não tem conta?{" "}
          <Link href="/criar-conta" className="font-semibold text-brand-700 underline decoration-brand-200 underline-offset-4 transition-colors hover:decoration-brand-500">
            Criar conta
          </Link>
        </>
      }
    >
      <FormularioEntrar />
    </MolduraAuth>
  );
}
