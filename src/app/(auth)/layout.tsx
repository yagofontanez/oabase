/** As telas de autenticação são uma experiência própria, sem navegação da
 * landing. A altura fica presa ao viewport para não criar uma segunda dobra. */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <main className="h-svh overflow-hidden">{children}</main>;
}
