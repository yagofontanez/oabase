import Link from "next/link";

export type AtalhoDeEstudo = {
  chave: "novas" | "revisao" | "erros" | "simulado";
  rotulo: string;
  quantidade: number | null;
  unidade: string;
  /** O que a pessoa ganha ao abrir. Uma linha, na voz de quem estuda. */
  porque: string;
  /** O que dizer quando a contagem é zero — e é boa notícia. */
  vazio: string;
  href: string;
  icone: React.ReactNode;
};

export type DisciplinaDeEstudo = {
  slug: string;
  nome: string;
  mediaPorProva: number;
  fatia: number;
  comentados: number;
  /** Artigo mais cobrado já comentado, quando existe. */
  artigo: { href: string; rotulo: string } | null;
  /** A norma central, com quantos artigos ela tem. */
  lei: { href: string; sigla: string; artigos: number } | null;
};

export type FaixaDeEstudo = {
  titulo: string;
  texto: string;
  itens: DisciplinaDeEstudo[];
  questoes: number;
};

export type Acervo = {
  questoes: number;
  exames: number;
  artigos: number;
  normas: number;
  sumulas: number;
  comentados: number;
};

/**
 * A tela de estudo.
 *
 * O trabalho dela é responder uma pergunta só: **o que eu abro agora.** A
 * versão anterior respondia outra — "como a prova se divide" — e o resultado
 * era um mapa de barras onde o único caminho para o conteúdo era um link
 * fraco no fim de cada linha. Quem chegava com quarenta minutos livres saía
 * com a impressão de que não havia material, tendo 3.540 questões e 42 normas
 * do outro lado de dois cliques.
 *
 * Então a ordem inverteu: primeiro as quatro portas que existem de fato
 * (novas, revisão, erros, simulado), com o número de cada uma; depois o
 * tamanho do acervo, em números; e só então o mapa por disciplina — que
 * continua sendo a informação mais valiosa da tela, mas é resposta para a
 * segunda pergunta, não para a primeira.
 *
 * Contagem zero não vira "0". Vira frase: "nada marcado para hoje" é boa
 * notícia, e um zero grande no meio de um cartão lê como falta.
 */
export function Estudar({
  atalhos,
  acervo,
  faixas,
  temPlano,
  respondidas,
}: {
  atalhos: AtalhoDeEstudo[];
  acervo: Acervo;
  faixas: FaixaDeEstudo[];
  temPlano: boolean;
  respondidas: number;
}) {
  return (
    <div className="painel-conteudo flex flex-col gap-10">
      <header className="flex max-w-[62ch] flex-col gap-2">
        <h1 className="text-[clamp(1.75rem,3vw,2.15rem)] leading-[1.08] font-extrabold tracking-[-0.035em] text-ink">
          Estudar
        </h1>
        <p className="text-body">
          {!temPlano
            ? "A legislação, as súmulas e as fichas dos exames estão abertas — comece por elas. Treinar com as questões faz parte do plano."
            : respondidas === 0
              ? "Quatro formas de treinar e o acervo inteiro aberto. Se está começando agora, a primeira porta é a da esquerda."
              : "Escolha a porta. Abaixo, o acervo e a ordem em que ele rende mais."}
        </p>
      </header>

      {/* ---- As quatro portas ----
          Sem plano elas continuam visíveis, e de propósito: esconder o que
          existe do outro lado é o que faz a tela parecer vazia. O que muda é
          o destino e o segundo cartão de baixo, que diz o preço em vez de
          repetir "faz parte do plano" quatro vezes. */}
      <section className="flex flex-col gap-3">
        <h2 className="rotulo">
          {temPlano ? "Abrir agora" : "O que o plano libera"}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {atalhos.map((a) => {
            const bloqueado = !temPlano;
            // Sem plano não há contagem que faça sentido — `meu_desempenho`
            // devolve zero pela RLS, e um "0" grande aqui leria como acervo
            // vazio em vez de acesso fechado.
            const vazio = !bloqueado && a.quantidade === 0;
            return (
              <Link
                key={a.chave}
                href={bloqueado ? "/app/assinar" : a.href}
                className={`group flex flex-col gap-3 rounded-2xl border bg-surface p-5 transition-all ${
                  vazio && !bloqueado
                    ? "border-line hover:border-brand-200"
                    : "border-line shadow-[var(--shadow-baixa)] hover:border-brand-300 hover:shadow-[var(--shadow-media)]"
                }`}
              >
                <span className="flex items-center justify-between gap-3">
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-full ${
                      vazio ? "bg-sunk text-muted" : "bg-brand-50 text-brand-600"
                    }`}
                  >
                    {a.icone}
                  </span>
                  {a.quantidade !== null && !vazio && !bloqueado && (
                    <span className="text-[1.55rem] leading-none font-extrabold tracking-[-0.02em] text-ink tabular-nums">
                      {a.quantidade.toLocaleString("pt-BR")}
                    </span>
                  )}
                </span>

                <span className="flex flex-col gap-1">
                  <span className="text-[1.02rem] font-bold text-ink group-hover:text-brand-700">
                    {a.rotulo}
                  </span>
                  <span className="text-[0.86rem] leading-relaxed text-muted">
                    {bloqueado ? a.porque : vazio ? a.vazio : `${a.unidade} · ${a.porque}`}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ---- O que existe ----
          Três números com link. É o antídoto direto para a impressão de
          tela vazia: o acervo é grande e estava escondido atrás da
          navegação. */}
      <section className="flex flex-col gap-3">
        <h2 className="rotulo">O que já está no acervo</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <CartaoDeAcervo
            href={temPlano ? "/app/questoes?modo=todas" : "/precos"}
            valor={acervo.questoes.toLocaleString("pt-BR")}
            rotulo="questões reais"
            nota={`de ${acervo.exames} exames, com gabarito oficial da FGV`}
          />
          <CartaoDeAcervo
            href="/legislacao"
            valor={acervo.artigos.toLocaleString("pt-BR")}
            rotulo="artigos de lei"
            nota={`em ${acervo.normas} normas, texto compilado do Planalto`}
          />
          <CartaoDeAcervo
            href="/sumulas"
            valor={acervo.sumulas.toLocaleString("pt-BR")}
            rotulo="súmulas do STF"
            nota="vinculantes e comuns, em vigor"
          />
        </div>
      </section>

      {/* ---- O mapa ---- */}
      <section className="flex flex-col gap-6">
        <div className="flex max-w-[62ch] flex-col gap-1.5">
          <h2 className="text-[1.3rem] font-bold text-ink">
            Por onde rende mais
          </h2>
          <p className="text-[0.94rem] text-body">
            A ordem importa mais do que o volume. As disciplinas estão
            agrupadas pela fatia que ocupam na prova — treine ou leia direto de
            cada linha.
          </p>
        </div>

        {faixas.map((faixa) => (
          <div key={faixa.titulo} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="flex flex-wrap items-baseline gap-2">
                <span className="text-[1.02rem] font-bold text-ink">
                  {faixa.titulo}
                </span>
                <span className="text-[0.86rem] text-muted">{faixa.texto}</span>
              </span>
              <span className="text-[0.84rem] text-muted tabular-nums">
                ~{faixa.questoes} de 80 questões
              </span>
            </div>

            <ul className="superficie divide-y divide-line overflow-hidden">
              {faixa.itens.map((d) => (
                <li
                  key={d.slug}
                  className="grid items-center gap-x-5 gap-y-3 p-4 sm:grid-cols-[1.25fr_0.75fr_auto] sm:p-5"
                >
                  <span className="flex flex-col gap-0.5">
                    <span className="font-semibold text-ink">{d.nome}</span>
                    <span className="text-[0.8rem] text-muted">
                      {d.comentados > 0
                        ? `${d.comentados} ${d.comentados === 1 ? "artigo comentado" : "artigos comentados"}`
                        : d.lei
                          ? `${d.lei.artigos.toLocaleString("pt-BR")} artigos · ${d.lei.sigla}`
                          : "sem norma central no acervo"}
                    </span>
                  </span>

                  <span className="flex items-center gap-3">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunk">
                      <span
                        className="block h-full rounded-full bg-brand-400"
                        style={{ width: `${d.fatia}%` }}
                      />
                    </span>
                    <span className="shrink-0 text-[0.84rem] text-muted tabular-nums">
                      {d.mediaPorProva}q
                    </span>
                  </span>

                  {/* Duas ações, e não um link: treinar e ler são as duas
                      coisas que se faz com uma disciplina, e escolher uma
                      delas pela pessoa foi o que fez a tela anterior parecer
                      um relatório. */}
                  <span className="flex flex-wrap gap-2 sm:justify-end">
                    <Link
                      href={
                        temPlano
                          ? `/app/questoes?disciplina=${d.slug}`
                          : "/app/assinar"
                      }
                      className="rounded-full bg-brand-50 px-4 py-1.5 text-[0.85rem] font-semibold whitespace-nowrap text-brand-700 transition-colors hover:bg-brand-100"
                    >
                      Treinar
                    </Link>
                    {(d.artigo ?? d.lei) && (
                      <Link
                        href={d.artigo?.href ?? d.lei!.href}
                        className="rounded-full border border-line px-4 py-1.5 text-[0.85rem] font-semibold whitespace-nowrap text-ink transition-colors hover:border-brand-300 hover:text-brand-700"
                      >
                        {d.artigo ? d.artigo.rotulo : `Ler ${d.lei!.sigla}`}
                      </Link>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <p className="text-[0.86rem] text-muted">
          A média por disciplina ainda é estimativa: ela vira dado medido
          quando a classificação das questões do acervo for revisada.
          {acervo.comentados > 0 && (
            <>
              {" "}
              Artigos com comentário publicado: {acervo.comentados} de{" "}
              {acervo.artigos.toLocaleString("pt-BR")}.
            </>
          )}
        </p>
      </section>
    </div>
  );
}

function CartaoDeAcervo({
  href,
  valor,
  rotulo,
  nota,
}: {
  href: string;
  valor: string;
  rotulo: string;
  nota: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-1 rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-brand-300"
    >
      <span className="text-[1.75rem] leading-none font-extrabold tracking-[-0.03em] text-brand-600 tabular-nums">
        {valor}
      </span>
      <span className="text-[0.96rem] font-semibold text-ink group-hover:text-brand-700">
        {rotulo}
      </span>
      <span className="text-[0.84rem] leading-relaxed text-muted">{nota}</span>
    </Link>
  );
}
