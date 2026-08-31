import Link from "next/link";

/**
 * Bloco de conversão que fecha as páginas de conteúdo aberto.
 * Ameixa é a cor da camada paga, aqui em tinta suave — o convite não
 * precisa gritar quando a página inteira já foi entregue de graça.
 */
export function PaywallCta({
  titulo = "Treine isso no banco de questões",
  texto = "O conteúdo desta página é aberto. O banco completo de questões comentadas, os simulados cronometrados e o caderno de erros ficam no plano — que dura até o dia da sua prova.",
}: {
  titulo?: string;
  texto?: string;
}) {
  return (
    <aside className="mt-16 flex flex-col gap-5 rounded-[26px] bg-vinho-50 p-8 sm:p-10">
      <span className="selo self-start bg-white/70 text-vinho-600">
        Plano OABase
      </span>
      <h2 className="max-w-[22ch] text-[1.7rem] leading-[1.15] font-bold text-vinho-700">
        {titulo}
      </h2>
      <p className="max-w-[58ch] text-[0.98rem] text-vinho-700/80">{texto}</p>
      <div className="flex flex-wrap items-center gap-4 pt-1">
        <Link
          href="/precos"
          className="rounded-full bg-vinho-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-vinho-600"
        >
          Ver planos
        </Link>
        <span className="text-[0.9rem] text-vinho-600/70">
          7 dias de acesso por R$&nbsp;1
        </span>
      </div>
    </aside>
  );
}
