import Link from "next/link";
import { redirect } from "next/navigation";
import { BotaoSair } from "@/components/auth/botao-sair";
import { BarraLateral } from "@/components/app/barra-lateral";
import { BotaoFoco } from "@/components/app/botao-foco";
import { NavegacaoApp, TituloDaSecao } from "@/components/app/navegacao";
import { WidgetFoco } from "@/components/app/widget-foco";
import { Wordmark } from "@/components/wordmark";
import { planos } from "@/lib/planos";
import { supabaseServidor, usuarioAtual } from "@/lib/supabase/servidor";
import { diasAte, getProximoExame } from "@/lib/content/queries";

/**
 * Chrome da área logada.
 *
 * O cabeçalho do site público continua estático de propósito: ler cookie no
 * layout raiz tornaria **todas** as páginas dinâmicas e derrubaria a geração
 * estática do conteúdo — que é a base inteira da estratégia de busca. Aqui
 * dentro a sessão já é obrigatória, então o trilho custa zero.
 *
 * O `main` não tem espaçamento próprio: quem decide é a tela. O painel usa
 * `.painel-conteudo`; o plano de estudos ocupa a altura inteira da janela,
 * o que seria impossível com padding herdado.
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

  const [disciplinasRes, assinaturaRes] = await Promise.all([
    supabase
      .from("disciplinas")
      .select("id, slug, nome")
      .order("media_por_prova", { ascending: false }),
    supabase
      .from("assinaturas")
      .select("plano, fim")
      .eq("status", "ativa")
      .order("fim", { ascending: false })
      .limit(1),
  ]);

  const assinatura = assinaturaRes.data?.[0] ?? null;
  const nomeCompleto =
    (usuario.user_metadata?.nome as string | undefined)?.trim() ||
    usuario.email?.split("@")[0] ||
    "você";
  const primeiro = nomeCompleto.split(" ")[0];
  const inicial = primeiro.charAt(0).toUpperCase();
  const dias = diasAte(proximo.data);

  return (
    /* Altura fixa e rolagem interna, não `min-h-screen`.
       Com altura definida no topo, o plano de estudos consegue ser uma
       conversa de altura cheia com caixa de envio ancorada — e o cabeçalho
       para de precisar de `sticky` com desfoque para não sumir. */
    <div className="flex h-dvh overflow-hidden">
      <BarraLateral
        nome={primeiro}
        email={usuario.email ?? ""}
        inicial={inicial}
        plano={{
          // A chave do banco (`ate-a-prova`) nunca chega à tela: o nome de
          // exibição sai da mesma lista que a landing e /precos usam.
          nome: assinatura
            ? (planos.find((p) => p.chave === assinatura.plano)?.nome ??
              assinatura.plano)
            : null,
          validoAte: assinatura ? String(assinatura.fim).slice(0, 10) : null,
        }}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="z-40 shrink-0 border-b border-line bg-paper">
          <div className="flex h-[60px] items-center justify-between gap-4 px-5 sm:px-7">
            <div className="flex min-w-0 items-center gap-3">
              <Link href="/app" aria-label="OABase, painel" className="lg:hidden">
                <Wordmark />
              </Link>
              <span className="hidden lg:inline">
                <TituloDaSecao />
              </span>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {/* Contagem no cabeçalho porque vale em toda tela: é o prazo
                  que ordena tudo o que a pessoa faz aqui dentro. */}
              <span className="hidden items-center gap-2 rounded-full border border-hairline bg-surface px-3.5 py-1.5 text-[0.85rem] text-muted sm:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-ouro-400" />
                {proximo.edicao}º Exame
                <span className="font-semibold text-brand-700 tabular-nums">
                  {dias}d
                </span>
              </span>

              {/* No desktop o botão vive no trilho; aqui ele cobre o celular,
                  onde o trilho não existe. */}
              <span className="lg:hidden">
                <BotaoFoco />
              </span>

              <span className="flex items-center gap-1 lg:hidden">
                <Link
                  href="/app/configuracoes"
                  title={nomeCompleto}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-[0.82rem] font-bold text-brand-700"
                >
                  {inicial}
                </Link>
                <BotaoSair />
              </span>
            </div>
          </div>

          <div className="border-t border-line px-5 py-2.5 sm:px-7 lg:hidden">
            <NavegacaoApp orientacao="linha" />
          </div>
        </header>

        <main className="rolagem-fina flex min-h-0 flex-1 flex-col overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Fora do <main>: o widget acompanha a navegação entre as abas sem
          remontar, porque o layout não é recriado a cada rota filha. */}
      <WidgetFoco
        disciplinas={
          (disciplinasRes.data ?? []) as {
            id: string;
            slug: string;
            nome: string;
          }[]
        }
      />
    </div>
  );
}
