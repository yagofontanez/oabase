import type { Metadata } from "next";
import { Entrada } from "@/components/auth/entrada";
import { getExames } from "@/lib/content/queries";
import { FormularioCriarConta } from "./formulario";

export const metadata: Metadata = {
  title: "Criar conta",
  robots: { index: false, follow: true },
};
export default async function CriarContaPage() {
  // A oferta da conta gratuita é o exame que a RLS de fato abre
  // (`exames.amostra_gratuita`) — o texto não promete o que o banco não dá.
  const amostra = (await getExames()).find((e) => e.amostraGratuita && e.questoesCarregadas > 0);
  return (
    <Entrada
      variante="criar"
      cabecalho={{
        eyebrow: "CONTA GRATUITA · SEM CARTÃO",
        titulo: <>Seu caminho <br />começa aqui</>,
        descricao: amostra
          ? `Já sai com o ${amostra.edicao}º Exame inteiro para resolver, com gabarito e comentário.`
          : "Organize seus estudos. Avance no seu ritmo.",
      }}
    >
      <FormularioCriarConta />
    </Entrada>
  );
}
