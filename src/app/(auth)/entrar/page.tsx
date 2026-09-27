import type { Metadata } from "next";
import { Entrada } from "@/components/auth/entrada";
import { FormularioEntrar } from "./formulario";

export const metadata: Metadata = {
  title: "Entrar",
  robots: { index: false, follow: true },
};

export default function EntrarPage() {
  return (
    <Entrada>
      <FormularioEntrar />
    </Entrada>
  );
}
