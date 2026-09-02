import type { Metadata } from "next";
import Link from "next/link";
import { MolduraAuth } from "@/components/auth/moldura";
import { diasAte, getProximoExame } from "@/lib/content/queries";
import { cobrancaLiberada } from "@/lib/pagamento/asaas";
import { FormularioCriarConta } from "./formulario";
/* Ver a nota em /entrar: acervo e contagem regressiva envelhecem no build. */
export const revalidate = 3600;
export const metadata: Metadata = {
  title: "Criar conta",
  robots: { index: false, follow: true },
};
export default async function CriarContaPage() {
  const proximo = await getProximoExame();
  const dias = diasAte(proximo.data);
  return (
    <MolduraAuth
      eyebrow={`Faltam ${dias} dias`}
      titulo="Criar sua conta"
      descricao="Leva menos de um minuto. Depois você escolhe o plano — e ele dura até o dia da sua prova."
      proximoExame={proximo}
      dias={dias}
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
      {/* A frase sobre cobrança sai do servidor: o formulário é client e não
          enxerga `ASAAS_AMBIENTE`, que não tem prefixo público — nem deve
          ter. Assim o texto vira verdade sozinho quando o checkout abrir. */}
      <FormularioCriarConta checkoutAtivo={cobrancaLiberada} />
    </MolduraAuth>
  );
}
