import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MolduraAuth } from "@/components/auth/moldura";
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
      <MolduraAuth
        eyebrow="Conexão MCP"
        titulo="Pedido inválido"
        descricao="O endereço não contém uma solicitação de autorização válida."
        rodape="Feche esta janela e tente conectar novamente pelo seu assistente."
      >
        <p className="rounded-xl border border-vinho-200 bg-vinho-50 px-4 py-3 text-sm text-vinho-700">
          Identificador de autorização ausente.
        </p>
      </MolduraAuth>
    );
  }

  const usuario = await usuarioAtual();
  if (!usuario) {
    const retorno = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
    redirect(`/entrar?proximo=${encodeURIComponent(retorno)}`);
  }

  return (
    <MolduraAuth
      eyebrow="Conexão MCP"
      titulo="Autorizar assistente"
      descricao="Confira quem está pedindo acesso antes de conectar sua conta de estudos."
      rodape="Permita a conexão apenas se reconhecer e confiar no aplicativo."
    >
      <ConsentimentoOAuth authorizationId={authorizationId} />
    </MolduraAuth>
  );
}
