import { NextResponse } from "next/server";
import { novoCadastro } from "@/lib/email/modelos";
import { enviar } from "@/lib/email/resend";
import { site } from "@/lib/site";

/**
 * Aviso à equipe de cada conta nova.
 *
 * Quem chama é o gatilho `avisar_novo_cadastro` em `auth.users`, por
 * `pg_net` — nunca o navegador. A autenticação é o segredo `cron_email`,
 * que só existe no banco e em `CRON_EMAIL_SEGREDO`: com ele conferido, o
 * corpo veio do banco e descreve um cadastro que aconteceu. Sem ele, esta
 * rota seria um jeito de qualquer pessoa encher a caixa da equipe.
 *
 * **Falha de envio devolve 200.** O `pg_net` não repete requisição, então um
 * 500 não compraria retentativa nenhuma — só um log a mais do lado do banco.
 * O que importa fica no log daqui.
 */

export const dynamic = "force-dynamic";

/** A mesma caixa que recebe os tickets de suporte. */
const EQUIPE = process.env.EMAIL_SUPORTE ?? "dev.yagofontanez@gmail.com";

type Corpo = {
  id?: unknown;
  email?: unknown;
  nome?: unknown;
  criado_em?: unknown;
  total?: unknown;
};

export async function POST(request: Request) {
  const segredo = process.env.CRON_EMAIL_SEGREDO;
  if (!segredo || request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  let corpo: Corpo;
  try {
    corpo = (await request.json()) as Corpo;
  } catch {
    return NextResponse.json({ erro: "corpo inválido" }, { status: 400 });
  }
  if (typeof corpo.id !== "string" || typeof corpo.email !== "string") {
    return NextResponse.json({ erro: "corpo inválido" }, { status: 400 });
  }

  // É instante, não data: aqui o fuso importa, e é o de quem lê o aviso.
  const instante =
    typeof corpo.criado_em === "string" ? new Date(corpo.criado_em) : new Date();
  const quando = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(instante);

  const modelo = novoCadastro({
    nome: typeof corpo.nome === "string" && corpo.nome ? corpo.nome : null,
    email: corpo.email,
    quando,
    total: typeof corpo.total === "number" ? corpo.total : 0,
    href: `${site.url}/app/admin`,
  });

  const envio = await enviar({
    para: EQUIPE,
    ...modelo,
    chave: `novo-cadastro-${corpo.id}`,
    etiquetas: [{ name: "tipo", value: "novo_cadastro" }],
  });
  if (!envio.ok) {
    console.error("Aviso de novo cadastro não enviado:", envio.erro);
  }

  return NextResponse.json({ enviado: envio.ok });
}
