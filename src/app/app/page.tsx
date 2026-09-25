import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BotaoFoco } from "@/components/app/botao-foco";
import { Contagem } from "@/components/contagem";
import { formatarData } from "@/lib/format";
import { supabaseServidor, usuarioAtual } from "@/lib/supabase/servidor";
import {
  diasAte,
  getArtigosIndexaveis,
  getDisciplinas,
  getExames,
  getLeis,
  getProximoExame,
} from "@/lib/content/queries";
import type { Plano } from "@/lib/ia/plano";

export const metadata: Metadata = {
  title: "Painel",
  robots: { index: false, follow: false },
};

/** Exames já aplicados pela FGV — o denominador da cobertura do acervo. */
const EXAMES_APLICADOS = 46;

/** Classes estáticas: Tailwind não vê nome de classe montado em tempo de execução. */
const COLUNAS: Record<number, string> = {
  3: "sm:grid-cols-3",
  6: "sm:grid-cols-3 xl:grid-cols-6",
};

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

function descricao(minutos: number) {
  if (minutos === 0) return "sem foco";
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

function horasDoPlano(h: number) {
  return h % 1 === 0 ? `${h}h` : `${Math.floor(h)}h${(h % 1) * 60}`;
}

/** Saudação pela hora de Brasília — perto o bastante para o público daqui. */
function saudacao() {
  const h = Number(
    new Date().toLocaleString("pt-BR", {
      hour: "2-digit",
      hour12: false,
      timeZone: "America/Sao_Paulo",
    }),
  );
  if (h < 5) return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

/** Cabeçalho de cartão: rótulo à esquerda, contexto à direita, mesma linha. */
function TituloDoCartao({
  rotulo,
  meta,
}: {
  rotulo: string;
  meta?: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <span className="rotulo">{rotulo}</span>
      {meta && <span className="text-[0.8rem] text-muted">{meta}</span>}
    </div>
  );
}

export default async function PainelPage() {
  const [usuario, proximo, exames, disciplinas, artigos, leis] =
    await Promise.all([
      usuarioAtual(),
      getProximoExame(),
      getExames(),
      getDisciplinas(),
      getArtigosIndexaveis(),
      getLeis(),
    ]);

  const supabase = await supabaseServidor();
  const agora = new Date();
  const hojeISO = diaLocal(agora);

  // 34 dias cobrem a série de 14 e ainda sobram dias para a sequência.
  const desde = new Date(agora);
  desde.setDate(desde.getDate() - 34);

  // Todas as consultas passam por RLS: `respostas`, `assinaturas`,
  // `sessoes_foco` e `planos_estudo` filtram por dono. Uma sessão só enxerga
  // o que é dela, sem nenhum filtro escrito aqui.
  const [assinaturaRes, desempenhoRes, focoRes, planoRes] = await Promise.all([
    supabase
      .from("assinaturas")
      .select("plano, fim")
      .eq("status", "ativa")
      .order("fim", { ascending: false })
      .limit(1),
    // Conta por questão, não por tentativa: quem errou três vezes e acertou
    // na quarta tem uma questão dominada, não três erros. `distinct on` vive
    // no banco porque o PostgREST não sabe expressar essa consulta.
    supabase.rpc("meu_desempenho"),
    supabase
      .from("sessoes_foco")
      .select("minutos, concluido_em, disciplinas(nome)")
      .gte("concluido_em", desde.toISOString())
      .order("concluido_em", { ascending: false }),
    supabase.from("planos_estudo").select("plano").maybeSingle(),
  ]);

  const temAssinatura = Boolean(assinaturaRes.data?.[0]);
  const desempenho = (Array.isArray(desempenhoRes.data)
    ? desempenhoRes.data[0]
    : desempenhoRes.data) as
    | {
        respondidas: number;
        acertos: number;
        erros: number;
        revisao_hoje: number;
      }
    | undefined;
  const respondidas = desempenho?.respondidas ?? 0;
  const acertos = desempenho?.acertos ?? 0;
  const erros = desempenho?.erros ?? 0;
  const revisaoHoje = desempenho?.revisao_hoje ?? 0;
  const comecou = respondidas > 0;
  const planoDeEstudos = (planoRes.data?.plano as Plano | null) ?? null;

  // A primeira sessão não começa em um painel cheio de caminhos. Quem ainda
  // não tem plano entra direto nas três decisões que geram o primeiro bloco;
  // é gratuito e acontece antes de qualquer oferta de assinatura.
  if (!planoDeEstudos) {
    redirect("/app/plano");
  }
  const semana = planoDeEstudos?.semanas?.[0] ?? null;

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

  const serie = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(agora);
    d.setDate(d.getDate() - (13 - i));
    const chave = diaLocal(d);
    return {
      dia: chave,
      rotulo: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
      minutos: porDia.get(chave) ?? 0,
    };
  });
  const maximo = Math.max(30, ...serie.map((d) => d.minutos));

  const focoHoje = porDia.get(hojeISO) ?? 0;
  const focoSemana = serie.slice(7).reduce((s, d) => s + d.minutos, 0);
  const temFoco = sessoes.length > 0;

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

  const focoPorDisciplina = [...porDisciplina.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const maiorFoco = focoPorDisciplina[0]?.[1] ?? 1;

  const dias = diasAte(proximo.data);
  const ingeridos = exames.filter((e) => e.questoesCarregadas > 0);
  const acervo = ingeridos.reduce((s, e) => s + e.questoesCarregadas, 0);
  const cobertura = Math.round((ingeridos.length / EXAMES_APLICADOS) * 100);
  const mediaDiaria = Math.round(focoSemana / 7);

  // A "porta de entrada" de cada disciplina sai do próprio acervo: o artigo
  // mais cobrado que já tem comentário publicado. Nada é escolhido à mão.
  const siglaPorLei = new Map(leis.map((l) => [l.slug, l.sigla]));
  const portaDeEntrada = new Map<string, (typeof artigos)[number]>();
  for (const artigo of artigos) {
    const atual = portaDeEntrada.get(artigo.disciplinaSlug);
    if (!atual || artigo.incidencia > atual.incidencia) {
      portaDeEntrada.set(artigo.disciplinaSlug, artigo);
    }
  }

  const maiorPeso = disciplinas[0]?.mediaPorProva ?? 1;
  const maisCobradas = disciplinas.slice(0, 6);

  const nome =
    (usuario?.user_metadata?.nome as string | undefined)?.split(" ")[0] ??
    usuario?.email?.split("@")[0] ??
    "você";

  const numeros: { valor: string; rotulo: string }[] = [
    { valor: horas(focoHoje), rotulo: "de foco hoje" },
    { valor: horas(focoSemana), rotulo: "em 7 dias" },
    {
      valor: String(sequencia),
      rotulo: sequencia === 1 ? "dia seguido" : "dias seguidos",
    },
  ];
  if (comecou) {
    numeros.push(
      {
        valor: respondidas.toLocaleString("pt-BR"),
        rotulo: "questões respondidas",
      },
      {
        valor: `${Math.round((acertos / respondidas) * 100)}%`,
        rotulo: "de acerto",
      },
      {
        valor: erros.toLocaleString("pt-BR"),
        rotulo: "no caderno de erros",
      },
    );
  }

  /* O próximo passo é escolhido, não listado. Uma grade de atalhos de mesmo
     peso empurra a decisão de volta para quem abriu o painel justamente sem
     saber o que fazer — e a navegação já está no trilho, à esquerda. */
  const passo = !planoDeEstudos
    ? {
        titulo: "Monte seu primeiro plano",
        texto: `Diga para qual prova estuda e quanto tempo cabe no seu dia. O primeiro bloco sai pronto antes de você escolher uma assinatura.`,
        acao: "Criar meu plano",
        href: "/app/plano",
      }
    : !temAssinatura
      ? {
          titulo: "Leve o plano para a prática",
          texto: `${acervo.toLocaleString("pt-BR")} questões reais de ${ingeridos.length} exames, com gabarito oficial da FGV. Seu roadmap continua guardado mesmo antes da assinatura.`,
          acao: "Experimentar por R$ 1",
          href: "/app/assinar?plano=experimentar",
        }
      : revisaoHoje > 0
      ? {
          titulo: `${revisaoHoje} ${revisaoHoje === 1 ? "questão marcada" : "questões marcadas"} para revisar hoje`,
          texto:
            "A repetição espaçada agendou estas para hoje. Rever no dia certo é o que separa saber de ter visto uma vez.",
          acao: "Abrir sessão de hoje",
          href: "/app/hoje",
        }
      : !comecou
          ? {
              titulo: "Responda a primeira questão",
              texto: `${acervo.toLocaleString("pt-BR")} questões reais estão liberadas. A taxa de acerto, o caderno de erros e a fila de revisão nascem da primeira resposta.`,
              acao: "Começar sessão de hoje",
              href: "/app/hoje",
            }
          : focoHoje === 0
            ? {
                titulo: "Ainda não houve foco hoje",
                texto:
                  sequencia > 0
                    ? `Você tem ${sequencia} ${sequencia === 1 ? "dia seguido" : "dias seguidos"} de estudo. Um bloco de 25 minutos mantém a sequência viva.`
                    : "Um bloco de 25 minutos entra na série e passa a alimentar a média até a prova.",
                acao: "Abrir sessão de hoje",
                href: "/app/hoje",
              }
            : {
                titulo: `${horas(focoHoje)} de foco hoje`,
                texto:
                  erros > 0
                    ? `Ritmo mantido. Há ${erros} ${erros === 1 ? "questão" : "questões"} no caderno de erros esperando uma segunda tentativa.`
                    : "Ritmo mantido. Siga pelo cronograma da semana ou resolva mais questões.",
                acao: "Continuar pela sessão de hoje",
                href: "/app/hoje",
              };

  return (
    <div className="painel-conteudo flex max-w-[1220px] flex-col gap-5">
      {/* A contagem é a única coisa que merece peso tipográfico aqui, e cabe
          na mesma linha da saudação — não precisava de um cartão só para si. */}
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 border-b border-line pb-5">
        <div className="flex flex-col gap-1">
          <h1 className="text-[clamp(1.6rem,2.6vw,1.95rem)] leading-[1.1] font-extrabold tracking-[-0.035em] text-ink">
            {saudacao()}, {nome}
          </h1>
          <p className="text-[0.96rem] text-muted">
            A 1ª fase do {proximo.edicao}º Exame é em{" "}
            {formatarData(proximo.data, {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
            .
          </p>
        </div>

        <div className="flex flex-col gap-0.5 sm:items-end">
          <span className="flex items-baseline gap-2">
            <span className="text-[2.4rem] leading-none font-extrabold tracking-[-0.045em] text-brand-700 tabular-nums">
              {dias}
            </span>
            <span className="text-[0.96rem] font-semibold text-ink">
              {dias === 1 ? "dia" : "dias"} até a prova
            </span>
          </span>
          <span className="text-[0.82rem] text-muted tabular-nums">
            <Contagem dataISO={proximo.data} dias={dias} />
          </span>
        </div>
      </header>

      <section className="superficie flex flex-wrap items-center justify-between gap-x-8 gap-y-4 p-6">
        <div className="flex max-w-[62ch] flex-col gap-1">
          <span className="rotulo">Próximo passo</span>
          <h2 className="text-[1.12rem] font-bold text-ink">{passo.titulo}</h2>
          <p className="text-[0.93rem] text-body">{passo.texto}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {passo.href && passo.acao ? (
            <Link
              href={passo.href}
              className="rounded-full bg-brand-600 px-5 py-2.5 text-[0.92rem] font-semibold text-white transition-colors hover:bg-brand-700"
            >
              {passo.acao}
            </Link>
          ) : null}
          <BotaoFoco variante="acao" />
        </div>
      </section>

      <dl
        className={`superficie grid grid-cols-2 gap-x-6 gap-y-5 px-7 py-6 ${COLUNAS[numeros.length]}`}
      >
        {numeros.map((n) => (
          <div key={n.rotulo} className="flex flex-col gap-0.5">
            <dd className="text-[1.65rem] leading-none font-extrabold tracking-[-0.04em] text-brand-700 tabular-nums">
              {n.valor}
            </dd>
            <dt className="text-[0.86rem] text-muted">{n.rotulo}</dt>
          </div>
        ))}
      </dl>

      {/* `grid-cols-1` explícito: sem ele a coluna implícita é dimensionada
          por `max-content`, e uma linha com `truncate` (nowrap) estoura a
          largura da tela no celular em vez de ser cortada. */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.15fr_1fr]">
        {/* ---- A semana do cronograma ---- */}
        <section className="superficie flex flex-col gap-4 p-6">
          <TituloDoCartao
            rotulo="Sua semana"
            meta={
              semana
                ? `Semana ${semana.numero} · ${horasDoPlano(
                    semana.blocos.reduce((s, b) => s + b.horas, 0),
                  )}`
                : undefined
            }
          />

          {semana ? (
            <>
              <p className="text-[1rem] font-bold text-ink">{semana.foco}</p>
              <ul className="flex flex-col divide-y divide-line">
                {semana.blocos.slice(0, 4).map((bloco, i) => (
                  <li
                    key={`${bloco.disciplina}-${i}`}
                    className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0"
                  >
                    {/* `min-w-0` sozinho não basta: sem `flex-1` o item de
                        flex se dimensiona pelo conteúdo e o `truncate` nunca
                        entra — a linha estoura a largura do celular. */}
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[0.93rem] font-semibold text-ink">
                        {bloco.disciplina}
                      </span>
                      <span className="truncate text-[0.85rem] text-muted">
                        {bloco.objetivo}
                      </span>
                    </span>
                    <span className="shrink-0 text-[0.86rem] font-semibold text-brand-700 tabular-nums">
                      {horasDoPlano(bloco.horas)}
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                href="/app/plano"
                className="mt-auto self-start text-[0.88rem] font-semibold text-brand-600 underline decoration-brand-200 underline-offset-4 transition-colors hover:decoration-brand-500"
              >
                {semana.blocos.length > 4
                  ? `Ver os outros ${semana.blocos.length - 4} blocos e as semanas seguintes →`
                  : "Abrir o cronograma completo →"}
              </Link>
            </>
          ) : (
            <>
              <p className="max-w-[48ch] text-[0.93rem] text-body">
                O cronograma distribui as horas que você tem entre as
                disciplinas que mais caem, no tempo que falta — e mostra aqui a
                semana atual.
              </p>
              <Link
                href="/app/plano"
                className="mt-auto self-start text-[0.88rem] font-semibold text-brand-600 underline decoration-brand-200 underline-offset-4 transition-colors hover:decoration-brand-500"
              >
                Montar em uma frase →
              </Link>
            </>
          )}
        </section>

        {/* ---- Foco: série e distribuição ---- */}
        <section className="superficie flex flex-col gap-4 p-6">
          <TituloDoCartao
            rotulo="Foco"
            meta={
              temFoco ? `média de ${mediaDiaria} min/dia` : "últimos 14 dias"
            }
          />

          <div className="flex flex-col gap-1.5">
            <div className="flex h-12 items-end gap-[3px] border-b border-hairline">
              {serie.map((d, i) => {
                const hoje = i === serie.length - 1;
                return (
                  <span
                    key={d.dia}
                    title={`${d.rotulo}: ${descricao(d.minutos)}`}
                    // Âmbar significa agora — no botão de foco e aqui. O resto
                    // da série fica em verde para a cor quente continuar
                    // querendo dizer uma coisa só.
                    className={`flex-1 rounded-t-[2px] ${
                      d.minutos === 0
                        ? "bg-sunk"
                        : hoje
                          ? "bg-ouro-400"
                          : "bg-brand-300"
                    }`}
                    style={{
                      height:
                        d.minutos === 0
                          ? "3px"
                          : `${Math.max((d.minutos / maximo) * 100, 10)}%`,
                    }}
                  />
                );
              })}
            </div>
            <div className="flex items-baseline justify-between text-[0.75rem]">
              <span className="text-muted">14 dias atrás</span>
              <span className="font-semibold text-ouro-600">hoje</span>
            </div>
          </div>

          {/* `mt-auto`: os dois cartões da linha têm a mesma altura, então a
              parte de baixo deste ancora no rodapé em vez de deixar um vão
              solto embaixo quando o cronograma ao lado é mais comprido. */}
          {focoPorDisciplina.length > 0 ? (
            <ul className="mt-auto flex flex-col gap-2.5 border-t border-line pt-4">
              {focoPorDisciplina.map(([nomeDisciplina, minutos]) => (
                <li key={nomeDisciplina} className="flex flex-col gap-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 flex-1 truncate text-[0.9rem] text-body">
                      {nomeDisciplina}
                    </span>
                    <span className="shrink-0 text-[0.85rem] font-semibold text-ink tabular-nums">
                      {horas(minutos)}
                    </span>
                  </span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-sunk">
                    <span
                      className="block h-full rounded-full bg-brand-400"
                      style={{ width: `${(minutos / maiorFoco) * 100}%` }}
                    />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-auto border-t border-line pt-4 text-[0.9rem] text-muted">
              O widget de foco tem um seletor de disciplina — é ele que separa o
              tempo por matéria aqui.
            </p>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.15fr_1fr]">
        {/* ---- O que mais cai ---- */}
        <section className="superficie flex flex-col gap-4 p-6">
          <TituloDoCartao
            rotulo="O que mais cai"
            meta={`média em ${exames.length} exames`}
          />

          <ul className="flex flex-col divide-y divide-line">
            {maisCobradas.map((d) => {
              const artigo = portaDeEntrada.get(d.slug);
              return (
                <li
                  key={d.slug}
                  className="flex flex-col gap-1.5 py-2.5 first:pt-0"
                >
                  {/* Nome, atalho e número na mesma linha de base, com o
                      número em coluna fixa: é o que faz os valores se lerem
                      de cima para baixo em vez de dançar com o texto. */}
                  <span className="flex items-baseline gap-3">
                    <span className="min-w-0 flex-1 truncate text-[0.92rem] text-body">
                      {d.nome}
                    </span>
                    {artigo && (
                      <Link
                        href={`/legislacao/${artigo.leiSlug}/${artigo.slug}`}
                        className="shrink-0 rounded-full bg-brand-50 px-2.5 py-0.5 text-[0.8rem] font-semibold whitespace-nowrap text-brand-700 transition-colors hover:bg-brand-100"
                      >
                        art. {artigo.numero} {siglaPorLei.get(artigo.leiSlug)} →
                      </Link>
                    )}
                    <span className="w-8 shrink-0 text-right text-[0.85rem] font-semibold text-ink tabular-nums">
                      {d.mediaPorProva}q
                    </span>
                  </span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-sunk">
                    <span
                      className="block h-full rounded-full bg-brand-400"
                      style={{
                        width: `${(d.mediaPorProva / maiorPeso) * 100}%`,
                      }}
                    />
                  </span>
                </li>
              );
            })}
          </ul>

          <Link
            href="/app/estudar"
            className="mt-auto self-start text-[0.88rem] font-semibold text-brand-600 underline decoration-brand-200 underline-offset-4 transition-colors hover:decoration-brand-500"
          >
            Ver as {disciplinas.length} disciplinas por peso →
          </Link>
        </section>

        {/* ---- O acervo ---- */}
        <section className="superficie flex flex-col gap-4 p-6">
          <TituloDoCartao
            rotulo="O acervo"
            meta="cadernos oficiais da FGV"
          />

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-[0.95rem] font-semibold text-ink">
                {acervo.toLocaleString("pt-BR")} questões ·{" "}
                {ingeridos.length} de {EXAMES_APLICADOS} exames
              </span>
              <span className="text-[0.82rem] text-muted tabular-nums">
                {cobertura}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-sunk">
              <div
                className="h-full rounded-full bg-brand-500"
                style={{ width: `${cobertura}%` }}
              />
            </div>
          </div>

          <ul className="flex flex-col divide-y divide-line">
            {ingeridos.slice(0, 4).map((e) => (
              <li
                key={e.slug}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5"
              >
                <Link
                  href={`/exames/${e.slug}`}
                  className="shrink-0 text-[0.92rem] font-semibold text-ink transition-colors hover:text-brand-600"
                >
                  {e.edicao}º Exame
                </Link>
                <span className="shrink-0 text-[0.85rem] text-muted tabular-nums">
                  {formatarData(e.data)}
                </span>
                <span className="ml-auto shrink-0 text-[0.85rem] text-muted tabular-nums">
                  {e.questoesCarregadas}q
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[0.75rem] font-semibold ${
                    e.gabaritoDefinitivo
                      ? "bg-brand-50 text-brand-700"
                      : "bg-ouro-50 text-ouro-700"
                  }`}
                >
                  {e.gabaritoDefinitivo ? "definitivo" : "preliminar"}
                </span>
              </li>
            ))}
          </ul>

          <Link
            href="/app/desempenho"
            className="mt-auto self-start text-[0.88rem] font-semibold text-brand-600 underline decoration-brand-200 underline-offset-4 transition-colors hover:decoration-brand-500"
          >
            Ver o acervo inteiro e seus números →
          </Link>
        </section>
      </div>
    </div>
  );
}
