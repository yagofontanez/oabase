"use client";
import { useId, useState } from "react";

/**
 * Campo de formulário com rótulo real acima do controle.
 *
 * Placeholder não é rótulo: ele some quando a pessoa começa a digitar, e é
 * exatamente aí que ela mais precisa saber o que está preenchendo.
 */
export function Campo({
  rotulo,
  tipo = "text",
  nome,
  valor,
  aoMudar,
  erro,
  dica,
  autoComplete,
  autoFocus,
  obrigatorio = true,
}: {
  rotulo: string;
  tipo?: "text" | "email" | "password";
  nome: string;
  valor: string;
  aoMudar: (v: string) => void;
  erro?: string;
  dica?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  obrigatorio?: boolean;
}) {
  const id = useId();
  const [revelada, setRevelada] = useState(false);
  const senha = tipo === "password";
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[0.88rem] font-semibold text-ink">
        {rotulo}
      </label>

      <div className="relative">
        <input
          id={id}
          name={nome}
          type={senha && revelada ? "text" : tipo}
          value={valor}
          onChange={(e) => aoMudar(e.target.value)}
          required={obrigatorio}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          aria-invalid={Boolean(erro)}
          aria-describedby={erro || dica ? `${id}-nota` : undefined}
          className={`w-full rounded-[12px] border bg-surface px-4 py-3.5 text-[0.98rem] text-ink transition-colors outline-none placeholder:text-muted focus:border-brand-400 focus:ring-4 focus:ring-brand-100 ${
            erro ? "border-vinho-400 focus:ring-vinho-100" : "border-line"
          } ${senha ? "pr-24" : ""}`}
        />

        {senha && (
          <button
            type="button"
            onClick={() => setRevelada((v) => !v)}
            className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full px-3 py-1 text-[0.8rem] font-medium text-muted transition-colors hover:bg-sunk hover:text-brand-700"
          >
            {revelada ? "ocultar" : "mostrar"}
          </button>
        )}
      </div>

      {(erro || dica) && (
        <p
          id={`${id}-nota`}
          className={`text-[0.82rem] ${erro ? "text-vinho-600" : "text-muted"}`}
        >
          {erro ?? dica}
        </p>
      )}
    </div>
  );
}
