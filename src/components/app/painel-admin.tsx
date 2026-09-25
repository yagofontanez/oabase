"use client";

import { useCallback, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/browser";
import { formatarData } from "@/lib/format";

export type Metricas = Record<string, number | null>;

export type UsuarioAdmin = {
  user_id: string;
  email: string;
  nome: string;
  criado_em: string;
  confirmado: boolean;
  plano: string | null;
  plano_ate: string | null;
  respostas: number;
  acertos: number;
  ultimo_estudo: string | null;
};

export type DiaDeAtividade = {
  dia: string;
  respostas: number;
  pessoas: number;
};

export type LinhaDeDisciplina = {
  nome: string;
  respostas: number;
  acertos: number;
};

type InteressePorCarreira = {
  carreira: string;
  inscricoes: number;
};

type InteresseRecente = {
  email: string;
  carreira: string;
  criado_em: string;
};

export type PainelConcursos = {
  total?: number;
  ultimos_7d?: number;
  por_carreira?: InteressePorCarreira[];
  recentes?: InteresseRecente[];
};

const nomesDasCarreiras: Record<string, string> = {
  tribunais: "Tribunais",
  procuradorias: "Procuradorias",
  "defensoria-publica": "Defensoria Pública",
  "ministerio-publico": "Ministério Público",
  "delegado-de-policia": "Delegado de Polícia",
  "ainda-nao-sei": "Ainda decidindo",
};

const dinheiro = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Painel de operação.
 *
 * Números primeiro, pessoas depois — nessa ordem porque é a ordem das
 * perguntas: "como está o produto" antes de "quem é fulano". A busca de
 * usuário roda no banco, não no navegador: com a base crescendo, filtrar uma
 * lista já baixada seria baixar a lista inteira para sempre.
 */
export function PainelAdmin({
  metricas,
  funil,
  concursos,
  usuariosIniciais,
  atividade,
  disciplinas,
}: {
  metricas: Metricas;
  funil: Metricas;
  concursos: PainelConcursos;
  usuariosIniciais: UsuarioAdmin[];
  atividade: DiaDeAtividade[];
  disciplinas: LinhaDeDisciplina[];
}) {
  const [usuarios, setUsuarios] = useState(usuariosIniciais);
  const [busca, setBusca] = useState("");
  const [buscando, setBuscando] = useState(false);

  const procurar = useCallback(async () => {
    setBuscando(true);
    const { data } = await supabaseNavegador().rpc("usuarios_admin", {
      p_busca: busca.trim() || null,
      p_limite: 100,
    });
    setUsuarios((data ?? []) as UsuarioAdmin[]);
    setBuscando(false);
  }, [busca]);

  const n = (chave: string) => Number(metricas[chave] ?? 0);
  const f = (chave: string) => Number(funil[chave] ?? 0);
  const picoDeAtividade = Math.max(1, ...atividade.map((d) => d.respostas));
  const baseFunil = Math.max(1, f("contas"));
  const interessesPorCarreira = Array.isArray(concursos.por_carreira)
    ? concursos.por_carreira
    : [];
  const interessesRecentes = Array.isArray(concursos.recentes)
    ? concursos.recentes
    : [];
  const etapasDoFunil = [
    ["Conta criada", f("contas"), f("contas")],
    ["E-mail confirmado", f("confirmadas"), f("contas")],
    ["Plano criado", f("planos_criados"), f("contas")],
    ["Primeiro estudo", f("primeiro_estudo"), f("contas")],
    ["20 questões", f("vinte_questoes"), f("contas")],
    ["Compra confirmada", f("compradores"), f("contas")],
  ] as const;

  const blocos: { titulo: string; itens: [string, string, string][] }[] = [
    {
      titulo: "Pessoas",
      itens: [
        ["Contas", n("contas").toLocaleString("pt-BR"), "desde o início"],
        ["Novas em 7 dias", n("contas_7d").toLocaleString("pt-BR"), "cadastros recentes"],
        [
          "E-mail confirmado",
          n("contas_confirmadas").toLocaleString("pt-BR"),
          `${n("contas") ? Math.round((n("contas_confirmadas") / n("contas")) * 100) : 0}% das contas`,
        ],
        [
          "Planos ativos",
          n("assinaturas_ativas").toLocaleString("pt-BR"),
          `${n("assinaturas_cortesia")} de cortesia`,
        ],
      ],
    },
    {
      titulo: "Dinheiro",
      itens: [
        ["Receita confirmada", dinheiro(n("receita_total")), "só ambiente de produção"],
        ["Últimos 30 dias", dinheiro(n("receita_30d")), "cobranças confirmadas"],
        [
          "Cobranças pendentes",
          n("cobrancas_pendentes").toLocaleString("pt-BR"),
          "aguardando pagamento",
        ],
        [
          "Conversão",
          `${n("contas") ? Math.round((n("assinaturas_ativas") / n("contas")) * 100) : 0}%`,
          "planos ativos por conta",
        ],
      ],
    },
    {
      titulo: "Estudo",
      itens: [
        ["Respostas", n("respostas").toLocaleString("pt-BR"), "total registrado"],
        ["Em 7 dias", n("respostas_7d").toLocaleString("pt-BR"), "atividade recente"],
        [
          "Taxa de acerto",
          metricas.taxa_acerto === null ? "—" : `${n("taxa_acerto")}%`,
          "primeira tentativa de cada pessoa",
        ],
        [
          "Simulados",
          `${n("simulados_finalizados")}/${n("simulados")}`,
          "finalizados de iniciados",
        ],
      ],
    },
    {
      titulo: "Acervo",
      itens: [
        ["Questões", n("acervo_questoes").toLocaleString("pt-BR"), "de provas reais"],
        [
          "Questões já tocadas",
          n("questoes_distintas").toLocaleString("pt-BR"),
          "distintas, por qualquer pessoa",
        ],
        ["Artigos", n("acervo_artigos").toLocaleString("pt-BR"), `${n("acervo_comentados")} comentados`],
        ["Súmulas", n("acervo_sumulas").toLocaleString("pt-BR"), "STF"],
      ],
    },
  ];

  return (
    <div className="painel-conteudo flex max-w-[1280px] flex-col gap-8">
      <header className="flex max-w-[58ch] flex-col gap-2">
        <h1 className="text-[clamp(1.75rem,3vw,2.15rem)] leading-[1.08] font-extrabold tracking-[-0.035em] text-ink">
          Administração
        </h1>
        <p className="text-body">
          O estado do produto num lugar só. Receita conta apenas cobrança
          confirmada em produção — sandbox não vira faturamento.
        </p>
      </header>

      {blocos.map((bloco) => (
        <section key={bloco.titulo} className="flex flex-col gap-3">
          <h2 className="text-[0.86rem] font-semibold text-muted">
            {bloco.titulo}
          </h2>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {bloco.itens.map(([rotulo, valor, nota]) => (
              <div
                key={rotulo}
                className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-5"
              >
                <dt className="text-[0.84rem] font-semibold text-muted">
                  {rotulo}
                </dt>
                <dd className="text-[1.7rem] leading-none font-bold tracking-[-0.02em] text-ink tabular-nums">
                  {valor}
                </dd>
                <dd className="text-[0.8rem] text-muted">{nota}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-[0.86rem] font-semibold text-muted">
            Concursos jurídicos
          </h2>
          <p className="mt-1 text-[0.8rem] text-muted">
            Interesse registrado na landing pública — ainda não é conta nem intenção de compra.
          </p>
        </div>

        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-5">
            <dt className="text-[0.84rem] font-semibold text-muted">Na lista</dt>
            <dd className="text-[1.7rem] leading-none font-bold tracking-[-0.02em] text-ink tabular-nums">
              {Number(concursos.total ?? 0).toLocaleString("pt-BR")}
            </dd>
            <dd className="text-[0.8rem] text-muted">inscrições únicas</dd>
          </div>
          <div className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-5">
            <dt className="text-[0.84rem] font-semibold text-muted">Últimos 7 dias</dt>
            <dd className="text-[1.7rem] leading-none font-bold tracking-[-0.02em] text-ink tabular-nums">
              {Number(concursos.ultimos_7d ?? 0).toLocaleString("pt-BR")}
            </dd>
            <dd className="text-[0.8rem] text-muted">novas inscrições</dd>
          </div>
        </dl>

        {interessesPorCarreira.length > 0 ? (
          <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {interessesPorCarreira.map((item) => (
              <li
                key={item.carreira}
                className="flex items-center justify-between gap-4 px-5 py-3 text-[0.9rem]"
              >
                <span className="text-ink">
                  {nomesDasCarreiras[item.carreira] ?? item.carreira}
                </span>
                <span className="text-muted tabular-nums">
                  {item.inscricoes.toLocaleString("pt-BR")}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-hairline px-5 py-6 text-[0.9rem] text-muted">
            A lista ainda não recebeu inscrições.
          </p>
        )}

        {interessesRecentes.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
            <table className="w-full min-w-[520px] border-collapse text-[0.9rem]">
              <thead>
                <tr className="bg-sunk text-left">
                  {['E-mail', 'Carreira', 'Entrou'].map((coluna) => (
                    <th
                      key={coluna}
                      className="px-5 py-3 text-[0.8rem] font-semibold text-muted"
                    >
                      {coluna}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {interessesRecentes.map((interesse) => (
                  <tr key={interesse.email} className="border-t border-line">
                    <td className="px-5 py-3 break-all text-ink">{interesse.email}</td>
                    <td className="px-5 py-3 text-body">
                      {nomesDasCarreiras[interesse.carreira] ?? interesse.carreira}
                    </td>
                    <td className="px-5 py-3 text-muted tabular-nums">
                      {formatarData(interesse.criado_em.slice(0, 10))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[0.86rem] font-semibold text-muted">
              Funil de ativação
            </h2>
            <p className="mt-1 text-[0.8rem] text-muted">
              Marcos derivados de ações salvas — sem rastreamento de páginas.
            </p>
          </div>
          <span className="text-[0.82rem] text-muted tabular-nums">
            Retorno D7: {f("retorno_d7")}/{f("elegiveis_d7")} · {f("elegiveis_d7") ? Math.round((f("retorno_d7") / f("elegiveis_d7")) * 100) : 0}%
          </span>
        </div>
        <ol className="superficie grid gap-px overflow-hidden bg-line sm:grid-cols-2 xl:grid-cols-6">
          {etapasDoFunil.map(([rotulo, valor, base]) => {
            const percentual = base ? Math.round((valor / base) * 100) : 0;
            return (
              <li key={rotulo} className="flex flex-col gap-3 bg-surface p-5">
                <span className="text-[0.8rem] font-semibold text-muted">{rotulo}</span>
                <span className="text-[1.6rem] leading-none font-bold text-ink tabular-nums">
                  {valor.toLocaleString("pt-BR")}
                </span>
                <span className="h-1.5 overflow-hidden rounded-full bg-sunk">
                  <span
                    className="block h-full rounded-full bg-brand-500"
                    style={{ width: `${Math.min(100, (valor / baseFunil) * 100)}%` }}
                  />
                </span>
                <span className="text-[0.76rem] text-muted tabular-nums">
                  {percentual}% das contas
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Atividade por dia. Barra simples em vez de biblioteca de gráfico:
          são trinta valores e a pergunta é "está subindo ou caindo". */}
      <section className="flex flex-col gap-3">
        <h2 className="text-[0.86rem] font-semibold text-muted">
          Respostas por dia · 30 dias
        </h2>
        <div className="flex items-end gap-1 rounded-2xl border border-line bg-surface p-5">
          {atividade.map((d) => (
            <span
              key={d.dia}
              title={`${formatarData(d.dia)} · ${d.respostas} respostas · ${d.pessoas} pessoas`}
              className="flex-1 rounded-t-[3px] bg-brand-400"
              style={{
                height: `${Math.max(2, (d.respostas / picoDeAtividade) * 120)}px`,
              }}
            />
          ))}
        </div>
      </section>

      {disciplinas.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-[0.86rem] font-semibold text-muted">
            Onde as pessoas estão respondendo
          </h2>
          <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {disciplinas.map((d) => (
              <li
                key={d.nome}
                className="flex items-center justify-between gap-4 px-5 py-3 text-[0.9rem]"
              >
                <span className="text-ink">{d.nome}</span>
                <span className="text-muted tabular-nums">
                  {d.respostas} respostas ·{" "}
                  {Math.round((d.acertos / Math.max(1, d.respostas)) * 100)}% de
                  acerto
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-[0.86rem] font-semibold text-muted">Pessoas</h2>
          <div className="flex gap-2">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void procurar();
              }}
              placeholder="e-mail ou nome"
              className="rounded-[12px] border border-line bg-surface px-4 py-2 text-[0.9rem] text-ink outline-none focus:border-brand-400"
            />
            <button
              type="button"
              onClick={() => void procurar()}
              disabled={buscando}
              className="rounded-[12px] bg-brand-600 px-4 py-2 text-[0.9rem] font-semibold text-white transition-colors hover:bg-brand-700 disabled:bg-brand-200"
            >
              Buscar
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[720px] border-collapse text-[0.9rem]">
            <thead>
              <tr className="bg-sunk text-left">
                {["Pessoa", "Entrou", "Plano", "Estudo", "Último estudo"].map(
                  (c) => (
                    <th
                      key={c}
                      className="px-5 py-3 text-[0.8rem] font-semibold text-muted"
                    >
                      {c}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.user_id} className="border-t border-line">
                  <td className="px-5 py-3">
                    <span className="flex flex-col">
                      <span className="text-ink">{u.nome || "—"}</span>
                      <span className="text-[0.82rem] break-all text-muted">
                        {u.email}
                        {!u.confirmado && " · não confirmado"}
                      </span>
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted tabular-nums">
                    {formatarData(u.criado_em.slice(0, 10))}
                  </td>
                  <td className="px-5 py-3">
                    {u.plano ? (
                      <span className="flex flex-col">
                        <span className="font-semibold text-brand-700">
                          {u.plano}
                        </span>
                        {u.plano_ate && (
                          <span className="text-[0.8rem] text-muted tabular-nums">
                            até {formatarData(u.plano_ate.slice(0, 10))}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted">sem plano</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-muted tabular-nums">
                    {u.respostas > 0
                      ? `${u.respostas} · ${Math.round((u.acertos / u.respostas) * 100)}%`
                      : "—"}
                  </td>
                  <td className="px-5 py-3 text-muted tabular-nums">
                    {u.ultimo_estudo
                      ? formatarData(u.ultimo_estudo.slice(0, 10))
                      : "—"}
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
