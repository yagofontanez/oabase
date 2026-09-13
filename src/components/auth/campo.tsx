"use client";
import { useId, useState } from "react";

const Olho = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-[18px] w-[18px]"
    aria-hidden="true"
  >
    <path d="M2 12S5.5 5 12 5s10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const OlhoFechado = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-[18px] w-[18px]"
    aria-hidden="true"
  >
    <path d="M3 3l18 18" />
    <path d="M10.6 5.2A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17.5 17.5 0 0 1-3.15 4.15" />
    <path d="M6.5 6.5C3.6 8.3 2 12 2 12s3.5 7 10 7a9.9 9.9 0 0 0 4.15-.9" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </svg>
);

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
    <div className="flex flex-col gap-1.5">
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
          className={`w-full rounded-[12px] border bg-surface px-4 py-3 text-[0.96rem] text-ink shadow-[0_1px_2px_rgba(16,32,27,0.04)] transition-[border-color,box-shadow] outline-none placeholder:text-muted hover:border-brand-200 focus:border-brand-400 focus:ring-4 focus:ring-brand-100 ${
            erro
              ? "border-vinho-300 focus:ring-vinho-100"
              : "border-hairline"
          } ${senha ? "pr-11" : ""}`}
        />

        {senha && (
          <button
            type="button"
            onClick={() => setRevelada((v) => !v)}
            aria-pressed={revelada}
            aria-label={revelada ? "Ocultar senha" : "Mostrar senha"}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-2 text-muted transition-colors hover:bg-black/[0.06] hover:text-brand-700"
          >
            {revelada ? <OlhoFechado /> : <Olho />}
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
