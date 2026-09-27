import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { urlPublica } from "@/lib/url-publica";

/**
 * Volta do login com o Google.
 *
 * O Google devolve para o Supabase, que devolve para cá com um `code`. A
 * troca do código pela sessão acontece no servidor (PKCE: o verificador está
 * no cookie que o navegador guardou ao sair), e a sessão é gravada na própria
 * resposta de redirecionamento — mesma forma de `/auth/confirm`.
 *
 * `proximo` só aceita caminho interno. Esta rota redireciona para onde o
 * endereço mandar; sem a checagem, um link de "entrar com Google" viraria
 * redirecionamento para qualquer site — a porta clássica de phishing.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const pedido = params.get("proximo");
  const proximo = pedido?.startsWith("/") && !pedido.startsWith("//") ? pedido : "/app";

  // Cancelou no Google, ou o Google recusou: volta ao login com o motivo.
  if (!code) {
    const volta = urlPublica(request, "/entrar");
    volta.searchParams.set("erro", "google");
    if (pedido) volta.searchParams.set("proximo", proximo);
    return NextResponse.redirect(volta);
  }

  const resposta = NextResponse.redirect(urlPublica(request, proximo));
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(novos) {
          novos.forEach(({ name, value, options }) =>
            resposta.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("Login com Google: troca do código falhou:", error.message);
    const volta = urlPublica(request, "/entrar");
    volta.searchParams.set("erro", "google");
    return NextResponse.redirect(volta);
  }
  return resposta;
}
