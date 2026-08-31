import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WidgetFoco } from "@/components/app/widget-foco";
import { getDisciplinasComId } from "@/lib/content/queries";

/**
 * Chrome do site público.
 *
 * Header e rodapé moram aqui, e não no layout raiz, porque layout filho não
 * consegue remover o que o pai já renderizou — era por isso que as telas de
 * conta apareciam com o rodapé de marketing inteiro embaixo do formulário.
 */
export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // O widget vive aqui também de propósito: o principal material de estudo —
  // a legislação comentada — é público, e o cronômetro precisa continuar
  // rodando enquanto a pessoa lê. Ele não renderiza nada sem sessão de foco
  // ativa, e a consulta usa a chave anônima, então as páginas seguem estáticas.
  const disciplinas = await getDisciplinasComId();

  return (
    <>
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <WidgetFoco disciplinas={disciplinas} />
    </>
  );
}
