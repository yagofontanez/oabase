import { NextResponse } from "next/server";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { planos } from "@/lib/planos";
import { cpfValido, digitos, telefoneValido } from "@/lib/validacao";
import {
  ErroAsaas,
  ambienteAsaas,
  criarCobranca,
  criarOuAtualizarCliente,
} from "@/lib/pagamento/asaas";

/**
 * Cria a cobrança e devolve a URL da fatura da Asaas.
 *
 * O valor **nunca** vem do cliente: chega só a chave do plano, e o preço é
 * lido de `planos.ts` aqui no servidor. Aceitar valor do navegador deixaria
 * qualquer pessoa comprar o plano anual por um real.
 */
export async function POST(request: Request) {
  const supabase = await supabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ erro: "Sessão expirada." }, { status: 401 });
  }

  let corpo: { plano?: unknown; nome?: unknown; cpf?: unknown; telefone?: unknown };
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }

  const plano = planos.find((p) => p.chave === String(corpo.plano ?? ""));
  if (!plano) {
    return NextResponse.json({ erro: "Plano não encontrado." }, { status: 400 });
  }

  const nome = String(corpo.nome ?? "").trim();
  const cpf = digitos(String(corpo.cpf ?? ""));
  const telefone = digitos(String(corpo.telefone ?? ""));

  if (nome.length < 3) {
    return NextResponse.json(
      { erro: "Informe seu nome completo.", campo: "nome" },
      { status: 400 },
    );
  }
  if (!cpfValido(cpf)) {
    return NextResponse.json(
      { erro: "Esse CPF não confere. Verifique os números.", campo: "cpf" },
      { status: 400 },
    );
  }
  if (!telefoneValido(telefone)) {
    return NextResponse.json(
      { erro: "Telefone inválido. Use DDD + número.", campo: "telefone" },
      { status: 400 },
    );
  }

  const { data: perfil } = await supabase
    .from("perfis")
    .select("asaas_cliente_id")
    .eq("id", user.id)
    .maybeSingle();

  let clienteId: string;
  let cobranca;
  try {
    const cliente = await criarOuAtualizarCliente({
      clienteExistente: perfil?.asaas_cliente_id ?? null,
      nome,
      cpf,
      email: user.email ?? "",
      telefone,
    });
    clienteId = cliente.id;

    cobranca = await criarCobranca({
      clienteId,
      valor: plano.precoNumerico,
      descricao: `OABase — plano ${plano.nome}`,
      referencia: `${user.id}:${plano.chave}`,
      // Prazo curto de propósito: cobrança de estudo perde sentido se vencer
      // depois da prova, e boleto longo trava a liberação do acesso.
      diasParaVencer: 3,
    });
  } catch (erro) {
    console.error("Falha na Asaas:", erro);
    if (erro instanceof ErroAsaas) {
      return NextResponse.json(
        { erro: erro.descricao, campo: "cpf" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { erro: "Não consegui abrir o pagamento agora. Tente de novo." },
      { status: 502 },
    );
  }

  // Guarda os dados para a próxima compra não pedir tudo de novo.
  await supabase
    .from("perfis")
    .update({ nome, cpf, telefone, asaas_cliente_id: clienteId })
    .eq("id", user.id);

  // Função `security definer`: quem chama não escolhe dono nem status.
  const { error } = await supabase.rpc("registrar_cobranca", {
    p_plano: plano.chave,
    p_valor: plano.precoNumerico,
    p_ambiente: ambienteAsaas,
    p_pagamento_id: cobranca.id,
    p_url: cobranca.invoiceUrl,
  });
  if (error) {
    // A cobrança existe na Asaas: mandar a pessoa para o pagamento é mais
    // importante do que o nosso registro, que dá para reconciliar depois.
    console.error("Falha ao registrar cobrança:", error);
  }

  return NextResponse.json({
    url: cobranca.invoiceUrl,
    ambiente: ambienteAsaas,
  });
}
