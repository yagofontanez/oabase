import type { Metadata } from "next";
import Link from "next/link";
import { MolduraAuth } from "@/components/auth/moldura";
import { diasAte, getProximoExame } from "@/lib/content/queries";
import { FormularioEntrar } from "./formulario";
export const metadata: Metadata = {
  title: "Entrar",
  robots: { index: false, follow: true },
};
export default async function EntrarPage() {
  const proximo = await getProximoExame();
  return (
    <MolduraAuth
      eyebrow="Área do assinante"
      titulo="Bem-vindo de volta"
      descricao="Entre para continuar de onde parou — o caderno de erros e a fila de revisão esperam por você."
      proximoExame={proximo}
      dias={diasAte(proximo.data)}
      rodape={
        <>
          Ainda não tem conta?{" "}
          <Link
            href="/criar-conta"
            className="font-semibold text-brand-600 underline decoration-brand-200 underline-offset-4 transition-colors hover:decoration-brand-500"
          >
            Criar conta
          </Link>
        </>
      }
    >
      <FormularioEntrar />
    </MolduraAuth>
  );
}
