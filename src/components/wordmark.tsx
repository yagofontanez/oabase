export function Wordmark({
  className = "",
  tom = "escuro",
}: {
  className?: string;
  /** `claro` inverte a marca para fundo escuro — o trilho do painel. */
  tom?: "escuro" | "claro";
}) {
  return (
    <span
      className={`text-[1.32rem] font-extrabold tracking-[-0.035em] ${
        tom === "claro" ? "text-white" : "text-ink"
      } ${className}`}
    >
      OA
      <span className={tom === "claro" ? "text-brand-200" : "text-brand-500"}>
        Base
      </span>
    </span>
  );
}
