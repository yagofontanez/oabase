import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AvisoEntrada } from "@/components/auth/aviso-entrada";
import { Entrada } from "@/components/auth/entrada";
import { usuarioAtual } from "@/lib/supabase/servidor";
import { ConsentimentoOAuth } from "./consentimento";

export const metadata: Metadata = {
  title: "Autorizar conexão",
  robots: { index: false, follow: false },
};

export default async function ConsentimentoPage({
  searchParams,
}: {
  searchParams: Promise<{ authorization_id?: string | string[] }>;
}) {
  const parametros = await searchParams;
  const authorizationId = Array.isArray(parametros.authorization_id)
    ? parametros.authorization_id[0]
    : parametros.authorization_id;

  if (!authorizationId) {
    return (
      <Entrada
        variante="conectar"
        cabecalho={{
          eyebrow: "CONEXÃO MCP",
          titulo: "Pedido inválido",
          descricao: "O endereço não contém uma solicitação de autorização válida.",
        }}
        rodape="Feche esta janela e tente conectar novamente pelo seu assistente."
      >
        <AvisoEntrada erro="Identificador de autorização ausente." />
      </Entrada>
    );
  }

  const usuario = await usuarioAtual();
  if (!usuario) {
    const retorno = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
    redirect(`/entrar?proximo=${encodeURIComponent(retorno)}`);
  }

  return (
    <Entrada
      variante="conectar"
      cabecalho={{
        eyebrow: "CONEXÃO MCP",
        titulo: <>Autorizar<br />assistente</>,
        descricao: "Confira quem está pedindo acesso antes de conectar sua conta de estudos.",
      }}
      rodape="Permita a conexão apenas se reconhecer e confiar no aplicativo."
    >
      <ConsentimentoOAuth authorizationId={authorizationId} />
    </Entrada>
  );
}
