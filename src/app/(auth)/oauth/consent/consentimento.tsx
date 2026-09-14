"use client";

import { useEffect, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/browser";

type Detalhes = {
  authorization_id: string;
  redirect_uri: string;
  scope: string;
  client: { id: string; name: string; uri: string; logo_uri: string };
  user: { id: string; email: string };
};

const NOMES_DOS_ESCOPOS: Record<string, string> = {
  openid: "Confirmar sua identidade",
  profile: "Ler seu perfil básico",
  email: "Ler o e-mail da sua conta",
};

export function ConsentimentoOAuth({ authorizationId }: { authorizationId: string }) {
  const [detalhes, setDetalhes] = useState<Detalhes | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [decidindo, setDecidindo] = useState<"aprovar" | "negar" | null>(null);

  useEffect(() => {
    let ativo = true;
    void supabaseNavegador().auth.oauth
      .getAuthorizationDetails(authorizationId)
      .then(({ data, error }) => {
        if (!ativo) return;
        if (error || !data) {
          setErro("Não foi possível validar este pedido de conexão.");
          return;
        }
        if ("redirect_url" in data) {
          window.location.assign(data.redirect_url);
          return;
        }
        setDetalhes(data as Detalhes);
      });
    return () => {
      ativo = false;
    };
  }, [authorizationId]);

  async function decidir(acao: "aprovar" | "negar") {
    setDecidindo(acao);
    setErro(null);
    const auth = supabaseNavegador().auth.oauth;
    const { data, error } = acao === "aprovar"
      ? await auth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
      : await auth.denyAuthorization(authorizationId, { skipBrowserRedirect: true });
    if (error || !data?.redirect_url) {
      setErro("Não foi possível registrar sua escolha. Tente novamente.");
      setDecidindo(null);
      return;
    }
    window.location.assign(data.redirect_url);
  }

  if (erro && !detalhes) {
    return (
      <p role="alert" className="rounded-xl border border-vinho-200 bg-vinho-50 px-4 py-3 text-sm text-vinho-700">
        {erro}
      </p>
    );
  }

  if (!detalhes) {
    return <p role="status" className="text-sm text-muted">Validando o aplicativo…</p>;
  }

  const escopos = detalhes.scope.split(" ").filter(Boolean);
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-ink/10 bg-white/65 p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-lg font-bold text-brand-800" aria-hidden="true">
            {detalhes.client.name.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <strong className="block truncate text-ink">{detalhes.client.name}</strong>
            <span className="block truncate text-xs text-muted">{detalhes.redirect_uri}</span>
          </div>
        </div>
        <ul className="mt-5 flex flex-col gap-2.5">
          {escopos.map((escopo) => (
            <li key={escopo} className="flex items-center gap-2.5 text-sm text-body">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-[0.65rem] font-bold text-brand-700" aria-hidden="true">✓</span>
              {NOMES_DOS_ESCOPOS[escopo] ?? `Permissão: ${escopo}`}
            </li>
          ))}
        </ul>
      </div>

      {erro && <p role="alert" className="text-sm text-vinho-700">{erro}</p>}
      <p className="text-xs leading-relaxed text-muted">
        A conexão poderá consultar seu roadmap, progresso e conteúdo de estudo. Ela não recebe acesso a pagamentos, suporte ou áreas administrativas.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={Boolean(decidindo)}
          onClick={() => void decidir("negar")}
          className="rounded-full border border-ink/15 px-4 py-3 text-sm font-semibold text-body transition-colors hover:bg-white disabled:opacity-50"
        >
          {decidindo === "negar" ? "Negando…" : "Negar"}
        </button>
        <button
          type="button"
          disabled={Boolean(decidindo)}
          onClick={() => void decidir("aprovar")}
          className="rounded-full bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
        >
          {decidindo === "aprovar" ? "Conectando…" : "Permitir conexão"}
        </button>
      </div>
    </div>
  );
}
