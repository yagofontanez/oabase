import type { Metadata } from "next";
import Link from "next/link";
import { MolduraAuth } from "@/components/auth/moldura";
import { diasAte, getProximoExame } from "@/lib/content/queries";
import { FormularioRedefinir } from "./formulario";
export const metadata: Metadata = {
  title: "Nova senha",
  robots: { index: false, follow: false },
};
export default async function RedefinirSenhaPage() {
  const proximo = await getProximoExame();
  return (
    <MolduraAuth
      eyebrow="Acesso à conta"
      titulo="Escolha uma senha nova"
      descricao="Você chegou aqui pelo link que enviamos. Defina a nova senha e já entramos com ela."
      proximoExame={proximo}
      dias={diasAte(proximo.data)}
      rodape={
        <>
          O link expirou?{" "}
          <Link
            href="/recuperar-senha"
            className="font-semibold text-brand-600 underline decoration-brand-200 underline-offset-4 transition-colors hover:decoration-brand-500"
          >
            Pedir outro
          </Link>
        </>
      }
    >
      <FormularioRedefinir />
    </MolduraAuth>
  );
}
