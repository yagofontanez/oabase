import type { GuiaDeConexao } from "@/lib/mcp";

/**
 * Cartão de passo a passo por assistente. Partilhado entre a página pública
 * `/mcp` e a área logada `/app/mcp` — dois visuais com o mesmo texto
 * divergiriam na primeira atualização de interface de um provedor.
 */
export function CartaoDeConexao({
  guia,
  id,
}: {
  guia: GuiaDeConexao;
  id?: string;
}) {
  return (
    <article
      id={id}
      className={`flex flex-col rounded-[16px] border border-line bg-surface p-5 ${
        id ? "scroll-mt-24" : ""
      }`}
    >
      <h3 className="text-[1.02rem] font-bold text-ink">{guia.nome}</h3>
      <p className="mt-1 text-[0.84rem] leading-relaxed text-body">{guia.resumo}</p>
      {guia.comando && (
        <pre className="mt-3 overflow-x-auto rounded-[12px] bg-noite p-3.5 text-[0.72rem] leading-relaxed text-brand-100">
          <code>{guia.comando}</code>
        </pre>
      )}
      <ol className="mt-4 flex flex-col gap-3">
        {guia.passos.map((passo, indice) => (
          <li key={indice} className="flex gap-3 text-[0.84rem] leading-relaxed text-body">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[0.66rem] font-bold text-brand-700">
              {indice + 1}
            </span>
            <span>{passo}</span>
          </li>
        ))}
      </ol>
    </article>
  );
}