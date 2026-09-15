import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";

const CABECALHOS = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
};

export async function POST(request: Request) {
  const recebido = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!/^[a-f0-9]{64}$/.test(recebido)) {
    return Response.json({ erro: "Não autorizado" }, { status: 401, headers: CABECALHOS });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data: autorizado, error } = await supabase.rpc(
    "confere_segredo_revalidacao_legal",
    { p_segredo: recebido },
  );
  if (error) {
    return Response.json({ erro: "Validação indisponível" }, { status: 503, headers: CABECALHOS });
  }
  if (autorizado !== true) {
    return Response.json({ erro: "Não autorizado" }, { status: 401, headers: CABECALHOS });
  }

  // Endpoint fixo: o chamador não escolhe caminhos arbitrários. A carga
  // invalida o acervo público, inclusive metadata/noindex de cada artigo.
  revalidatePath("/legislacao/[codigo]/[artigo]", "page");
  revalidatePath("/legislacao/[codigo]", "page");
  revalidatePath("/legislacao");
  revalidatePath("/glossario");
  revalidatePath("/sitemap/0.xml");

  return Response.json({ revalidado: true }, { headers: CABECALHOS });
}
