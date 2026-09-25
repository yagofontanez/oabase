import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { cancelarAssinatura, ErroAsaas } from "@/lib/pagamento/asaas";

/**
 * Exclusão da conta pela própria pessoa (LGPD, art. 18, VI).
 *
 * **Pede a senha de novo.** Excluir não tem volta, e uma sessão esquecida
 * aberta num computador de biblioteca não pode bastar para apagar o
 * histórico de estudo de alguém. A conferência é um login avulso, num
 * cliente sem cookie, com a chave anônima de sempre.
 *
 * **A renovação do Mensal é cancelada na Asaas antes.** O banco recusa
 * excluir com recorrência ativa (`excluir_minha_conta`), e a ordem aqui é a
 * mesma de `/api/assinatura/cancelar`: Asaas primeiro, banco depois. Conta
 * apagada com o cartão ainda sendo cobrado é o pior resultado possível.
 *
 * O que some, o que fica e por quê está na migration
 * `20260925220000_excluir_conta.sql`: a cobrança é retida por 5 anos, como a
 * Política de Privacidade promete, e o fórum perde o nome do autor, não a
 * conversa.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await supabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });
  }

  let senha = "";
  try {
    senha = String(((await request.json()) as { senha?: unknown }).senha ?? "");
  } catch {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }

  const avulso = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error: erroSenha } = await avulso.auth.signInWithPassword({
    email: user.email,
    password: senha,
  });
  if (erroSenha) {
    return NextResponse.json(
      { erro: "Senha incorreta.", campo: "senha" },
      { status: 400 },
    );
  }

  const { data: recorrencia } = await supabase
    .from("recorrencias")
    .select("asaas_assinatura_id")
    .eq("status", "ativa")
    .maybeSingle();
  if (recorrencia) {
    try {
      await cancelarAssinatura(recorrencia.asaas_assinatura_id);
    } catch (erro) {
      const status = erro instanceof ErroAsaas ? (erro.status ?? 0) : 0;
      if (status !== 404) {
        console.error("Exclusão de conta: falha ao cancelar a assinatura:", erro);
        return NextResponse.json(
          {
            erro: "Não consegui cancelar a renovação do seu plano agora, então a conta não foi excluída. Tente de novo em instantes.",
          },
          { status: 502 },
        );
      }
    }
    const { error } = await supabase.rpc("cancelar_minha_recorrencia", {
      p_assinatura_id: recorrencia.asaas_assinatura_id,
    });
    if (error) {
      console.error("Exclusão de conta: assinatura cancelada, não marcada:", error);
      return NextResponse.json(
        { erro: "A renovação foi cancelada, mas a conta não foi excluída. Tente de novo." },
        { status: 500 },
      );
    }
  }

  const { error } = await supabase.rpc("excluir_minha_conta");
  if (error) {
    console.error("Falha ao excluir conta:", error);
    return NextResponse.json(
      { erro: "Não consegui excluir a conta agora. Tente de novo." },
      { status: 500 },
    );
  }

  // O usuário não existe mais; só falta apagar os cookies desta sessão.
  await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  return NextResponse.json({ ok: true });
}
