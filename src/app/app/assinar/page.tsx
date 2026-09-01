import type { Metadata } from "next";
import Link from "next/link";
import { FormularioAssinatura } from "@/components/app/formulario-assinatura";
import { ambienteAsaas } from "@/lib/pagamento/asaas";
import { planos } from "@/lib/planos";
import { supabaseServidor, usuarioAtual } from "@/lib/supabase/servidor";
import { formatarData } from "@/lib/format";

export const metadata: Metadata = {
  title: "Assinar",
  robots: { index: false, follow: false },
};

export default async function AssinarPage({
  searchParams,
}: {
  searchParams: Promise<{ plano?: string }>;
}) {
  const { plano: pedido } = await searchParams;
  const [usuario, supabase] = await Promise.all([
    usuarioAtual(),
    supabaseServidor(),
  ]);

  const [perfilRes, cobrancasRes] = await Promise.all([
    supabase
      .from("perfis")
      .select("nome, cpf, telefone")
      .eq("id", usuario!.id)
      .maybeSingle(),
    supabase
      .from("cobrancas")
      .select("plano, valor, status, url_fatura, criado_em")
      .eq("status", "PENDING")
      .order("criado_em", { ascending: false })
      .limit(1),
  ]);

  const perfil = perfilRes.data;
  const pendente = cobrancasRes.data?.[0] ?? null;

  const planoInicial =
    planos.find((p) => p.chave === pedido)?.chave ??
    planos.find((p) => p.destaque)?.chave ??
    planos[0].chave;

  return (
    <div className="painel-conteudo flex flex-col gap-8">
      <header className="flex max-w-[60ch] flex-col gap-2">
        <h1 className="text-[clamp(1.75rem,3vw,2.15rem)] leading-[1.08] font-extrabold tracking-[-0.035em] text-ink">
          Assinar
        </h1>
        <p className="text-body">
          Escolha o plano e confirme seus dados. O pagamento acontece na Asaas,
          com Pix, cartão ou boleto.
        </p>
      </header>

      {/* Cobrança em aberto vem antes do formulário: gerar uma segunda sem
          avisar deixaria a pessoa com dois boletos do mesmo plano. */}
      {pendente && (
        <section className="flex flex-wrap items-center justify-between gap-5 rounded-[18px] bg-ouro-50 p-6">
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-ouro-700">
              Você tem um pagamento em aberto
            </span>
            <span className="text-[0.9rem] text-ouro-700/80">
              Plano {pendente.plano} · aberto em{" "}
              {formatarData(String(pendente.criado_em).slice(0, 10))}
            </span>
          </div>
          <Link
            href={pendente.url_fatura}
            className="rounded-full bg-ouro-600 px-5 py-2.5 text-[0.92rem] font-semibold text-white transition-colors hover:bg-ouro-700"
          >
            Retomar pagamento
          </Link>
        </section>
      )}

      <FormularioAssinatura
        planos={planos}
        planoInicial={planoInicial}
        perfil={{
          nome:
            perfil?.nome ??
            (usuario?.user_metadata?.nome as string | undefined) ??
            "",
          cpf: perfil?.cpf ?? "",
          telefone: perfil?.telefone ?? "",
        }}
        sandbox={ambienteAsaas === "sandbox"}
      />
    </div>
  );
}
