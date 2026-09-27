import type { Metadata } from "next";
import Link from "next/link";
import { Entrada } from "@/components/auth/entrada";
import styles from "@/components/auth/entrada.module.css";
import { FormularioRecuperar } from "./formulario";
export const metadata: Metadata = {
  title: "Recuperar senha",
  robots: { index: false, follow: true },
};
export default function RecuperarSenhaPage() {
  return (
    <Entrada
      cabecalho={{
        eyebrow: "ACESSO À CONTA",
        titulo: <>Redefinir<br />sua senha</>,
        descricao: "Informe o e-mail da conta e enviamos um link para criar uma senha nova.",
      }}
      rodape={<>Lembrou? <Link href="/entrar" className={styles.textLink}>Voltar para entrar <span aria-hidden="true">↗</span></Link></>}
    >
      <FormularioRecuperar />
    </Entrada>
  );
}
