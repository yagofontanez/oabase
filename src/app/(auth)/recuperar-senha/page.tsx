import type { Metadata } from "next";
import Link from "next/link";
import { MolduraAuth } from "@/components/auth/moldura";
import { FormularioRecuperar } from "./formulario";
export const metadata: Metadata = {
  title: "Recuperar senha",
  robots: { index: false, follow: true },
};
export default function RecuperarSenhaPage() {
  return (
    <MolduraAuth
      eyebrow="Acesso à conta"
      titulo="Redefinir sua senha"
      descricao="Informe o e-mail da conta e enviamos um link para você criar uma senha nova."
      rodape={
        <>
          Lembrou?{" "}
          <Link
            href="/entrar"
            className="font-semibold text-brand-600 underline decoration-brand-200 underline-offset-4 transition-colors hover:decoration-brand-500"
          >
            Voltar para entrar
          </Link>
        </>
      }
    >
      <FormularioRecuperar />
    </MolduraAuth>
  );
}
