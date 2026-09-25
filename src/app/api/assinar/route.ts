import { NextResponse } from "next/server";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { dadosPendentes } from "@/lib/legal";
import { planosDisponiveis } from "@/lib/planos";
import { cpfValido, digitos, telefoneValido } from "@/lib/validacao";
import {
  ErroAsaas,
  ambienteAsaas,
  cancelarAssinatura,
  cobrancaLiberada,
  criarAssinatura,
  criarCobranca,
  criarOuAtualizarCliente,
  type Cobranca,
} from "@/lib/pagamento/asaas";

/**
 * Cria a cobrança e devolve a URL da fatura da Asaas.
 *
 * O valor **nunca** vem do cliente: chega só a chave do plano, e o preço é
 * lido de `planos.ts` aqui no servidor. Aceitar valor do navegador deixaria
 * qualquer pessoa comprar o plano anual por um real.
 *
 * Em produção a rota se recusa a cobrar enquanto `legal.ts` estiver
 * incompleto. O aviso no topo dos Termos e da Política avisa quem lê; quem
 * está no checkout não passa por lá. Cobrar sem razão social, CNPJ e endereço
 * publicados contraria o CDC na oferta a distância — e o dia em que isso
 * acontecer vai ser justamente o dia em que ninguém está olhando o aviso.
 * Em sandbox nada muda: é lá que se testa antes de ter os documentos.
 */
export async function POST(request: Request) {
  if (ambienteAsaas === "producao" && !cobrancaLiberada) {
    console.error(
      `Cobrança em produção bloqueada: falta ${dadosPendentes.join(", ")} em legal.ts.`,
    );
    return NextResponse.json(
      { erro: "O pagamento está temporariamente indisponível." },
      { status: 503 },
    );
  }

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

  const plano = planosDisponiveis.find(
    (p) => p.chave === String(corpo.plano ?? ""),
  );
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

  // Duas assinaturas mensais é cobrança em dobro no cartão. O índice único
  // em `recorrencias` garante no banco; recusar aqui evita criar a segunda
  // na Asaas antes de o banco dizer não.
  if (plano.recorrente) {
    const { data: ativa } = await supabase
      .from("recorrencias")
      .select("asaas_assinatura_id")
      .eq("status", "ativa")
      .maybeSingle();
    if (ativa) {
      // Assinatura aberta e nunca paga: a pessoa saiu da fatura e voltou. O
      // caminho é a mesma fatura, não uma segunda assinatura. (A abandonada
      // de vez é cancelada pela reconciliação.)
      const { data: cobrancasDela } = await supabase
        .from("cobrancas")
        .select("status, url_fatura")
        .eq("asaas_assinatura_id", ativa.asaas_assinatura_id)
        .order("criado_em", { ascending: false });
      const paga = cobrancasDela?.some((c) => c.status === "CONFIRMED");
      const aberta = cobrancasDela?.find((c) => c.status === "PENDING");
      if (!paga && aberta) {
        return NextResponse.json({ url: aberta.url_fatura, ambiente: ambienteAsaas });
      }
      return NextResponse.json(
        {
          erro: "Você já tem a assinatura mensal ativa. Ela renova sozinha — veja em Configurações.",
        },
        { status: 409 },
      );
    }
  }

  const { data: perfil } = await supabase
    .from("perfis")
    .select("asaas_cliente_id")
    .eq("id", user.id)
    .maybeSingle();

  let clienteId: string;
  let cobranca: Cobranca;
  let assinaturaId: string | null = null;
  try {
    const cliente = await criarOuAtualizarCliente({
      clienteExistente: perfil?.asaas_cliente_id ?? null,
      nome,
      cpf,
      email: user.email ?? "",
      telefone,
    });
    clienteId = cliente.id;

    const pedido = {
      clienteId,
      valor: plano.precoNumerico,
      descricao: `OABase — plano ${plano.nome}`,
      referencia: `${user.id}:${plano.chave}`,
      // Prazo curto de propósito: cobrança de estudo perde sentido se vencer
      // depois da prova, e boleto longo trava a liberação do acesso. Na
      // assinatura, este dia vira o dia de cobrança de todos os meses.
      diasParaVencer: 3,
    };
    if (plano.recorrente) {
      const { assinatura, primeira } = await criarAssinatura(pedido);
      assinaturaId = assinatura.id;
      cobranca = primeira;
    } else {
      cobranca = await criarCobranca(pedido);
    }
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
    p_assinatura_id: assinaturaId,
  });
  if (error && assinaturaId) {
    // Assinatura sem registro é o pior caso: a Asaas cobraria todo mês e
    // nenhuma renovação viraria acesso, porque o banco só aceita renovação
    // de assinatura que conhece. Desfaz na Asaas e recusa.
    console.error("Falha ao registrar assinatura; cancelando na Asaas:", error);
    await cancelarAssinatura(assinaturaId).catch((erro) =>
      console.error(`Assinatura ${assinaturaId} ficou órfã na Asaas:`, erro),
    );
    return NextResponse.json(
      { erro: "Não consegui abrir a assinatura agora. Tente de novo." },
      { status: 502 },
    );
  }
  if (error) {
    // A cobrança avulsa existe na Asaas: mandar a pessoa para o pagamento é
    // mais importante do que o nosso registro, que dá para reconciliar depois.
    console.error("Falha ao registrar cobrança:", error);
  }

  return NextResponse.json({
    url: cobranca.invoiceUrl,
    ambiente: ambienteAsaas,
  });
}
