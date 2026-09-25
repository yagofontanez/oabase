"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Campo } from "@/components/auth/campo";
import { mensagemDeErro } from "@/lib/auth-erros";
import { supabaseNavegador } from "@/lib/supabase/browser";

const SENHA_MINIMA = 8;

function Aviso({ tipo, texto }: { tipo: "ok" | "erro"; texto: string }) {
  return (
    <p
      role={tipo === "erro" ? "alert" : "status"}
      className={`rounded-[12px] px-4 py-3 text-[0.9rem] ${
        tipo === "erro"
          ? "bg-vinho-50 text-vinho-700"
          : "bg-brand-50 text-brand-700"
      }`}
    >
      {texto}
    </p>
  );
}

/**
 * Troca do nome de exibição.
 *
 * Escreve nos dois lugares de propósito: no metadado da sessão, que é de onde
 * a saudação lê sem consultar o banco, e em `perfis`, que é a fonte para
 * qualquer coisa que venha a juntar nome com progresso. O trigger de cadastro
 * só preenche `perfis` na criação — daqui em diante é a aplicação.
 */
export function FormularioNome({ inicial }: { inicial: string }) {
  const router = useRouter();
  const [nome, setNome] = useState(inicial);
  const [estado, setEstado] = useState<null | { tipo: "ok" | "erro"; texto: string }>(
    null,
  );
  const [salvando, setSalvando] = useState(false);

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault();
    setEstado(null);
    setSalvando(true);

    const supabase = supabaseNavegador();
    const limpo = nome.trim();

    const { data, error } = await supabase.auth.updateUser({
      data: { nome: limpo },
    });
    if (error) {
      setEstado({ tipo: "erro", texto: mensagemDeErro(error) });
      setSalvando(false);
      return;
    }

    if (data.user) {
      await supabase
        .from("perfis")
        .update({ nome: limpo || null })
        .eq("id", data.user.id);
    }

    setEstado({ tipo: "ok", texto: "Nome atualizado." });
    setSalvando(false);
    router.refresh();
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-4" noValidate>
      {estado && <Aviso {...estado} />}
      <Campo
        rotulo="Nome de exibição"
        nome="nome"
        valor={nome}
        aoMudar={setNome}
        autoComplete="name"
        obrigatorio={false}
        dica="É como o painel te chama."
      />
      <button
        type="submit"
        disabled={salvando || nome.trim() === inicial.trim()}
        className="self-start rounded-full bg-brand-600 px-6 py-2.5 text-[0.94rem] font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-brand-200"
      >
        {salvando ? "Salvando…" : "Salvar nome"}
      </button>
    </form>
  );
}

export function FormularioSenha() {
  const [senha, setSenha] = useState("");
  const [erroSenha, setErroSenha] = useState<string | null>(null);
  const [estado, setEstado] = useState<null | { tipo: "ok" | "erro"; texto: string }>(
    null,
  );
  const [salvando, setSalvando] = useState(false);

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault();
    setEstado(null);

    if (senha.length < SENHA_MINIMA) {
      setErroSenha(`Use pelo menos ${SENHA_MINIMA} caracteres.`);
      return;
    }
    setErroSenha(null);
    setSalvando(true);

    const { error } = await supabaseNavegador().auth.updateUser({
      password: senha,
    });

    if (error) {
      setEstado({ tipo: "erro", texto: mensagemDeErro(error) });
      setSalvando(false);
      return;
    }

    setSenha("");
    setEstado({
      tipo: "ok",
      texto: "Senha alterada. Ela já vale na próxima vez que você entrar.",
    });
    setSalvando(false);
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-4" noValidate>
      {estado && <Aviso {...estado} />}
      <Campo
        rotulo="Nova senha"
        tipo="password"
        nome="senha"
        valor={senha}
        aoMudar={(v) => {
          setSenha(v);
          if (erroSenha && v.length >= SENHA_MINIMA) setErroSenha(null);
        }}
        autoComplete="new-password"
        obrigatorio={false}
        erro={erroSenha ?? undefined}
        dica={`Pelo menos ${SENHA_MINIMA} caracteres.`}
      />
      <button
        type="submit"
        disabled={salvando || senha.length === 0}
        className="self-start rounded-full bg-brand-600 px-6 py-2.5 text-[0.94rem] font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-brand-200"
      >
        {salvando ? "Salvando…" : "Alterar senha"}
      </button>
    </form>
  );
}

/**
 * Cancelar a renovação do Mensal, em dois toques.
 *
 * O primeiro explica o que acontece — para as cobranças, o acesso já pago
 * segue — e o segundo confirma. Sem `window.confirm`: o diálogo do navegador
 * não diz nada disso, e em alguns celulares nem aparece.
 */
export function CancelarRenovacao({ acessoAte }: { acessoAte: string | null }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function cancelar() {
    setEnviando(true);
    setErro(null);
    try {
      const resposta = await fetch("/api/assinatura/cancelar", { method: "POST" });
      const dados = await resposta.json().catch(() => ({}));
      if (!resposta.ok) {
        setErro(dados.erro ?? "Não consegui cancelar agora. Tente de novo.");
        setEnviando(false);
        return;
      }
      router.refresh();
    } catch {
      setErro("Sem conexão com o servidor. Tente de novo.");
      setEnviando(false);
    }
  }

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="self-start text-[0.9rem] font-semibold text-vinho-600 underline decoration-vinho-200 underline-offset-4 hover:text-vinho-700"
      >
        Cancelar renovação
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-vinho-100 bg-vinho-50 p-4">
      <p className="text-[0.92rem] text-ink">
        As próximas cobranças param.
        {acessoAte ? (
          <>
            {" "}
            Seu acesso continua até <strong>{acessoAte}</strong> — o que já foi
            pago não se perde.
          </>
        ) : (
          " O que já foi pago continua valendo até o fim do período."
        )}
      </p>
      {erro && <Aviso tipo="erro" texto={erro} />}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={cancelar}
          disabled={enviando}
          className="rounded-full bg-vinho-600 px-5 py-2.5 text-[0.9rem] font-semibold text-white transition-colors hover:bg-vinho-700 disabled:opacity-60"
        >
          {enviando ? "Cancelando…" : "Confirmar cancelamento"}
        </button>
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          disabled={enviando}
          className="rounded-full border border-line bg-surface px-5 py-2.5 text-[0.9rem] font-semibold text-ink"
        >
          Manter assinatura
        </button>
      </div>
    </div>
  );
}
