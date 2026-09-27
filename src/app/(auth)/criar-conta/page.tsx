import type { Metadata } from "next";
import { Entrada } from "@/components/auth/entrada";
import { FormularioCriarConta } from "./formulario";

export const metadata: Metadata = {
  title: "Criar conta",
  robots: { index: false, follow: true },
};
export default function CriarContaPage() {
  return (
    <Entrada variante="criar">
      <FormularioCriarConta />
    </Entrada>
  );
}
