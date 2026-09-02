/**
 * Esqueleto de carregamento.
 *
 * Formas cinzas no lugar exato do que está vindo, e não um giro no meio da
 * tela. A diferença é de percepção, não de tempo: o giro diz "espere"; a
 * forma diz "é aqui que vai aparecer", e a página deixa de parecer travada
 * mesmo levando o mesmo tanto.
 *
 * O desenho é propositalmente vago — título, uma fileira de cartões, uma
 * lista. Todas as telas do painel têm essa silhueta, e um esqueleto que
 * imitasse tela por tela viraria uma segunda cópia de cada layout, com o
 * defeito de sair de sincronia sem ninguém perceber.
 */
export function Esqueleto({ cartoes = 4 }: { cartoes?: number }) {
  return (
    <div
      className="painel-conteudo flex flex-col gap-8"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Carregando</span>

      <div className="flex flex-col gap-3">
        <span className="carregando h-8 w-[min(60%,18rem)]" />
        <span className="carregando h-4 w-[min(90%,34rem)]" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: cartoes }, (_, i) => (
          <span key={i} className="carregando h-[8.5rem] rounded-2xl" />
        ))}
      </div>

      <div className="flex flex-col gap-2.5">
        {Array.from({ length: 4 }, (_, i) => (
          <span key={i} className="carregando h-[4.5rem] rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
