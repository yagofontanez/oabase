"use server";

import { supabaseAnon } from "@/lib/supabase/client";

export type EstadoInteresseConcursos = {
  status: "inicial" | "erro" | "sucesso";
  mensagem: string;
};

export const estadoInicialInteresseConcursos: EstadoInteresseConcursos = {
  status: "inicial",
  mensagem: "",
};

/**
 * A action é uma entrada pública, mesmo que o formulário seja simples: todos
 * os campos são tratados como não confiáveis. A função do banco repete as
 * validações e é a única que pode gravar na lista — a tabela não é legível
 * nem gravável diretamente pela chave anônima.
 */
export async function registrarInteresseConcursos(
  _anterior: EstadoInteresseConcursos,
  formulario: FormData,
): Promise<EstadoInteresseConcursos> {
  // Campo invisível para pessoas. Não revela ao bot se a inscrição seria
  // aceita; apenas devolve uma confirmação neutra e evita gravar o spam.
  if (String(formulario.get("organizacao") ?? "").trim()) {
    return {
      status: "sucesso",
      mensagem: "Pronto. Avisaremos quando a primeira versão estiver disponível.",
    };
  }

  const email = String(formulario.get("email") ?? "").trim();
  const carreira = String(formulario.get("carreira") ?? "");
  const consentiu = formulario.get("consentimento") === "on";

  if (!email || !carreira || !consentiu) {
    return {
      status: "erro",
      mensagem: "Informe seu e-mail, a carreira de interesse e o consentimento.",
    };
  }

  const { error } = await supabaseAnon().rpc("registrar_interesse_concursos", {
    p_email: email,
    p_carreira: carreira,
    p_consentiu: consentiu,
  });

  if (error) {
    console.error("Falha ao registrar interesse em concursos:", error);
    return {
      status: "erro",
      mensagem: "Não conseguimos registrar agora. Tente novamente em instantes.",
    };
  }

  return {
    status: "sucesso",
    mensagem: "Pronto. Avisaremos quando a primeira versão estiver disponível.",
  };
}
