import type { Metadata } from "next";
import Link from "next/link";
import { BotaoFoco } from "@/components/app/botao-foco";
import { GraficoFoco, type DiaDeFoco } from "@/components/app/grafico-foco";
import { Contagem } from "@/components/contagem";
import { formatarData } from "@/lib/format";
import { supabaseServidor, usuarioAtual } from "@/lib/supabase/servidor";
import { diasAte, getExames, getProximoExame } from "@/lib/content/queries";

export const metadata: Metadata = {
  title: "Painel",
  robots: { index: false, follow: false },
};

const ATALHOS = [
  {
    href: "/app/estudar",
    titulo: "Começar a estudar",
    texto: "A ordem das disciplinas por peso, e o que abrir primeiro.",
  },
  {
    href: "/legislacao",
    titulo: "Legislação comentada",
    texto: "Artigo por artigo, com a incidência de cada dispositivo.",
  },
  {
    href: "/app/desempenho",
    titulo: "Ver desempenho",
    texto: "Seus números e a composição do acervo já ingerido.",
  },
];

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** Data local no formato AAAA-MM-DD — o dia de quem estuda, não o do servidor. */
function diaLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function horas(minutos: number) {
  if (minutos <= 0) return "0h00";
  const h = Math.floor(minutos / 60);
  return `${h}h${String(minutos % 60).padStart(2, "0")}`;
}

export default async function PainelPage() {
  const [usuario, proximo, exames] = await Promise.all([
    usuarioAtual(),
    getProximoExame(),
    getExames(),
  ]);

  const supabase = await supabaseServidor();
  const agora = new Date();
  const hojeISO = diaLocal(agora);

  // 30 dias cobrem a série de 14 e ainda sobram dias para a sequência.
  const desde = new Date(agora);
  desde.setDate(desde.getDate() - 34);

  // Todas as consultas passam por RLS: `respostas`, `assinaturas` e
  // `sessoes_foco` filtram por dono. Uma sessão só enxerga o que é dela, sem
  // nenhum filtro escrito aqui.
  const [assinaturaRes, respondidasRes, acertosRes, focoRes] = await Promise.all([
    supabase
      .from("assinaturas")
      .select("plano, fim")
      .eq("status", "ativa")
      .order("fim", { ascending: false })
      .limit(1),
    supabase.from("respostas").select("*", { count: "exact", head: true }),
    supabase
      .from("respostas")
      .select("*", { count: "exact", head: true })
      .eq("acertou", true),
    supabase
      .from("sessoes_foco")
      .select("minutos, concluido_em, disciplinas(nome)")
      .gte("concluido_em", desde.toISOString())
      .order("concluido_em", { ascending: false }),
  ]);

  const assinatura = assinaturaRes.data?.[0] ?? null;
  const respondidas = respondidasRes.count ?? 0;
  const acertos = acertosRes.count ?? 0;
  const comecou = respondidas > 0;
  const taxa = comecou ? Math.round((acertos / respondidas) * 100) : null;

  type Sessao = {
    minutos: number;
    concluido_em: string;
    disciplinas: { nome: string } | { nome: string }[] | null;
  };
  const sessoes = (focoRes.data ?? []) as unknown as Sessao[];

  const porDia = new Map<string, number>();
  const porDisciplina = new Map<string, number>();
  for (const s of sessoes) {
    const dia = diaLocal(new Date(s.concluido_em));
    porDia.set(dia, (porDia.get(dia) ?? 0) + s.minutos);

    const rel = Array.isArray(s.disciplinas) ? s.disciplinas[0] : s.disciplinas;
    const nome = rel?.nome ?? "Sem disciplina";
    porDisciplina.set(nome, (porDisciplina.get(nome) ?? 0) + s.minutos);
  }

  const serie: DiaDeFoco[] = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(agora);
    d.setDate(d.getDate() - (13 - i));
    const chave = diaLocal(d);
    return {
      dia: chave,
      rotulo: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
      diaDaSemana: SEMANA[d.getDay()],
      minutos: porDia.get(chave) ?? 0,
    };
  });

  const focoHoje = porDia.get(hojeISO) ?? 0;
  const focoSemana = serie.slice(7).reduce((s, d) => s + d.minutos, 0);

  // Sequência: dias seguidos com foco, terminando hoje ou ontem — quem ainda
  // não estudou hoje não deveria perder a sequência ao meio-dia.
  let sequencia = 0;
  for (let i = 0; i < 60; i++) {
    const d = new Date(agora);
    d.setDate(d.getDate() - i);
    const minutos = porDia.get(diaLocal(d)) ?? 0;
    if (minutos > 0) sequencia++;
    else if (i > 0) break;
  }

  const disciplinasFoco = [...porDisciplina.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const maiorDisciplina = disciplinasFoco[0]?.[1] ?? 1;

  const dias = diasAte(proximo.data);
  const ingeridos = exames.filter((e) => e.questoesCarregadas > 0);
  const acervo = ingeridos.reduce((s, e) => s + e.questoesCarregadas, 0);
  const temFoco = sessoes.length > 0;

  // Projeção honesta: o ritmo dos últimos 7 dias, estendido até a prova.
  const mediaDiaria = Math.round(focoSemana / 7);
  const projecao = mediaDiaria * dias;

  const nome =
    (usuario?.user_metadata?.nome as string | undefined)?.split(" ")[0] ??
    usuario?.email?.split("@")[0] ??
    "você";

  const tiles = [
    { valor: horas(focoHoje), rotulo: "de foco hoje", nota: "blocos concluídos", vivo: focoHoje > 0 },
    { valor: horas(focoSemana), rotulo: "nos últimos 7 dias", nota: `média de ${mediaDiaria} min/dia`, vivo: focoSemana > 0 },
    {
      valor: `${sequencia}`,
      rotulo: sequencia === 1 ? "dia seguido" : "dias seguidos",
      nota: sequencia > 0 ? "sequência ativa" : "comece hoje",
      vivo: sequencia > 0,
    },
    { valor: `${dias}`, rotulo: "dias até a prova", nota: formatarData(proximo.data), vivo: true },
  ];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <h1 className="text-[clamp(1.8rem,3.2vw,2.3rem)] leading-[1.06] font-extrabold tracking-[-0.035em] text-ink">
            Olá, {nome}
          </h1>
          <span className="selo">
            <span className="h-1.5 w-1.5 rounded-full bg-ouro-400" />
            Faltam
            <span className="font-semibold tabular-nums text-brand-800">
              <Contagem dataISO={proximo.data} dias={dias} />
            </span>
          </span>
        </div>
        <p className="text-body">
          A 1ª fase do {proximo.edicao}º Exame é em{" "}
          {formatarData(proximo.data, { day: "2-digit", month: "long", year: "numeric" })}.
        </p>
      </header>

      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.rotulo} className="superficie flex flex-col gap-1 p-6">
            <dd
              className={`text-[2.3rem] leading-none font-extrabold tracking-[-0.04em] tabular-nums ${
                t.vivo ? "text-brand-700" : "text-hairline"
              }`}
            >
              {t.valor}
            </dd>
            <dt className="mt-1 font-semibold text-ink">{t.rotulo}</dt>
            <dd className="text-[0.86rem] text-muted">{t.nota}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <GraficoFoco dias={serie} />

        <figure className="superficie flex flex-col gap-5 p-6">
          <figcaption className="flex flex-col gap-0.5">
            <h2 className="text-[1.15rem] font-bold text-ink">
              Foco por disciplina
            </h2>
            <p className="text-[0.88rem] text-muted">
              {temFoco
                ? "No que você tem colocado o tempo"
                : "Escolha a disciplina no widget para separar o tempo"}
            </p>
          </figcaption>

          {disciplinasFoco.length > 0 ? (
            <ul className="flex flex-col gap-3.5">
              {disciplinasFoco.map(([nomeDisciplina, minutos]) => (
                <li key={nomeDisciplina} className="flex flex-col gap-1.5">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-[0.92rem] text-body">
                      {nomeDisciplina}
                    </span>
                    <span className="shrink-0 text-[0.88rem] font-semibold text-ink tabular-nums">
                      {horas(minutos)}
                    </span>
                  </span>
                  <span className="h-2 overflow-hidden rounded-full bg-sunk">
                    <span
                      className="block h-full rounded-full bg-brand-500"
                      style={{ width: `${(minutos / maiorDisciplina) * 100}%` }}
                    />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[0.92rem] text-muted">
              Nenhum bloco concluído ainda. O tempo aparece aqui separado por
              disciplina assim que você começar.
            </p>
          )}
        </figure>
      </div>

      {/* Projeção só existe com ritmo medido: extrapolar de zero seria
          inventar um número e apresentá-lo como previsão. */}
      {focoSemana > 0 && (
        <section className="superficie flex flex-wrap items-center justify-between gap-6 p-7">
          <div className="flex flex-col gap-1">
            <h2 className="text-[1.15rem] font-bold text-ink">
              No seu ritmo atual
            </h2>
            <p className="max-w-[58ch] text-[0.94rem] text-body">
              Mantendo a média dos últimos 7 dias, você acumula{" "}
              <strong className="font-semibold text-brand-700">
                cerca de {Math.round(projecao / 60)} horas
              </strong>{" "}
              de estudo até o dia da prova — {dias}{" "}
              {dias === 1 ? "dia" : "dias"} a {mediaDiaria} minutos.
            </p>
          </div>
          <BotaoFoco variante="cabecalho" />
        </section>
      )}

      {comecou && (
        <dl className="grid gap-4 sm:grid-cols-3">
          {[
            [respondidas.toLocaleString("pt-BR"), "questões respondidas", `de ${acervo.toLocaleString("pt-BR")} no acervo`],
            [`${taxa}%`, "de acerto", `${acertos.toLocaleString("pt-BR")} certas`],
            [(respondidas - acertos).toLocaleString("pt-BR"), "no caderno de erros", "registradas sozinhas"],
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
      )}

      <section className="flex flex-col gap-4">
        <h2 className="text-[1.3rem] font-bold text-ink">Ações rápidas</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <BotaoFoco variante="cartao" />
          {ATALHOS.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="superficie group flex flex-col gap-2 p-6 transition-colors hover:border-brand-200"
            >
              <span className="flex items-center gap-2 font-semibold text-ink">
                {a.titulo}
                <span className="text-brand-500 opacity-45 transition-opacity group-hover:opacity-100">
                  →
                </span>
              </span>
              <span className="text-[0.92rem] text-muted">{a.texto}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Estado do plano em faixa, no fim e na mesma superfície do resto.
          Um plano escuro no meio do painel rouba a atenção de quem já entrou
          — a pessoa veio estudar, não comprar. */}
      <section className="superficie flex flex-wrap items-center justify-between gap-5 p-6">
        {assinatura ? (
          <>
            <div className="flex flex-col gap-0.5">
              <span className="flex items-center gap-2 text-[0.94rem] font-semibold text-ink">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                Plano ativo · {assinatura.plano}
              </span>
              <span className="text-[0.9rem] text-muted">
                Válido até {formatarData(String(assinatura.fim).slice(0, 10))}
              </span>
            </div>
            <Link
              href="/app/estudar"
              className="rounded-full bg-brand-600 px-5 py-2.5 text-[0.92rem] font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Estudar agora
            </Link>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-0.5">
              <span className="flex items-center gap-2 text-[0.94rem] font-semibold text-ink">
                <span className="h-1.5 w-1.5 rounded-full bg-ouro-400" />
                {acervo.toLocaleString("pt-BR")} questões de {ingeridos.length}{" "}
                exames, liberadas pelo plano
              </span>
              <span className="text-[0.9rem] text-muted">
                O checkout ainda não está ativo — nada é cobrado hoje.
              </span>
            </div>
            <Link
              href="/precos"
              className="rounded-full border border-hairline bg-surface px-5 py-2.5 text-[0.92rem] font-semibold text-ink transition-colors hover:border-brand-300 hover:text-brand-700"
            >
              Ver planos
            </Link>
          </>
        )}
      </section>
    </div>
  );
}
