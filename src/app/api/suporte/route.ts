import { NextResponse } from "next/server";
import { ticketAberto, ticketRespondido } from "@/lib/email/modelos";
import { enviar } from "@/lib/email/resend";
import { site } from "@/lib/site";
import { supabaseServidor, usuarioAtual } from "@/lib/supabase/servidor";

/**
 * Abrir ticket e responder ticket.
 *
 * A escrita poderia sair do navegador — a RLS já garante quem pode o quê —,
 * mas o aviso por e-mail não pode: a chave do Resend é de servidor, e mandar
 * o navegador disparar e-mail transformaria o suporte num canal de spam
 * aberto para qualquer pessoa com uma conta.
 *
 * **O e-mail nunca derruba o ticket.** Ele já está gravado quando o envio
 * acontece; falha vira log, e a pessoa continua vendo a conversa na tela. O
 * inverso — recusar o ticket porque o e-mail falhou — perderia justamente a
 * mensagem de quem está com problema.
 */

export const dynamic = "force-dynamic";

/** Para onde vão os avisos de ticket novo. */
const EQUIPE = process.env.EMAIL_SUPORTE ?? "dev.yagofontanez@gmail.com";

type Corpo = { assunto?: unknown; mensagem?: unknown; ticket?: unknown };

export async function POST(request: Request) {
  const supabase = await supabaseServidor();
  // Sessão conferida no JWT, sem ida ao servidor de Auth (ver `usuarioAtual`).
  const user = await usuarioAtual();
  if (!user) {
    return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });
  }

  let corpo: Corpo;
  try {
    corpo = (await request.json()) as Corpo;
  } catch {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }

  const mensagem = String(corpo.mensagem ?? "").trim();
  if (mensagem.length < 5) {
    return NextResponse.json(
      { erro: "Escreva o que está acontecendo.", campo: "mensagem" },
      { status: 400 },
    );
  }
  if (mensagem.length > 5000) {
    return NextResponse.json(
      { erro: "Mensagem longa demais.", campo: "mensagem" },
      { status: 400 },
    );
  }

  // ---- Resposta num ticket existente ----
  if (corpo.ticket) {
    const ticket = String(corpo.ticket);
    const { error } = await supabase.rpc("responder_ticket", {
      p_ticket: ticket,
      p_corpo: mensagem,
    });
    if (error) {
      console.error("Falha ao responder ticket:", error);
      return NextResponse.json({ erro: "Não consegui enviar." }, { status: 400 });
    }

    await avisar(supabase, ticket, mensagem, user.email ?? "");
    return NextResponse.json({ ok: true, ticket });
  }

  // ---- Ticket novo ----
  const assunto = String(corpo.assunto ?? "").trim();
  if (assunto.length < 3 || assunto.length > 140) {
    return NextResponse.json(
      { erro: "Dê um assunto de 3 a 140 caracteres.", campo: "assunto" },
      { status: 400 },
    );
  }

  const { data: ticket, error } = await supabase.rpc("abrir_ticket", {
    p_assunto: assunto,
    p_corpo: mensagem,
  });
  if (error || !ticket) {
    console.error("Falha ao abrir ticket:", error);
    return NextResponse.json(
      { erro: "Não consegui abrir o chamado agora." },
      { status: 500 },
    );
  }

  await avisar(supabase, String(ticket), mensagem, user.email ?? "");
  return NextResponse.json({ ok: true, ticket });
}

/**
 * Avisa o lado que não escreveu.
 *
 * Quem manda decide o destinatário: mensagem de cliente vai para a equipe,
 * resposta da equipe vai para o cliente. `dados_do_ticket` é `security
 * definer` porque `auth.users` não é — e não deve ser — legível pelo papel
 * autenticado.
 */
async function avisar(
  supabase: Awaited<ReturnType<typeof supabaseServidor>>,
  ticket: string,
  mensagem: string,
  quemEscreveu: string,
) {
  try {
    const [{ data: dados }, { data: admin }] = await Promise.all([
      supabase.rpc("dados_do_ticket", { p_ticket: ticket }),
      supabase.rpc("sou_admin"),
    ]);
    const t = (Array.isArray(dados) ? dados[0] : dados) as
      | { assunto: string; dono_email: string; dono_nome: string }
      | undefined;
    if (!t) return;

    const modelo = admin
      ? ticketRespondido({
          nome: t.dono_nome,
          assunto: t.assunto,
          corpo: mensagem,
          href: `${site.url}/app/suporte`,
        })
      : ticketAberto({
          assunto: t.assunto,
          corpo: mensagem,
          de: quemEscreveu || t.dono_email,
          nome: t.dono_nome,
          href: `${site.url}/app/admin/suporte`,
        });

    const envio = await enviar({
      para: admin ? t.dono_email : EQUIPE,
      assunto: modelo.assunto,
      html: modelo.html,
      texto: modelo.texto,
      etiquetas: [{ name: "tipo", value: "suporte" }],
    });
    if (!envio.ok) console.error("Aviso de suporte não enviado:", envio.erro);
  } catch (erro) {
    console.error("Falha ao avisar sobre o ticket:", erro);
  }
}
