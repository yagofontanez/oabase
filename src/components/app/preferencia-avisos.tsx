"use client";

import { useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/browser";

/**
 * Liga e desliga o lembrete diário de revisão.
 *
 * Só este é opcional. Confirmação de compra e aviso de fim de plano são
 * transacionais: quem pagou tem direito de saber o que comprou e até quando
 * vale, e esconder isso atrás de uma preferência seria esconder o que a
 * pessoa precisa para decidir.
 *
 * A escrita vai direto do navegador — `perfis` tem política de dono com
 * `with check`, então forjar o corpo da requisição não grava na linha de
 * outra pessoa.
 */
export function PreferenciaAvisos({ inicial }: { inicial: boolean }) {
  const [ligado, setLigado] = useState(inicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function alternar() {
    if (salvando) return;
    const proximo = !ligado;
    setLigado(proximo);
    setSalvando(true);
    setErro(null);

    const supabase = supabaseNavegador();
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      setErro("Sessão expirada.");
      setLigado(!proximo);
      setSalvando(false);
      return;
    }

    const { error } = await supabase
      .from("perfis")
      .update({ avisos_email: proximo })
      .eq("id", data.user.id);

    if (error) {
      setErro("Não consegui salvar a preferência.");
      setLigado(!proximo);
    }
    setSalvando(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={ligado}
        onClick={alternar}
        disabled={salvando}
        className="flex items-center gap-3 self-start disabled:opacity-60"
      >
        <span
          className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${
            ligado ? "bg-brand-600" : "bg-hairline"
          }`}
        >
          <span
            className={`h-5 w-5 rounded-full bg-white shadow-[var(--shadow-baixa)] transition-transform ${
              ligado ? "translate-x-5" : ""
            }`}
          />
        </span>
        <span className="text-[0.94rem] font-medium text-ink">
          {ligado ? "Lembretes ligados" : "Lembretes desligados"}
        </span>
      </button>

      <p className="text-[0.86rem] text-muted">
        {ligado
          ? "Você recebe um e-mail nos dias em que houver cinco ou mais questões na fila de revisão."
          : "Você não recebe lembrete de revisão. Confirmação de compra e aviso de fim de plano continuam chegando."}
      </p>

      {erro && (
        <p role="alert" className="text-[0.86rem] text-vinho-600">
          {erro}
        </p>
      )}
    </div>
  );
}
