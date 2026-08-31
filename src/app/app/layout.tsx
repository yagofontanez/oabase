import Link from "next/link";
import { redirect } from "next/navigation";
import { BotaoSair } from "@/components/auth/botao-sair";
import { BarraLateral } from "@/components/app/barra-lateral";
import { BotaoFoco } from "@/components/app/botao-foco";
import { NavegacaoApp } from "@/components/app/navegacao";
import { WidgetFoco } from "@/components/app/widget-foco";
import { Wordmark } from "@/components/wordmark";
import { supabaseServidor, usuarioAtual } from "@/lib/supabase/servidor";
import { diasAte, getProximoExame } from "@/lib/content/queries";

/**
 * Chrome da área logada.
 *
 * O cabeçalho do site público continua estático de propósito: ler cookie no
 * layout raiz tornaria **todas** as páginas dinâmicas e derrubaria a geração
 * estática do conteúdo — que é a base inteira da estratégia de busca. Aqui
 * dentro a sessão já é obrigatória, então a barra lateral custa zero.
 *
 * Diferente do site, o painel ocupa a largura toda: é ferramenta de trabalho,
 * e coluna de leitura centralizada só desperdiça tela em tabela e grade.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [usuario, proximo, supabase] = await Promise.all([
    usuarioAtual(),
    getProximoExame(),
    supabaseServidor(),
  ]);
  if (!usuario) redirect("/entrar?proximo=/app");

  const { data: disciplinas } = await supabase
    .from("disciplinas")
    .select("id, slug, nome")
    .order("media_por_prova", { ascending: false });

  const nomeCompleto =
    (usuario.user_metadata?.nome as string | undefined)?.trim() ||
    usuario.email?.split("@")[0] ||
    "você";
  const primeiro = nomeCompleto.split(" ")[0];
  const inicial = primeiro.charAt(0).toUpperCase();
  const dias = diasAte(proximo.data);

  return (
    <div className="flex min-h-screen flex-col">
      <div className="sticky top-0 z-50 border-b border-line bg-paper/85 backdrop-blur-xl">
        <div className="flex h-[62px] items-center justify-between gap-6 px-5 sm:px-7">
          <Link href="/app" aria-label="OABase, painel">
            <Wordmark />
          </Link>

          <div className="flex items-center gap-3 sm:gap-4">
            {/* Liga o widget em cima da tela atual — não leva a lugar nenhum. */}
            <BotaoFoco />

            <span className="hidden text-[0.88rem] text-muted lg:inline">
              {proximo.edicao}º Exame ·{" "}
              <span className="font-semibold text-brand-700 tabular-nums">
                {dias} dias
              </span>
            </span>
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-[0.82rem] font-bold text-brand-700"
              title={nomeCompleto}
            >
              {inicial}
            </span>
            <BotaoSair />
          </div>
        </div>
      </div>

      <div className="flex flex-1">
        <BarraLateral />

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="border-b border-line px-5 py-3 sm:px-7 lg:hidden">
            <NavegacaoApp orientacao="linha" />
          </div>

          <main className="flex-1 px-5 py-8 sm:px-7">{children}</main>
        </div>
      </div>

      {/* Fora do <main>: o widget acompanha a navegação entre as abas sem
          remontar, porque o layout não é recriado a cada rota filha. */}
      <WidgetFoco
        disciplinas={
          (disciplinas ?? []) as { id: string; slug: string; nome: string }[]
        }
      />
    </div>
  );
}
