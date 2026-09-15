import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";

export async function POST(request: Request) {
  const esperado = process.env.CRON_SECRET;
  if (!esperado) {
    return Response.json({ erro: "Revalidação não configurada" }, { status: 503 });
  }

  const recebido = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return Response.json({ erro: "Não autorizado" }, { status: 401 });
  }

  // Endpoint fixo: o chamador não escolhe caminhos arbitrários. A carga
  // invalida o acervo público, inclusive metadata/noindex de cada artigo.
  revalidatePath("/legislacao/[codigo]/[artigo]", "page");
  revalidatePath("/legislacao/[codigo]", "page");
  revalidatePath("/legislacao");
  revalidatePath("/glossario");
  revalidatePath("/sitemap/0.xml");

  return Response.json({ revalidado: true });
}
