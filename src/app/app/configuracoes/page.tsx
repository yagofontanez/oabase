import type { Metadata } from "next";
import Link from "next/link";
import { PreferenciaAvisos } from "@/components/app/preferencia-avisos";
import { formatarData } from "@/lib/format";
import { planos } from "@/lib/planos";
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
        <h2 className="text-[1.15rem] font-bold text-ink">{titulo}</h2>
        <p className="max-w-[38ch] text-[0.93rem] text-muted">{descricao}</p>
      </div>
      <div className="lg:border-l lg:border-line lg:pl-10">{children}</div>
    </section>
  );
}

export default async function ConfiguracoesPage() {
  const usuario = await usuarioAtual();
  const supabase = await supabaseServidor();

  const { data: perfil } = await supabase
    .from("perfis")
    .select("avisos_email")
    .eq("id", usuario!.id)
    .maybeSingle();

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

  const nomeDoPlano = assinatura
    ? (planos.find((p) => p.chave === assinatura.plano)?.nome ??
      assinatura.plano)
    : null;

  return (
    <div className="painel-conteudo flex max-w-[980px] flex-col gap-6">
      <header className="flex max-w-[58ch] flex-col gap-2">
        <h1 className="text-[clamp(1.75rem,3vw,2.15rem)] leading-[1.08] font-extrabold tracking-[-0.035em] text-ink">
          Configurações
        </h1>
        <p className="text-body">Sua conta, sua senha e o estado do plano.</p>
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
        titulo="Lembretes por e-mail"
        descricao="Um aviso nos dias em que a fila de revisão tiver cinco ou mais questões. Confirmação de compra e fim de plano não entram aqui — são transacionais."
      >
        <PreferenciaAvisos inicial={perfil?.avisos_email ?? true} />
      </Bloco>

      <Bloco
        titulo="Plano"
        descricao="O plano dura até o dia da prova que você escolher, sem renovação automática."
      >
        {assinatura ? (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-[14px] bg-paper p-5">
            <div className="flex flex-col gap-1">
              <p className="text-[1.2rem] font-bold text-ink">{nomeDoPlano}</p>
              <p className="text-[0.93rem] text-muted">
                Válido até {formatarData(String(assinatura.fim).slice(0, 10))}
              </p>
            </div>
            <span
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-[0.84rem] font-semibold ${
                assinatura.status === "ativa"
                  ? "bg-brand-50 text-brand-700"
                  : "bg-ouro-50 text-ouro-700"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  assinatura.status === "ativa" ? "bg-brand-500" : "bg-ouro-500"
                }`}
              />
              {assinatura.status === "ativa" ? "Ativo" : assinatura.status}
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p className="text-[0.96rem] text-body">
              Você ainda não tem plano. O banco de questões e as ferramentas de
              treino são liberados por ele.
            </p>
            <Link
              href="/app/assinar"
              className="rounded-full bg-brand-600 px-6 py-2.5 text-[0.94rem] font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Ver planos
            </Link>
          </div>
        )}
      </Bloco>

    </div>
  );
}
