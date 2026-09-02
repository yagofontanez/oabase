"use client";

import Link from "next/link";

import { useState } from "react";
import type { Plano } from "@/lib/planos";
import {
  cpfValido,
  formatarCpf,
  formatarTelefone,
  telefoneValido,
} from "@/lib/validacao";

type Campo = "nome" | "cpf" | "telefone";

export function FormularioAssinatura({
  planos,
  planoInicial,
  perfil,
  sandbox,
}: {
  planos: Plano[];
  planoInicial: string;
  perfil: { nome: string; cpf: string; telefone: string };
  sandbox: boolean;
}) {
  const [escolhido, setEscolhido] = useState(planoInicial);
  const [nome, setNome] = useState(perfil.nome);
  const [cpf, setCpf] = useState(formatarCpf(perfil.cpf));
  const [telefone, setTelefone] = useState(formatarTelefone(perfil.telefone));
  const [erros, setErros] = useState<Partial<Record<Campo, string>>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const plano = planos.find((p) => p.chave === escolhido) ?? planos[0];

  function validar() {
    const novos: Partial<Record<Campo, string>> = {};
    if (nome.trim().split(/\s+/).length < 2) {
      novos.nome = "Escreva nome e sobrenome, como no documento.";
    }
    if (!cpfValido(cpf)) novos.cpf = "Esse CPF não confere.";
    if (!telefoneValido(telefone)) novos.telefone = "Use DDD + número.";
    setErros(novos);
    return Object.keys(novos).length === 0;
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErroGeral(null);
    if (!validar()) return;

    setEnviando(true);
    try {
      const resposta = await fetch("/api/assinar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plano: escolhido, nome, cpf, telefone }),
      });
      const dados = await resposta.json();

      if (!resposta.ok) {
        if (dados.campo) setErros({ [dados.campo as Campo]: dados.erro });
        else setErroGeral(dados.erro ?? "Não consegui abrir o pagamento.");
        setEnviando(false);
        return;
      }

      // A tela de pagamento é da Asaas — sair daqui é o esperado.
      window.location.href = dados.url as string;
    } catch {
      setErroGeral("Sem conexão com o servidor. Tente de novo.");
      setEnviando(false);
    }
  }

  const rotulo = "text-[0.88rem] font-semibold text-ink";
  const entrada =
    "w-full rounded-[12px] border bg-surface px-4 py-3.5 text-[0.98rem] text-ink outline-none transition-colors focus:border-brand-400 focus:ring-4 focus:ring-brand-100";

  return (
    <form onSubmit={enviar} className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr] xl:items-start" noValidate>
      <div className="flex flex-col gap-5">
        <fieldset className="superficie flex flex-col gap-4 p-6">
          <legend className="px-1 text-[1.05rem] font-bold text-ink">
            Escolha o plano
          </legend>

          {planos.map((p) => {
            const ativo = p.chave === escolhido;
            return (
              <label
                key={p.chave}
                className={`flex cursor-pointer items-start gap-4 rounded-[14px] border p-4 transition-colors ${
                  ativo
                    ? "border-brand-400 bg-brand-50"
                    : "border-line hover:border-brand-200"
                }`}
              >
                <input
                  type="radio"
                  name="plano"
                  value={p.chave}
                  checked={ativo}
                  onChange={() => setEscolhido(p.chave)}
                  className="mt-1 h-4 w-4 accent-[#0B6250]"
                />
                <span className="flex flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold text-ink">{p.nome}</span>
                    <span className="text-[1.15rem] font-extrabold text-ink tabular-nums">
                      {p.preco}
                    </span>
                  </span>
                  <span className="text-[0.9rem] text-muted">{p.periodo}</span>
                  <span className="text-[0.9rem] text-body">{p.resumo}</span>
                </span>
              </label>
            );
          })}
        </fieldset>

        <fieldset className="superficie flex flex-col gap-5 p-6">
          <legend className="px-1 text-[1.05rem] font-bold text-ink">
            Seus dados
          </legend>
          <p className="text-[0.9rem] text-muted">
            A Asaas exige CPF e telefone para emitir a cobrança. Ficam salvos na
            sua conta para a próxima vez.
          </p>

          <div className="flex flex-col gap-2">
            <label htmlFor="nome" className={rotulo}>
              Nome completo
            </label>
            <input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              autoComplete="name"
              aria-invalid={Boolean(erros.nome)}
              className={`${entrada} ${erros.nome ? "border-vinho-400" : "border-line"}`}
            />
            {erros.nome && (
              <p className="text-[0.84rem] text-vinho-600">{erros.nome}</p>
            )}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="cpf" className={rotulo}>
                CPF
              </label>
              <input
                id="cpf"
                value={cpf}
                onChange={(e) => setCpf(formatarCpf(e.target.value))}
                inputMode="numeric"
                placeholder="000.000.000-00"
                aria-invalid={Boolean(erros.cpf)}
                className={`${entrada} tabular-nums ${erros.cpf ? "border-vinho-400" : "border-line"}`}
              />
              {erros.cpf && (
                <p className="text-[0.84rem] text-vinho-600">{erros.cpf}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="telefone" className={rotulo}>
                Celular
              </label>
              <input
                id="telefone"
                value={telefone}
                onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
                inputMode="numeric"
                placeholder="(11) 90000-0000"
                autoComplete="tel"
                aria-invalid={Boolean(erros.telefone)}
                className={`${entrada} tabular-nums ${erros.telefone ? "border-vinho-400" : "border-line"}`}
              />
              {erros.telefone && (
                <p className="text-[0.84rem] text-vinho-600">{erros.telefone}</p>
              )}
            </div>
          </div>
        </fieldset>
      </div>

      <aside className="superficie flex flex-col gap-4 p-6 xl:sticky xl:top-[86px]">
        <h2 className="text-[1.05rem] font-bold text-ink">Resumo</h2>

        <div className="flex items-baseline justify-between gap-3 border-y border-line py-4">
          <span className="flex flex-col gap-0.5">
            <span className="font-semibold text-ink">{plano.nome}</span>
            <span className="text-[0.88rem] text-muted">{plano.periodo}</span>
          </span>
          <span className="text-[1.6rem] font-extrabold text-ink tabular-nums">
            {plano.preco}
          </span>
        </div>

        {erroGeral && (
          <p
            role="alert"
            className="rounded-[12px] bg-vinho-50 px-4 py-3 text-[0.9rem] text-vinho-700"
          >
            {erroGeral}
          </p>
        )}

        <button
          type="submit"
          disabled={enviando}
          className="rounded-full bg-brand-600 px-6 py-3.5 font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-brand-200"
        >
          {enviando ? "Abrindo pagamento…" : "Ir para o pagamento"}
        </button>

        <p className="text-[0.86rem] text-muted">
          Você escolhe Pix, cartão ou boleto na tela seguinte, que é da Asaas —
          o OABase não recebe os dados do seu cartão.
        </p>

        {/* Informação obrigatória antes da compra: o CDC exige que o
            arrependimento e as condições estejam claros na oferta, não
            escondidos num link que ninguém abre depois de pagar. */}
        <p className="text-[0.86rem] text-muted">
          Sem renovação automática — o acesso vale pelo período contratado e
          acaba nele. Você tem <strong className="font-semibold text-ink">7
          dias</strong> para desistir e receber o valor de volta, sem precisar
          justificar (art. 49 do CDC). Ao continuar, você aceita os{" "}
          <Link
            href="/termos"
            className="font-semibold text-brand-600 underline decoration-brand-200 underline-offset-4"
          >
            Termos de Uso
          </Link>{" "}
          e a{" "}
          <Link
            href="/privacidade"
            className="font-semibold text-brand-600 underline decoration-brand-200 underline-offset-4"
          >
            Política de Privacidade
          </Link>
          .
        </p>

        {sandbox && (
          <p className="rounded-[12px] bg-ouro-50 px-4 py-3 text-[0.86rem] text-ouro-700">
            <strong className="font-semibold">Ambiente de teste.</strong> Nenhuma
            cobrança real é gerada — a tela de pagamento é o sandbox da Asaas.
          </p>
        )}
      </aside>
    </form>
  );
}
