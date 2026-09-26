import type { Metadata } from "next";
import Link from "next/link";
import { formatarData } from "@/lib/format";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { getExames } from "@/lib/content/queries";

export const metadata: Metadata = {
  title: "Desempenho",
  robots: { index: false, follow: false },
};

/** Exames já aplicados pela FGV — o denominador da cobertura do acervo. */
const EXAMES_APLICADOS = 46;

/**
 * A régua da 1ª fase: 80 questões, 40 acertos para passar.
 *
 * O percentual sozinho não responde a pergunta que a pessoa faz. Projetado
 * sobre as 80 questões da prova, com a linha de corte marcada, responde.
 */
function LinhaDeCorte({ taxa }: { taxa: number }) {
  const projetado = Math.round((taxa / 100) * 80);
  const passa = projetado >= 40;

  return (
    <div className="flex flex-col gap-2">
      <div className="relative h-10 overflow-hidden rounded-[10px] bg-sunk">
        <div
          className={`h-full ${passa ? "bg-brand-500" : "bg-brand-300"}`}
          style={{ width: `${taxa}%` }}
        />
        <div
          className="absolute inset-y-0 left-1/2 w-0.5 bg-vinho-500"
          aria-hidden="true"
        />
      </div>

      {/* O rótulo vive fora da barra: sobre o preenchimento em esmeralda,
          ameixa sobre verde não passa em contraste nenhum. */}
      <div className="relative h-4">
        <span className="absolute left-0 text-[0.74rem] text-muted tabular-nums">
          0
        </span>
        <span className="absolute left-1/2 -translate-x-1/2 text-[0.74rem] font-semibold whitespace-nowrap text-vinho-600">
          40 · linha de corte
        </span>
        <span className="absolute right-0 text-[0.74rem] text-muted tabular-nums">
          80
        </span>
      </div>

      <p className="text-[0.88rem] text-muted">
        No seu ritmo, {projetado} de 80 questões — {passa ? "acima" : "abaixo"}{" "}
        dos 40 acertos que aprovam na 1ª fase.
      </p>
    </div>
  );
}

export default async function DesempenhoPage() {
  const supabase = await supabaseServidor();

  // Uma rodada: a lista de exames ia antes, sozinha, e o resto esperava.
  //
  // Por questão, não por tentativa: a mesma questão respondida quatro vezes
  // é uma questão no numerador, e é a última tentativa que conta. `distinct
  // on` vive no banco porque o PostgREST não expressa essa consulta.
  const [exames, desempenhoRes, percentilRes, ultimaRes, porDisciplinaRes] =
    await Promise.all([
      getExames(),
      supabase.rpc("meu_desempenho"),
      supabase.rpc("meu_percentil"),
      supabase
        .from("respostas")
        .select("respondido_em")
        .order("respondido_em", { ascending: false })
        .limit(1),
      supabase.rpc("meu_desempenho_por_disciplina"),
    ]);

  const porDisciplina = (porDisciplinaRes.data ?? []) as {
    disciplina_slug: string;
    disciplina_nome: string;
    respondidas: number;
    acertos: number;
    automatica: number;
  }[];
  const totalClassificadas = porDisciplina.reduce(
    (s, d) => s + Number(d.respondidas),
    0,
  );
  const automaticas = porDisciplina.reduce(
    (s, d) => s + Number(d.automatica),
    0,
  );

  const desempenho = (Array.isArray(desempenhoRes.data)
    ? desempenhoRes.data[0]
    : desempenhoRes.data) as
    | {
        respondidas: number;
        acertos: number;
        erros: number;
        tentativas: number;
        revisao_hoje: number;
      }
    | undefined;

  const respondidas = desempenho?.respondidas ?? 0;
  const acertos = desempenho?.acertos ?? 0;
  const erros = desempenho?.erros ?? 0;
  const tentativas = desempenho?.tentativas ?? 0;
  const revisaoHoje = desempenho?.revisao_hoje ?? 0;
  const percentil = (Array.isArray(percentilRes.data)
    ? percentilRes.data[0]
    : percentilRes.data) as
    | {
        minha_taxa: number | null;
        taxa_mediana: number | null;
        percentil: number | null;
        base: number;
        minhas_questoes: number | null;
      }
    | undefined;

  const ultima = ultimaRes.data?.[0]?.respondido_em ?? null;
  const comecou = respondidas > 0;
  const taxa = comecou ? Math.round((acertos / respondidas) * 100) : 0;

  const ingeridos = exames.filter((e) => e.questoesCarregadas > 0);
  const acervo = ingeridos.reduce((s, e) => s + e.questoesCarregadas, 0);
  const anuladas = ingeridos.reduce((s, e) => s + e.questoesAnuladas, 0);
  const definitivos = ingeridos.filter((e) => e.gabaritoDefinitivo).length;
  const cobertura = Math.round((ingeridos.length / EXAMES_APLICADOS) * 100);

  return (
    <div className="painel-conteudo flex flex-col gap-10">
      <header className="flex max-w-[58ch] flex-col gap-2">
        <h1 className="text-[clamp(1.75rem,3vw,2.15rem)] leading-[1.08] font-extrabold tracking-[-0.035em] text-ink">
          Desempenho
        </h1>
        <p className="text-body">
          Seus números de estudo e a composição do acervo em que você vai
          treinar.
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-[1.3rem] font-bold text-ink">Seus números</h2>

        {comecou ? (
          <>
            <div className="superficie flex flex-col gap-5 p-7">
              <div className="flex flex-wrap items-baseline justify-between gap-4">
                <span className="font-semibold text-ink">Taxa de acerto</span>
                <span className="text-[2.2rem] leading-none font-extrabold tracking-[-0.04em] text-brand-700 tabular-nums">
                  {taxa}%
                </span>
              </div>
              <LinhaDeCorte taxa={taxa} />
            </div>

            <dl className="grid gap-4 sm:grid-cols-3">
              {[
                [
                  respondidas.toLocaleString("pt-BR"),
                  "questões respondidas",
                  `${tentativas.toLocaleString("pt-BR")} tentativas no total`,
                  "/app/questoes",
                ],
                [
                  erros.toLocaleString("pt-BR"),
                  "no caderno de erros",
                  "última tentativa errada",
                  "/app/questoes?modo=erros",
                ],
                [
                  revisaoHoje.toLocaleString("pt-BR"),
                  "para revisar hoje",
                  "agendadas pela repetição espaçada",
                  "/app/questoes?modo=revisao",
                ],
              ].map(([valor, rotulo, nota, destino]) => (
                <Link
                  key={rotulo}
                  href={destino}
                  className="superficie flex flex-col gap-1 p-6 transition-colors hover:border-brand-200"
                >
                  <dd className="text-[2rem] leading-none font-extrabold tracking-[-0.04em] text-ink tabular-nums">
                    {valor}
                  </dd>
                  <dt className="text-[0.94rem] font-semibold text-ink">
                    {rotulo}
                  </dt>
                  <dd className="text-[0.86rem] text-muted">{nota}</dd>
                </Link>
              ))}
            </dl>

            {/* Comparação com quem mais estuda aqui. O número só aparece
                quando existe base para ele: um percentil calculado em três
                pessoas seria um ranking de três pessoas com cara de
                estatística. */}
            <div className="superficie flex flex-col gap-3 p-6">
              <span className="rotulo">Comparado a quem mais responde</span>
              {percentil?.percentil !== null &&
              percentil?.percentil !== undefined ? (
                <>
                  <p className="text-[1.15rem] font-bold text-ink">
                    Você está acima de {percentil.percentil}% de quem já
                    respondeu 20 questões ou mais
                  </p>
                  <div className="relative h-2.5 overflow-hidden rounded-full bg-sunk">
                    <div
                      className="h-full rounded-full bg-brand-500"
                      style={{ width: `${percentil.percentil}%` }}
                    />
                  </div>
                  <p className="text-[0.88rem] text-muted">
                    Sua taxa: {percentil.minha_taxa}% · mediana do grupo:{" "}
                    {percentil.taxa_mediana}% · {percentil.base} pessoas na
                    comparação. Conta só a primeira tentativa de cada questão —
                    acertar de novo depois de ver o gabarito é memória, não
                    conhecimento.
                  </p>
                </>
              ) : (
                <p className="max-w-[62ch] text-[0.94rem] text-body">
                  {(percentil?.minhas_questoes ?? 0) < 20
                    ? `Faltam ${20 - (percentil?.minhas_questoes ?? 0)} questões para você entrar na comparação — ela exige 20 respondidas, senão compararia quem respondeu 800 com quem respondeu 3.`
                    : `Ainda não há gente suficiente para comparar: são ${percentil?.base ?? 0} pessoas com 20 ou mais questões, e o corte é 10. Um percentil apurado em três pessoas seria um ranking de três pessoas.`}
                </p>
              )}
            </div>

            {ultima && (
              <p className="text-[0.88rem] text-muted">
                Última questão respondida em{" "}
                {formatarData(String(ultima).slice(0, 10))}.
              </p>
            )}
          </>
        ) : (
          /* Tela vazia é convite, não aviso. Ela já mostra a régua que a
             pessoa vai passar a ler todo dia — e explica o único número que
             decide a aprovação. */
          <div className="superficie grid gap-8 p-7 lg:grid-cols-[1fr_1.1fr] lg:p-8">
            <div className="flex flex-col gap-3">
              <span className="rotulo">Ainda sem respostas</span>
              <p className="text-[1.2rem] font-bold text-ink">
                Sua taxa de acerto aparece aqui na primeira questão respondida
              </p>
              <p className="max-w-[46ch] text-[0.96rem] text-body">
                Evolução por disciplina, caderno de erros e fila de revisão
                nascem do mesmo registro. Nada precisa ser anotado à mão.
              </p>
              <Link
                href="/app/estudar"
                className="mt-1 self-start rounded-full bg-brand-600 px-5 py-2.5 text-[0.92rem] font-semibold text-white transition-colors hover:bg-brand-700"
              >
                Ver por onde começar
              </Link>
            </div>

            <div className="flex flex-col gap-3 rounded-[16px] bg-paper p-5">
              <span className="rotulo">A régua da 1ª fase</span>
              <LinhaDeCorte taxa={0} />
            </div>
          </div>
        )}
      </section>

      {/* ---- Por disciplina ----
          A pergunta que a pessoa faz depois de ver a taxa geral é sempre a
          mesma: onde eu erro mais. A tela prometia esta resposta no estado
          vazio e não a dava, porque nenhuma questão tinha classificação. */}
      {porDisciplina.length > 0 && (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-[1.3rem] font-bold text-ink">
              Onde você erra mais
            </h2>
            <p className="text-[0.9rem] text-muted">
              Última tentativa de cada questão
            </p>
          </div>

          <ul className="superficie divide-y divide-line overflow-hidden">
            {porDisciplina.map((d) => {
              const taxaDisciplina = Math.round(
                (d.acertos / Math.max(1, d.respondidas)) * 100,
              );
              return (
                <li
                  key={d.disciplina_slug}
                  className="grid items-center gap-x-5 gap-y-2 p-4 sm:grid-cols-[1.1fr_1fr_auto] sm:p-5"
                >
                  <span className="flex flex-col gap-0.5">
                    <span className="font-semibold text-ink">
                      {d.disciplina_nome}
                    </span>
                    <span className="text-[0.8rem] text-muted tabular-nums">
                      {d.respondidas}{" "}
                      {d.respondidas === 1 ? "questão" : "questões"} ·{" "}
                      {d.acertos} {d.acertos === 1 ? "acerto" : "acertos"}
                    </span>
                  </span>

                  {/* Barra em vinho quando abaixo da linha de corte: é a
                      mesma cor que marca os 40 acertos na régua acima, e
                      aqui ela diz a mesma coisa — esta matéria ainda não
                      passa. */}
                  <span className="flex items-center gap-3">
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-sunk">
                      <span
                        className={`block h-full rounded-full ${
                          taxaDisciplina >= 50 ? "bg-brand-500" : "bg-vinho-400"
                        }`}
                        style={{ width: `${Math.max(taxaDisciplina, 3)}%` }}
                      />
                    </span>
                  </span>

                  <span
                    className={`text-[1.05rem] font-bold tabular-nums sm:justify-self-end ${
                      taxaDisciplina >= 50 ? "text-brand-600" : "text-vinho-600"
                    }`}
                  >
                    {taxaDisciplina}%
                  </span>
                </li>
              );
            })}
          </ul>

          {/* A procedência vem junto com o número, como na ficha do exame. */}
          {automaticas > 0 && (
            <p className="text-[0.86rem] text-muted">
              {automaticas === totalClassificadas
                ? "A disciplina de cada questão foi atribuída por classificação automática, ainda sem revisão humana — o agrupamento é aproximado."
                : `Em ${automaticas} das ${totalClassificadas} questões a disciplina veio de classificação automática, ainda sem revisão humana.`}
            </p>
          )}
        </section>
      )}

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-[1.3rem] font-bold text-ink">O acervo</h2>
          <p className="text-[0.9rem] text-muted">
            Extraído dos cadernos oficiais da FGV
          </p>
        </div>

        <div className="superficie flex flex-col gap-3 p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <span className="font-semibold text-ink">
              {ingeridos.length} de {EXAMES_APLICADOS} exames ingeridos
            </span>
            <span className="text-[0.88rem] text-muted tabular-nums">
              {cobertura}% do histórico da FGV
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-sunk">
            <div
              className="h-full rounded-full bg-brand-500"
              style={{ width: `${cobertura}%` }}
            />
          </div>
          <p className="text-[0.88rem] text-muted">
            A ingestão avança do exame mais recente para trás — o que caiu no
            ano passado prediz melhor a próxima prova.
          </p>
        </div>

        <dl className="grid gap-4 sm:grid-cols-3">
          {[
            [
              acervo.toLocaleString("pt-BR"),
              "questões",
              "com enunciado e alternativas",
            ],
            [
              `${anuladas}`,
              "anuladas",
              "fora dos simulados, mantidas como estudo",
            ],
            [
              `${definitivos}/${ingeridos.length}`,
              "com gabarito definitivo",
              "o resto usa o preliminar",
            ],
          ].map(([valor, rotulo, nota]) => (
            <div key={rotulo} className="superficie flex flex-col gap-1 p-6">
              <dd className="text-[2rem] leading-none font-extrabold tracking-[-0.04em] text-brand-700 tabular-nums">
                {valor}
              </dd>
              <dt className="mt-1 font-semibold text-ink">{rotulo}</dt>
              <dd className="text-[0.86rem] text-muted">{nota}</dd>
            </div>
          ))}
        </dl>

        <div className="superficie mt-2 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-[0.93rem]">
            <thead>
              <tr className="border-b border-line bg-sunk text-left">
                <th className="rotulo px-6 py-3.5">Exame</th>
                <th className="rotulo px-6 py-3.5">Aplicado</th>
                <th className="rotulo px-6 py-3.5 text-right">Questões</th>
                <th className="rotulo px-6 py-3.5 text-right">Anuladas</th>
                <th className="rotulo px-6 py-3.5 text-right">Gabarito</th>
              </tr>
            </thead>
            <tbody>
              {ingeridos.map((e) => (
                <tr
                  key={e.slug}
                  className="border-b border-line transition-colors last:border-0 hover:bg-paper"
                >
                  <td className="px-6 py-3 font-semibold text-ink">
                    <Link
                      href={`/exames/${e.slug}`}
                      className="transition-colors hover:text-brand-600"
                    >
                      {e.edicao}º Exame
                    </Link>
                  </td>
                  <td className="px-6 py-3 text-muted tabular-nums">
                    {formatarData(e.data)}
                  </td>
                  <td className="px-6 py-3 text-right text-ink tabular-nums">
                    {e.questoesCarregadas}
                  </td>
                  <td className="px-6 py-3 text-right text-muted tabular-nums">
                    {e.questoesAnuladas || "—"}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[0.8rem] font-semibold ${
                        e.gabaritoDefinitivo
                          ? "bg-brand-50 text-brand-700"
                          : "bg-ouro-50 text-ouro-700"
                      }`}
                    >
                      {e.gabaritoDefinitivo ? "definitivo" : "preliminar"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
