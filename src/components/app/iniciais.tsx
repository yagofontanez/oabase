/**
 * Iniciais de quem falou.
 *
 * Duas telas do app deixaram de ser monólogo — fórum e suporte — e numa lista
 * de vozes o olho precisa de uma âncora por linha para não ler tudo como um
 * bloco só. Iniciais, e não foto: ninguém tem foto no OABase, e um lugar para
 * carregar imagem traria moderação de imagem junto.
 */
export function Iniciais({
  nome,
  tom = "neutro",
}: {
  nome: string;
  tom?: "neutro" | "marca";
}) {
  const letras = nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte.charAt(0).toUpperCase())
    .join("");

  return (
    <span
      aria-hidden="true"
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[0.8rem] font-bold ${
        tom === "marca"
          ? "bg-brand-600 text-white"
          : "bg-sunk text-body ring-1 ring-line"
      }`}
    >
      {letras || "?"}
    </span>
  );
}
