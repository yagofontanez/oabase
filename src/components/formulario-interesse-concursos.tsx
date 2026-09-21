"use client";

import { useActionState } from "react";
import {
  estadoInicialInteresseConcursos,
  registrarInteresseConcursos,
} from "@/app/(site)/concursos/actions";

const CARREIRAS = [
  { valor: "tribunais", rotulo: "Tribunais" },
  { valor: "procuradorias", rotulo: "Procuradorias" },
  { valor: "defensoria-publica", rotulo: "Defensoria Pública" },
  { valor: "ministerio-publico", rotulo: "Ministério Público" },
  { valor: "delegado-de-policia", rotulo: "Delegado de Polícia" },
  { valor: "ainda-nao-sei", rotulo: "Ainda estou decidindo" },
];

export function FormularioInteresseConcursos() {
  const [estado, acao, pendente] = useActionState(
    registrarInteresseConcursos,
    estadoInicialInteresseConcursos,
  );

  if (estado.status === "sucesso") {
    return (
      <p
        role="status"
        className="rounded-[14px] border border-brand-200 bg-brand-50 px-5 py-4 text-[0.95rem] font-medium text-brand-800"
      >
        {estado.mensagem}
      </p>
    );
  }

  return (
    <form action={acao} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-[1fr_1.1fr]">
        <label className="flex flex-col gap-1.5 text-[0.9rem] font-semibold text-ink">
          Seu e-mail
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="voce@email.com"
            className="rounded-[12px] border border-line bg-paper px-4 py-3 font-normal text-body outline-none transition-colors placeholder:text-muted focus:border-brand-400"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[0.9rem] font-semibold text-ink">
          Carreira que você mira
          <select
            name="carreira"
            required
            defaultValue=""
            className="rounded-[12px] border border-line bg-paper px-4 py-3 font-normal text-body outline-none transition-colors focus:border-brand-400"
          >
            <option value="" disabled>
              Selecione uma opção
            </option>
            {CARREIRAS.map((carreira) => (
              <option key={carreira.valor} value={carreira.valor}>
                {carreira.rotulo}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex items-start gap-3 text-[0.88rem] leading-relaxed text-body">
        <input
          type="checkbox"
          name="consentimento"
          required
          className="mt-1 h-4 w-4 shrink-0 accent-brand-600"
        />
        <span>
          Quero receber por e-mail atualizações sobre a frente de concursos
          jurídicos. Posso revogar esse consentimento quando quiser.
        </span>
      </label>

      <input
        name="organizacao"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      {estado.status === "erro" && (
        <p role="alert" className="text-[0.9rem] text-vinho-700">
          {estado.mensagem}
        </p>
      )}

      <button
        type="submit"
        disabled={pendente}
        className="self-start rounded-full bg-brand-600 px-6 py-3 text-[0.94rem] font-semibold text-white transition-colors hover:bg-brand-700 disabled:bg-brand-200"
      >
        {pendente ? "Registrando…" : "Quero acompanhar"}
      </button>
    </form>
  );
}
