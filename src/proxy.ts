import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Renova a sessão a cada navegação e guarda a fronteira do produto.
 *
 * No Next 16 o antigo `middleware` chama-se `proxy`. Ele roda antes da
 * renderização, que é o único lugar onde dá para escrever o cookie renovado
 * — Server Component não pode.
 *
 * A checagem aqui é de porta: quem manda de verdade é o RLS. Mesmo que esta
 * rota falhasse, o banco não devolveria questão nenhuma sem assinatura.
 */
export async function proxy(request: NextRequest) {
  let resposta = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(novos) {
          novos.forEach(({ name, value }) => request.cookies.set(name, value));
          resposta = NextResponse.next({ request });
          novos.forEach(({ name, value, options }) =>
            resposta.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const rota = request.nextUrl.pathname;

  // `startsWith("/app")` também casa com `/apple-icon.png` — e mandava para
  // o login justamente o ícone que o iPhone busca ao adicionar o site à tela
  // de início, sem sessão nenhuma. A fronteira é o segmento `/app`, não o
  // prefixo textual: ou a rota é exatamente `/app`, ou desce a partir dela.
  const noProduto = rota === "/app" || rota.startsWith("/app/");

  if (!user && noProduto) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/entrar";
    destino.searchParams.set("proximo", rota);
    return NextResponse.redirect(destino);
  }

  if (user && (rota === "/entrar" || rota === "/criar-conta")) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/app";
    destino.search = "";
    return NextResponse.redirect(destino);
  }

  return resposta;
}

export const proxyConfig = {
  matcher: [
    "/app/:path*",
    "/entrar",
    "/criar-conta",
    "/conta/:path*",
  ],
};
