import type { Metadata } from "next";
import Link from "next/link";
import { Entrada } from "@/components/auth/entrada";
import styles from "@/components/auth/entrada.module.css";
import { FormularioRedefinir } from "./formulario";
export const metadata: Metadata = {
  title: "Nova senha",
  robots: { index: false, follow: false },
};
export default function RedefinirSenhaPage() {
  return (
    <Entrada
      cabecalho={{
        eyebrow: "ACESSO À CONTA",
        titulo: <>Escolha uma<br />senha nova</>,
        descricao: "Você chegou aqui pelo link que enviamos. Defina a nova senha e já entramos com ela.",
      }}
      rodape={<>O link expirou? <Link href="/recuperar-senha" className={styles.textLink}>Pedir outro <span aria-hidden="true">↗</span></Link></>}
    >
      <FormularioRedefinir />
    </Entrada>
  );
}
