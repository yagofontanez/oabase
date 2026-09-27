/** Autenticação tem navegação própria. A página pode crescer com teclado,
 * zoom e mensagens de feedback sem cortar os controles. */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <main className="min-h-svh">{children}</main>;
}
