import type { Metadata } from "next";
import Link from "next/link";
import { formatarData } from "@/lib/format";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { getExames } from "@/lib/content/queries";

export const metadata: Metadata = {
  title: "Desempenho",
  robots: { index: false, follow: false },
};

export default async function DesempenhoPage() {
  const exames = await getExames();
  const supabase = await supabaseServidor();
  const hoje = new Date().toISOString().slice(0, 10);

  const [respondidasRes, acertosRes, revisaoRes, ultimaRes] = await Promise.all([
    supabase.from("respostas").select("*", { count: "exact", head: true }),
    supabase
      .from("respostas")
      .select("*", { count: "exact", head: true })
      .eq("acertou", true),
    supabase
      .from("revisoes")
      .select("*", { count: "exact", head: true })
      .lte("proxima_em", hoje),
    supabase
      .from("respostas")
      .select("respondido_em")
      .order("respondido_em", { ascending: false })
      .limit(1),
  ]);

  const respondidas = respondidasRes.count ?? 0;
  const acertos = acertosRes.count ?? 0;
  const revisaoHoje = revisaoRes.count ?? 0;
  const ultima = ultimaRes.data?.[0]?.respondido_em ?? null;
  const comecou = respondidas > 0;
  const taxa = comecou ? Math.round((acertos / respondidas) * 100) : 0;

  const ingeridos = exames.filter((e) => e.questoesCarregadas > 0);
  const acervo = ingeridos.reduce((s, e) => s + e.questoesCarregadas, 0);
  const anuladas = ingeridos.reduce((s, e) => s + e.questoesAnuladas, 0);
  const definitivos = ingeridos.filter((e) => e.gabaritoDefinitivo).length;

  return (
    <div className="flex flex-col gap-10">
      <header className="flex max-w-[58ch] flex-col gap-2">
        <h1 className="text-[clamp(1.8rem,3.2vw,2.3rem)] leading-[1.06] font-extrabold tracking-[-0.035em] text-ink">
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
            <div className="superficie flex flex-col gap-4 p-7">
              <div className="flex flex-wrap items-baseline justify-between gap-4">
                <span className="font-semibold text-ink">Taxa de acerto</span>
                <span className="text-[2rem] leading-none font-extrabold tracking-[-0.04em] text-brand-700 tabular-nums">
                  {taxa}%
                </span>
              </div>
              {/* A linha de corte é o dado que decide a aprovação: 40 de 80.
                  Sem ela, um percentual solto não diz se está bom. */}
              <div className="relative h-3 overflow-hidden rounded-full bg-sunk">
                <div
                  className="h-full rounded-full bg-brand-500"
                  style={{ width: `${taxa}%` }}
                />
                <div
                  className="absolute inset-y-0 w-0.5 bg-vinho-500"
                  style={{ left: "50%" }}
                  aria-hidden="true"
                />
              </div>
              <p className="text-[0.88rem] text-muted">
                A linha em ameixa marca 50% — os 40 acertos de 80 que aprovam
                na 1ª fase.
              </p>
            </div>

            <dl className="grid gap-4 sm:grid-cols-3">
              {[
                [respondidas.toLocaleString("pt-BR"), "respondidas"],
                [(respondidas - acertos).toLocaleString("pt-BR"), "no caderno de erros"],
                [revisaoHoje.toLocaleString("pt-BR"), "para revisar hoje"],
              ].map(([valor, rotulo]) => (
                <div key={rotulo} className="superficie flex flex-col gap-1 p-6">
                  <dd className="text-[2rem] leading-none font-extrabold tracking-[-0.04em] text-ink tabular-nums">
                    {valor}
                  </dd>
                  <dt className="text-[0.94rem] text-muted">{rotulo}</dt>
                </div>
              ))}
            </dl>

            {ultima && (
              <p className="text-[0.88rem] text-muted">
                Última questão respondida em{" "}
                {formatarData(String(ultima).slice(0, 10))}.
              </p>
            )}
          </>
        ) : (
          <div className="superficie flex flex-col gap-3 p-8">
            <p className="text-[1.15rem] font-bold text-ink">
              Nenhuma questão respondida ainda
            </p>
            <p className="max-w-[62ch] text-body">
              Taxa de acerto, evolução por disciplina e o tamanho do caderno de
              erros aparecem aqui a partir da primeira resposta. Nada precisa
              ser anotado à mão — o registro é automático.
            </p>
            <Link
              href="/app/estudar"
              className="mt-1 self-start font-semibold text-brand-600 underline decoration-brand-200 decoration-2 underline-offset-4 transition-colors hover:decoration-brand-500"
            >
              Ver por onde começar
            </Link>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-[1.3rem] font-bold text-ink">O acervo</h2>
          <p className="text-[0.9rem] text-muted">
            Extraído dos cadernos oficiais da FGV
          </p>
        </div>

        <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            [acervo.toLocaleString("pt-BR"), "questões", "com enunciado e alternativas"],
            [`${ingeridos.length}`, "exames ingeridos", "de 46 já aplicados"],
            [`${anuladas}`, "anuladas", "fora dos simulados, mantidas como estudo"],
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
                <th className="px-6 py-3.5 font-semibold text-muted">Exame</th>
                <th className="px-6 py-3.5 font-semibold text-muted">Aplicado</th>
                <th className="px-6 py-3.5 text-right font-semibold text-muted">
                  Questões
                </th>
                <th className="px-6 py-3.5 text-right font-semibold text-muted">
                  Anuladas
                </th>
                <th className="px-6 py-3.5 text-right font-semibold text-muted">
                  Gabarito
                </th>
              </tr>
            </thead>
            <tbody>
              {ingeridos.map((e) => (
                <tr key={e.slug} className="border-b border-line last:border-0">
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
