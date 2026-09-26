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
      // O perfil e o token novo em paralelo. O painel lê o nome do JWT (sem
      // ida à rede — ver `usuarioAtual`), e `updateUser` não emite token
      // novo: sem renovar, a saudação mostraria o nome antigo até a sessão
      // se renovar sozinha, em até uma hora.
      await Promise.all([
        supabase
          .from("perfis")
          .update({ nome: limpo || null })
          .eq("id", data.user.id),
        supabase.auth.refreshSession(),
      ]);
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

/**
 * Excluir a conta.
 *
 * Fechado por padrão, e o que acontece é dito antes do botão — o que some, o
 * que fica por obrigação legal e o que acontece com o plano pago. A senha
 * é conferida no servidor; aqui ela só viaja.
 */
export function ExcluirConta({
  planoAtivo,
  renovacaoAtiva,
}: {
  planoAtivo: boolean;
  renovacaoAtiva: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [senha, setSenha] = useState("");
  const [erroSenha, setErroSenha] = useState<string | undefined>();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function excluir(evento: React.FormEvent) {
    evento.preventDefault();
    if (!senha) {
      setErroSenha("Digite sua senha para confirmar.");
      return;
    }
    setEnviando(true);
    setErro(null);
    setErroSenha(undefined);
    try {
      const resposta = await fetch("/api/conta/excluir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha }),
      });
      const dados = await resposta.json().catch(() => ({}));
      if (!resposta.ok) {
        if (dados.campo === "senha") setErroSenha(dados.erro);
        else setErro(dados.erro ?? "Não consegui excluir a conta agora.");
        setEnviando(false);
        return;
      }
      // Navegação completa, e sem entrada no histórico: a sessão acabou, nada
      // do /app pode sobrar em memória, e "voltar" não pode reabrir a tela de
      // uma conta que não existe.
      window.location.replace("/");
    } catch {
      setErro("Sem conexão com o servidor. Tente de novo.");
      setEnviando(false);
    }
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="self-start rounded-full border border-vinho-200 px-5 py-2.5 text-[0.94rem] font-semibold text-vinho-600 transition-colors hover:bg-vinho-50"
      >
        Excluir minha conta
      </button>
    );
  }

  return (
    <form onSubmit={excluir} className="flex flex-col gap-4" noValidate>
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[0.92rem] text-body">
        <li>
          Seu histórico de estudo, respostas, revisões, planos, quadro e
          tickets de suporte são apagados na hora. Não dá para desfazer.
        </li>
        {planoAtivo && (
          <li>
            O acesso que ainda resta no seu plano se perde junto. Se você pagou
            há menos de 7 dias, peça o reembolso{" "}
            <strong className="font-semibold text-ink">antes</strong> de excluir.
          </li>
        )}
        {renovacaoAtiva && (
          <li>A renovação do plano Mensal é cancelada — nada mais é cobrado.</li>
        )}
        <li>
          Registros de pagamento ficam guardados por 5 anos, por obrigação
          fiscal, fora do seu alcance e do nosso uso.
        </li>
        <li>
          Tópicos e respostas no fórum continuam, assinados como “Conta
          excluída”, para não apagar a conversa de quem respondeu.
        </li>
      </ul>
      <Campo
        rotulo="Sua senha"
        tipo="password"
        nome="senha-exclusao"
        valor={senha}
        aoMudar={(v) => {
          setSenha(v);
          if (erroSenha) setErroSenha(undefined);
        }}
        erro={erroSenha}
        autoComplete="current-password"
      />
      {erro && <Aviso tipo="erro" texto={erro} />}
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={enviando}
          className="rounded-full bg-vinho-600 px-5 py-2.5 text-[0.94rem] font-semibold text-white transition-colors hover:bg-vinho-700 disabled:opacity-60"
        >
          {enviando ? "Excluindo…" : "Excluir minha conta para sempre"}
        </button>
        <button
          type="button"
          onClick={() => {
            setAberto(false);
            setSenha("");
            setErro(null);
            setErroSenha(undefined);
          }}
          disabled={enviando}
          className="rounded-full border border-line bg-surface px-5 py-2.5 text-[0.94rem] font-semibold text-ink"
        >
          Voltar
        </button>
      </div>
    </form>
  );
}
