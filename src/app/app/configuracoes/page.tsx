import type { Metadata } from "next";
import Link from "next/link";
import { BotaoSair } from "@/components/auth/botao-sair";
import { formatarData } from "@/lib/format";
import { supabaseServidor, usuarioAtual } from "@/lib/supabase/servidor";
import { FormularioNome, FormularioSenha } from "./formularios";

export const metadata: Metadata = {
  title: "Configurações",
  robots: { index: false, follow: false },
};

function Bloco({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao: string;
  children: React.ReactNode;
}) {
  return (
    <section className="superficie grid gap-6 p-7 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10 lg:p-8">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-[1.2rem] font-bold text-ink">{titulo}</h2>
        <p className="max-w-[38ch] text-[0.93rem] text-muted">{descricao}</p>
      </div>
      <div>{children}</div>
    </section>
  );
}

export default async function ConfiguracoesPage() {
  const usuario = await usuarioAtual();
  const supabase = await supabaseServidor();

  const { data: assinaturas } = await supabase
    .from("assinaturas")
    .select("plano, status, inicio, fim")
    .order("fim", { ascending: false })
    .limit(1);
  const assinatura = assinaturas?.[0] ?? null;

  const nome = (usuario?.user_metadata?.nome as string | undefined) ?? "";
  const criadoEm = usuario?.created_at
    ? formatarData(String(usuario.created_at).slice(0, 10))
    : null;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex max-w-[58ch] flex-col gap-2">
        <h1 className="text-[clamp(1.8rem,3.2vw,2.3rem)] leading-[1.06] font-extrabold tracking-[-0.035em] text-ink">
          Configurações
        </h1>
        <p className="text-body">
          Sua conta, sua senha e o estado do plano.
        </p>
      </header>

      <Bloco
        titulo="Nome"
        descricao="Aparece na saudação do painel. Pode ser só o primeiro nome."
      >
        <FormularioNome inicial={nome} />
      </Bloco>

      <Bloco
        titulo="E-mail"
        descricao="É o seu login. Trocar de e-mail exige confirmar o endereço novo, então ainda não está liberado por aqui."
      >
        <div className="flex flex-col gap-2">
          <p className="rounded-[12px] bg-sunk px-4 py-3.5 text-[0.96rem] break-all text-ink">
            {usuario?.email}
          </p>
          {criadoEm && (
            <p className="text-[0.88rem] text-muted">
              Conta criada em {criadoEm}.
            </p>
          )}
        </div>
      </Bloco>

      <Bloco
        titulo="Senha"
        descricao="Trocar aqui vale imediatamente. Você continua conectado nesta sessão."
      >
        <FormularioSenha />
      </Bloco>

      <Bloco
        titulo="Plano"
        descricao="O plano dura até o dia da prova que você escolher, sem renovação automática."
      >
        {assinatura ? (
          <div className="flex flex-col gap-2">
            <p className="text-[1.2rem] font-bold text-ink">
              {assinatura.plano}
            </p>
            <p className="text-[0.93rem] text-muted">
              {assinatura.status === "ativa" ? "Ativo" : assinatura.status} ·
              válido até {formatarData(String(assinatura.fim).slice(0, 10))}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p className="text-[0.96rem] text-body">
              Você ainda não tem plano. O banco de questões e as ferramentas de
              treino são liberados por ele.
            </p>
            <Link
              href="/precos"
              className="rounded-full border border-hairline bg-surface px-6 py-2.5 text-[0.94rem] font-semibold text-ink transition-colors hover:border-brand-300 hover:text-brand-700"
            >
              Ver planos
            </Link>
            <p className="text-[0.86rem] text-muted">
              O checkout ainda não está ativo — nada é cobrado hoje.
            </p>
          </div>
        )}
      </Bloco>

      <Bloco
        titulo="Sessão"
        descricao="Sair encerra o acesso neste dispositivo. Todo o conteúdo aberto do site continua disponível sem conta."
      >
        <div className="flex items-center gap-5">
          <BotaoSair />
          <Link
            href="/"
            className="text-[0.94rem] font-medium text-body transition-colors hover:text-brand-700"
          >
            Ir para o site
          </Link>
        </div>
      </Bloco>
    </div>
  );
}
