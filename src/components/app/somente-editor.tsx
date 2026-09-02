import Link from "next/link";

/**
 * O que aparece para quem não é editor.
 *
 * Não é uma tela de erro: a pessoa não fez nada errado, só chegou numa
 * ferramenta interna. Dizer o que é e devolver ao painel resolve — e não
 * insinuar que existe um jeito de pedir acesso evita a conversa de suporte
 * que ninguém quer ter. A porta de verdade é o `sou_editor()` do banco.
 */
export function SomenteEditor() {
  return (
    <div className="painel-conteudo flex max-w-[54ch] flex-col items-start gap-4">
      <h1 className="text-[clamp(1.6rem,3vw,2rem)] leading-[1.1] font-extrabold tracking-[-0.035em] text-ink">
        Ferramenta da equipe
      </h1>
      <p className="text-body">
        Esta tela é usada para revisar a classificação das questões e escrever
        os comentários publicados no site. Não faz parte do plano.
      </p>
      <Link
        href="/app"
        className="rounded-full bg-brand-600 px-6 py-2.5 text-[0.94rem] font-semibold text-white transition-colors hover:bg-brand-700"
      >
        Voltar ao painel
      </Link>
    </div>
  );
}
