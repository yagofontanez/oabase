import { NextResponse } from "next/server";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { cancelarAssinatura, ErroAsaas } from "@/lib/pagamento/asaas";

/**
 * Cancela a renovação do plano Mensal.
 *
 * Cancelar tem de ser tão fácil quanto assinar — um botão em Configurações,
 * sem e-mail para suporte nem "fale com a gente". É o que o CDC pede na
 * contratação a distância, e é o que evita a contestação no cartão de quem
 * não achou como parar.
 *
 * **A Asaas primeiro, o banco depois.** Marcar antes e falhar na Asaas
 * deixaria a tela dizendo "cancelada" com o cartão ainda sendo cobrado. Na
 * ordem certa, a pior falha é a inversa — cancelada na Asaas e ainda "ativa"
 * aqui —, que a pessoa resolve clicando de novo (a Asaas responde 404 e o
 * banco é marcado).
 *
 * Cancelar interrompe as cobranças futuras. O período já pago continua: a
 * assinatura em `assinaturas` não é tocada.
 */

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await supabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });
  }

  // RLS: só a própria.
  const { data: recorrencia } = await supabase
    .from("recorrencias")
    .select("asaas_assinatura_id")
    .eq("status", "ativa")
    .maybeSingle();
  if (!recorrencia) {
    return NextResponse.json(
      { erro: "Não há renovação ativa para cancelar." },
      { status: 404 },
    );
  }

  try {
    await cancelarAssinatura(recorrencia.asaas_assinatura_id);
  } catch (erro) {
    // 404: já não existe na Asaas (cancelada lá, ou clique repetido depois de
    // uma falha no meio). O que falta é só o nosso lado.
    const status = erro instanceof ErroAsaas ? (erro.status ?? 0) : 0;
    if (status !== 404) {
      console.error("Falha ao cancelar assinatura na Asaas:", erro);
      return NextResponse.json(
        { erro: "Não consegui cancelar agora. Tente de novo em instantes." },
        { status: 502 },
      );
    }
  }

  const { error } = await supabase.rpc("cancelar_minha_recorrencia", {
    p_assinatura_id: recorrencia.asaas_assinatura_id,
  });
  if (error) {
    console.error("Assinatura cancelada na Asaas, mas não marcada:", error);
    return NextResponse.json(
      { erro: "O cancelamento foi feito, mas a tela pode demorar a mostrar. Recarregue a página." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
