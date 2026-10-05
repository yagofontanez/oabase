import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { urlPublica } from "@/lib/url-publica";
import { destinoInterno } from "@/lib/destino";

/**
 * Confirma o link de cadastro emitido pelo Supabase.
 *
 * O token só é aceito uma vez. Ao verificá-lo no servidor, a sessão é gravada
 * na resposta e a pessoa chega autenticada em /app — que a encaminha ao
 * primeiro plano de estudos quando ainda não criou um.
 *
 * A exceção é quem se cadastrou a partir de um destino — a prova grátis, por
 * exemplo: o formulário guarda o `proximo` nos metadados do cadastro, e é
 * para lá que o link leva. O valor veio do navegador, então passa de novo
 * pela validação de caminho interno.
 */
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");

  if (!tokenHash || type !== "email") {
    return NextResponse.redirect(urlPublica(request, "/entrar"));
  }

  const resposta = NextResponse.redirect(urlPublica(request, "/app"));
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

  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as EmailOtpType,
  });

  if (error) {
    return NextResponse.redirect(urlPublica(request, "/entrar"));
  }

  const pedido = data.user?.user_metadata?.proximo;
  if (typeof pedido === "string") {
    resposta.headers.set("location", urlPublica(request, destinoInterno(pedido)).toString());
  }
  return resposta;
}
