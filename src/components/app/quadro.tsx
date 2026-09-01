"use client";

import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { supabaseNavegador } from "@/lib/supabase/browser";

export type Cor = "neutra" | "esmeralda" | "ambar" | "ameixa";

export type QuestaoDisponivel = {
  id: string;
  numero: number;
  resumo: string;
  edicao: number;
  exameSlug: string;
  disciplina: string | null;
  acertou: boolean | null;
};

export type CartaoSalvo = {
  id: string;
  tipo: "nota" | "questao";
  questaoId: string | null;
  titulo: string;
  corpo: string;
  cor: Cor;
  x: number;
  y: number;
  largura: number;
  questao: QuestaoDisponivel | null;
};

export type LigacaoSalva = {
  id: string;
  origem: string;
  destino: string;
  rotulo: string;
};

/* ------------------------------------------------------------------ */

const CORES: Record<Cor, { cartao: string; alca: string; amostra: string }> = {
  neutra: {
    cartao: "bg-surface border-line",
    alca: "!bg-hairline",
    amostra: "bg-surface border-hairline",
  },
  esmeralda: {
    cartao: "bg-brand-50 border-brand-200",
    alca: "!bg-brand-300",
    amostra: "bg-brand-100 border-brand-300",
  },
  ambar: {
    cartao: "bg-ouro-50 border-ouro-200",
    alca: "!bg-ouro-400",
    amostra: "bg-ouro-100 border-ouro-400",
  },
  ameixa: {
    cartao: "bg-vinho-50 border-vinho-200",
    alca: "!bg-vinho-200",
    amostra: "bg-vinho-100 border-vinho-200",
  },
};

const ORDEM_DAS_CORES: Cor[] = ["neutra", "esmeralda", "ambar", "ameixa"];

type DadosDoCartao = {
  tipo: "nota" | "questao";
  titulo: string;
  corpo: string;
  cor: Cor;
  largura: number;
  questao: QuestaoDisponivel | null;
};

type NoDoQuadro = Node<DadosDoCartao>;

/**
 * Ações do quadro, por contexto.
 *
 * Guardar callbacks dentro de `data` do nó parece mais direto e é a origem
 * clássica de closure velha: o nó guarda a versão da função de quando foi
 * criado. Pelo contexto, o cartão sempre chama a atual.
 */
type AcoesDoQuadro = {
  editar: (id: string, campos: Partial<DadosDoCartao>) => void;
  remover: (id: string) => void;
};
const Acoes = createContext<AcoesDoQuadro>({
  editar: () => {},
  remover: () => {},
});

function BotaoRemover({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Remover do quadro"
      className="nodrag rounded-full p-1 text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:bg-vinho-50 hover:text-vinho-600"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        className="h-3.5 w-3.5"
        aria-hidden="true"
      >
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
      <span className="sr-only">Remover</span>
    </button>
  );
}

/** Pontos de conexão. Os quatro lados, para a ligação não dar volta na tela. */
function Alcas({ cor }: { cor: Cor }) {
  const estilo = `!h-2 !w-2 !border-0 ${CORES[cor].alca}`;
  return (
    <>
      <Handle type="target" position={Position.Top} className={estilo} />
      <Handle type="target" position={Position.Left} className={estilo} />
      <Handle type="source" position={Position.Right} className={estilo} />
      <Handle type="source" position={Position.Bottom} className={estilo} />
    </>
  );
}

/* ---------------------------- Cartão de nota ---------------------------- */

function CartaoDeNota({ id, data, selected }: NodeProps<NoDoQuadro>) {
  const { editar, remover } = useContext(Acoes);
  const cores = CORES[data.cor];

  return (
    <div
      style={{ width: data.largura }}
      className={`group flex flex-col gap-2 rounded-[14px] border p-3.5 shadow-[var(--shadow-baixa)] transition-shadow ${cores.cartao} ${
        selected ? "ring-2 ring-brand-400" : ""
      }`}
    >
      <Alcas cor={data.cor} />

      <div className="flex items-start gap-2">
        {/* `nodrag`: sem isso, selecionar texto arrasta o cartão. */}
        <input
          value={data.titulo}
          onChange={(e) => editar(id, { titulo: e.target.value })}
          placeholder="Título"
          className="nodrag min-w-0 flex-1 bg-transparent text-[0.94rem] font-bold text-ink outline-none placeholder:font-medium placeholder:text-muted"
        />
        <BotaoRemover onClick={() => remover(id)} />
      </div>

      <textarea
        value={data.corpo}
        onChange={(e) => editar(id, { corpo: e.target.value })}
        placeholder="Escreva aqui — o que confundiu, a regra, o macete."
        rows={4}
        className="nodrag nowheel w-full resize-none bg-transparent text-[0.86rem] leading-relaxed text-body outline-none placeholder:text-muted"
      />

      <div className="flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
        {ORDEM_DAS_CORES.map((cor) => (
          <button
            key={cor}
            type="button"
            onClick={() => editar(id, { cor })}
            title={cor}
            aria-pressed={data.cor === cor}
            className={`nodrag h-4 w-4 rounded-full border transition-transform ${CORES[cor].amostra} ${
              data.cor === cor ? "scale-110 ring-1 ring-ink/25" : ""
            }`}
          >
            <span className="sr-only">{cor}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* -------------------------- Cartão de questão --------------------------- */

function CartaoDeQuestao({ id, data, selected }: NodeProps<NoDoQuadro>) {
  const { editar, remover } = useContext(Acoes);
  const q = data.questao;
  const cores = CORES[data.cor];

  return (
    <div
      style={{ width: data.largura }}
      className={`group flex flex-col gap-2 rounded-[14px] border p-3.5 shadow-[var(--shadow-baixa)] ${cores.cartao} ${
        selected ? "ring-2 ring-brand-400" : ""
      }`}
    >
      <Alcas cor={data.cor} />

      <div className="flex items-start justify-between gap-2">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-[0.82rem] font-bold text-brand-700">
            {q ? `${q.edicao}º · questão ${q.numero}` : "questão removida"}
          </span>
          {q?.acertou === false && (
            <span className="rounded-full bg-vinho-100 px-1.5 py-0.5 text-[0.7rem] font-semibold text-vinho-600">
              errou
            </span>
          )}
          {q?.acertou === true && (
            <span className="rounded-full bg-brand-100 px-1.5 py-0.5 text-[0.7rem] font-semibold text-brand-700">
              acertou
            </span>
          )}
        </span>
        <BotaoRemover onClick={() => remover(id)} />
      </div>

      {q && (
        <>
          <p className="nowheel max-h-[8.5rem] overflow-y-auto text-[0.82rem] leading-relaxed text-body">
            {q.resumo}
            {q.resumo.length >= 220 ? "…" : ""}
          </p>
          <span className="text-[0.76rem] text-muted">
            {q.disciplina ?? "sem classificação"}
          </span>
        </>
      )}

      {/* A anotação sobre a questão vive no próprio cartão: separar em dois
          cartões ligados por uma linha seria trabalho sem ganho. */}
      <textarea
        value={data.corpo}
        onChange={(e) => editar(id, { corpo: e.target.value })}
        placeholder="Por que errei / o que aprendi"
        rows={2}
        className="nodrag nowheel w-full resize-none border-t border-line/70 bg-transparent pt-2 text-[0.82rem] leading-relaxed text-body outline-none placeholder:text-muted"
      />

      {q && (
        <Link
          href={`/exames/${q.exameSlug}`}
          className="nodrag self-start text-[0.78rem] font-semibold text-brand-600 underline decoration-brand-200 underline-offset-4"
        >
          Ver o exame →
        </Link>
      )}
    </div>
  );
}

const TIPOS_DE_NO = { nota: CartaoDeNota, questao: CartaoDeQuestao };

/* ------------------------------ O quadro -------------------------------- */

function QuadroInterno({
  cartoesIniciais,
  ligacoesIniciais,
  questoesDisponiveis,
  temPlano,
}: {
  cartoesIniciais: CartaoSalvo[];
  ligacoesIniciais: LigacaoSalva[];
  questoesDisponiveis: QuestaoDisponivel[];
  temPlano: boolean;
}) {
  const [nos, setNos, aoMudarNos] = useNodesState<NoDoQuadro>(
    cartoesIniciais.map((c) => ({
      id: c.id,
      type: c.tipo,
      position: { x: c.x, y: c.y },
      data: {
        tipo: c.tipo,
        titulo: c.titulo,
        corpo: c.corpo,
        cor: c.cor,
        largura: c.largura,
        questao: c.questao,
      },
    })),
  );
  const [ligacoes, setLigacoes, aoMudarLigacoes] = useEdgesState<Edge>(
    ligacoesIniciais.map((l) => ({
      id: l.id,
      source: l.origem,
      target: l.destino,
      label: l.rotulo || undefined,
    })),
  );

  const [disponiveis, setDisponiveis] = useState(questoesDisponiveis);
  const [seletorAberto, setSeletorAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const { screenToFlowPosition } = useReactFlow();
  const temporizadores = useRef<Map<string, number>>(new Map());
  const pendentes = useRef<Map<string, Partial<DadosDoCartao>>>(new Map());
  const criados = useRef(0);

  /** Manda para o banco o que estiver pendente de um cartão. */
  const gravarPendentes = useCallback(async (id: string) => {
    const campos = pendentes.current.get(id);
    if (!campos) return;
    pendentes.current.delete(id);

    const payload: Record<string, unknown> = {
      atualizado_em: new Date().toISOString(),
    };
    if (campos.titulo !== undefined) payload.titulo = campos.titulo;
    if (campos.corpo !== undefined) payload.corpo = campos.corpo;
    if (campos.cor !== undefined) payload.cor = campos.cor;

    // O `await` não é opcional: o construtor de consulta do supabase-js é um
    // *thenable* preguiçoso, e sem alguém chamando `then` a requisição
    // simplesmente nunca sai — falha silenciosa perfeita, que só aparece
    // quando a pessoa recarrega e o texto sumiu.
    const { error } = await supabaseNavegador()
      .from("quadro_nos")
      .update(payload)
      .eq("id", id);
    if (error) setErro("Não consegui salvar a anotação.");
  }, []);

  // Sair da tela dentro da janela do debounce não pode custar o que foi
  // escrito. A navegação entre abas do painel é do cliente, então a escrita
  // disparada aqui ainda chega.
  useEffect(() => {
    const temporizadoresAtuais = temporizadores.current;
    const pendentesAtuais = pendentes.current;
    return () => {
      for (const t of temporizadoresAtuais.values()) window.clearTimeout(t);
      for (const id of [...pendentesAtuais.keys()]) void gravarPendentes(id);
    };
  }, [gravarPendentes]);

  /**
   * Onde nasce um cartão novo.
   *
   * Perto do canto superior esquerdo da área visível, não no centro: o centro
   * é onde a pessoa provavelmente já tem coisa. E cada novo cartão anda uma
   * casa numa grade de três colunas — deslocar dez pixels em diagonal, como
   * estava, empilha tudo num monte só.
   */
  const posicaoNova = useCallback(() => {
    const canto = screenToFlowPosition({
      x: window.innerWidth * 0.34,
      y: 210,
    });
    const n = criados.current++;
    return {
      x: canto.x + (n % 3) * 330,
      y: canto.y + Math.floor((n % 9) / 3) * 250,
    };
  }, [screenToFlowPosition]);

  /* ---- Persistência ---- */

  async function criarNota() {
    setErro(null);
    const supabase = supabaseNavegador();
    const { data: sessao } = await supabase.auth.getUser();
    if (!sessao.user) return;

    const posicao = posicaoNova();
    const { data, error } = await supabase
      .from("quadro_nos")
      .insert({
        user_id: sessao.user.id,
        tipo: "nota",
        titulo: "",
        corpo: "",
        cor: "neutra",
        x: posicao.x,
        y: posicao.y,
      })
      .select("id")
      .single();

    if (error || !data) {
      setErro("Não consegui criar a anotação.");
      return;
    }

    setNos((atual) => [
      ...atual,
      {
        id: data.id,
        type: "nota",
        position: posicao,
        // Nasce selecionado: o próximo gesto é escrever, e ninguém quer
        // procurar o cartão que acabou de criar.
        selected: true,
        data: {
          tipo: "nota",
          titulo: "",
          corpo: "",
          cor: "neutra",
          largura: 260,
          questao: null,
        },
      },
    ]);
  }

  async function adicionarQuestao(questao: QuestaoDisponivel) {
    setErro(null);
    const supabase = supabaseNavegador();
    const { data: sessao } = await supabase.auth.getUser();
    if (!sessao.user) return;

    const posicao = posicaoNova();
    const { data, error } = await supabase
      .from("quadro_nos")
      .insert({
        user_id: sessao.user.id,
        tipo: "questao",
        questao_id: questao.id,
        cor: questao.acertou === false ? "ameixa" : "neutra",
        x: posicao.x,
        y: posicao.y,
        largura: 300,
      })
      .select("id")
      .single();

    if (error || !data) {
      setErro("Não consegui adicionar a questão.");
      return;
    }

    setNos((atual) => [
      ...atual,
      {
        id: data.id,
        type: "questao",
        position: posicao,
        selected: true,
        data: {
          tipo: "questao",
          titulo: "",
          corpo: "",
          cor: questao.acertou === false ? "ameixa" : "neutra",
          largura: 300,
          questao,
        },
      },
    ]);
    setDisponiveis((atual) => atual.filter((q) => q.id !== questao.id));
    setSeletorAberto(false);
    setBusca("");
  }

  /**
   * Edição de texto grava com atraso, por cartão.
   *
   * Uma escrita por tecla digitada seria uma requisição a cada letra; um
   * `beforeunload` perderia o que foi escrito quando a aba morre. Meio
   * segundo depois da última tecla resolve os dois.
   */
  const editar = useCallback(
    (id: string, campos: Partial<DadosDoCartao>) => {
      setNos((atual) =>
        atual.map((no) =>
          no.id === id ? { ...no, data: { ...no.data, ...campos } } : no,
        ),
      );

      // Os campos pendentes se acumulam. Guardar só o último bloqueio de
      // digitação perdia o título de quem escrevia o título e passava para o
      // corpo em menos de meio segundo — que é o que todo mundo faz.
      pendentes.current.set(id, {
        ...(pendentes.current.get(id) ?? {}),
        ...campos,
      });

      const anterior = temporizadores.current.get(id);
      if (anterior) window.clearTimeout(anterior);

      const atraso = window.setTimeout(() => {
        temporizadores.current.delete(id);
        void gravarPendentes(id);
      }, 450);

      temporizadores.current.set(id, atraso);
    },
    [setNos],
  );

  const remover = useCallback(
    async (id: string) => {
      const alvo = nos.find((n) => n.id === id);
      setNos((atual) => atual.filter((n) => n.id !== id));
      setLigacoes((atual) =>
        atual.filter((l) => l.source !== id && l.target !== id),
      );
      // O cascade da chave estrangeira apaga as ligações no banco.
      await supabaseNavegador().from("quadro_nos").delete().eq("id", id);
      if (alvo?.data.questao) {
        const devolvida = alvo.data.questao;
        setDisponiveis((atual) =>
          atual.some((q) => q.id === devolvida.id)
            ? atual
            : [devolvida, ...atual],
        );
      }
    },
    [nos, setNos, setLigacoes],
  );

  const acoes = useMemo<AcoesDoQuadro>(
    () => ({ editar, remover: (id) => void remover(id) }),
    [editar, remover],
  );

  async function aoConectar(conexao: Connection) {
    if (!conexao.source || !conexao.target) return;
    if (conexao.source === conexao.target) return;

    const supabase = supabaseNavegador();
    const { data: sessao } = await supabase.auth.getUser();
    if (!sessao.user) return;

    const { data, error } = await supabase
      .from("quadro_ligacoes")
      .insert({
        user_id: sessao.user.id,
        origem: conexao.source,
        destino: conexao.target,
      })
      .select("id")
      .single();

    // Ligação repetida bate no índice único e volta 23505. Não é erro para a
    // pessoa — ela só refez uma linha que já existia.
    if (error) {
      if (error.code !== "23505") setErro("Não consegui criar a ligação.");
      return;
    }

    setLigacoes((atual) => addEdge({ ...conexao, id: data!.id }, atual));
  }

  const filtradas = busca.trim()
    ? disponiveis.filter((q) =>
        `${q.edicao} ${q.numero} ${q.disciplina ?? ""} ${q.resumo}`
          .toLowerCase()
          .includes(busca.trim().toLowerCase()),
      )
    : disponiveis;

  return (
    <Acoes.Provider value={acoes}>
      <div className="relative flex min-h-0 flex-1">
        <ReactFlow
          nodes={nos}
          edges={ligacoes}
          onNodesChange={aoMudarNos}
          onEdgesChange={aoMudarLigacoes}
          nodeTypes={TIPOS_DE_NO}
          onConnect={aoConectar}
          onNodeDragStop={async (_, no) => {
            const { error } = await supabaseNavegador()
              .from("quadro_nos")
              .update({ x: no.position.x, y: no.position.y })
              .eq("id", no.id);
            if (error) setErro("Não consegui salvar a posição do cartão.");
          }}
          onEdgesDelete={async (apagadas) => {
            const { error } = await supabaseNavegador()
              .from("quadro_ligacoes")
              .delete()
              .in(
                "id",
                apagadas.map((l) => l.id),
              );
            if (error) setErro("Não consegui apagar a ligação.");
          }}
          onNodesDelete={async (apagados) => {
            const { error } = await supabaseNavegador()
              .from("quadro_nos")
              .delete()
              .in(
                "id",
                apagados.map((n) => n.id),
              );
            if (error) setErro("Não consegui apagar o cartão.");
            // Questões removidas pela tecla Delete voltam ao seletor.
            const devolvidas = apagados
              .map((n) => (n.data as DadosDoCartao).questao)
              .filter((q): q is QuestaoDisponivel => Boolean(q));
            if (devolvidas.length > 0) {
              setDisponiveis((atual) => [
                ...devolvidas.filter(
                  (d) => !atual.some((q) => q.id === d.id),
                ),
                ...atual,
              ]);
            }
          }}
          defaultEdgeOptions={{
            animated: false,
            style: { stroke: "var(--color-brand-400)", strokeWidth: 1.6 },
          }}
          connectionLineStyle={{
            stroke: "var(--color-brand-400)",
            strokeWidth: 1.6,
          }}
          fitView={cartoesIniciais.length > 0}
          fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
          minZoom={0.25}
          maxZoom={1.6}
          proOptions={{ hideAttribution: false }}
          className="bg-paper"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={22}
            size={1.4}
            color="var(--color-hairline)"
          />
          <Controls
            showInteractive={false}
            className="!rounded-[12px] !border !border-line !bg-surface !shadow-[var(--shadow-baixa)]"
          />
          {nos.length > 6 && (
            <MiniMap
              pannable
              zoomable
              className="!rounded-[12px] !border !border-line !bg-surface"
              maskColor="rgba(16,32,27,0.06)"
              nodeColor={(no) =>
                (no.data as DadosDoCartao)?.cor === "ameixa"
                  ? "#dcaebf"
                  : (no.data as DadosDoCartao)?.cor === "ambar"
                    ? "#f2d095"
                    : (no.data as DadosDoCartao)?.cor === "esmeralda"
                      ? "#a2d2c2"
                      : "#d6e0db"
              }
            />
          )}

          {/* ---- Barra de ações ---- */}
          <Panel position="top-left" className="!m-4">
            <div className="superficie flex flex-wrap items-center gap-2 p-2">
              <button
                type="button"
                onClick={criarNota}
                className="rounded-full bg-brand-600 px-4 py-2 text-[0.88rem] font-semibold text-white transition-colors hover:bg-brand-700"
              >
                + Anotação
              </button>
              <button
                type="button"
                onClick={() => setSeletorAberto((a) => !a)}
                aria-expanded={seletorAberto}
                className={`rounded-full border px-4 py-2 text-[0.88rem] font-semibold transition-colors ${
                  seletorAberto
                    ? "border-brand-300 bg-brand-50 text-brand-700"
                    : "border-hairline text-ink hover:border-brand-300 hover:text-brand-700"
                }`}
              >
                + Questão
              </button>
              <span className="px-2 text-[0.8rem] text-muted tabular-nums">
                {nos.length} {nos.length === 1 ? "cartão" : "cartões"} ·{" "}
                {ligacoes.length}{" "}
                {ligacoes.length === 1 ? "ligação" : "ligações"}
              </span>
            </div>

            {erro && (
              <p
                role="alert"
                className="mt-2 rounded-[12px] bg-vinho-50 px-4 py-2 text-[0.85rem] text-vinho-700"
              >
                {erro}
              </p>
            )}

            {/* ---- Seletor de questões ---- */}
            {seletorAberto && (
              <div className="superficie mt-2 flex w-[min(90vw,380px)] flex-col gap-2 p-3">
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por exame, número ou texto"
                  className="w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[0.88rem] text-ink outline-none placeholder:text-muted focus:border-brand-400"
                />

                {filtradas.length > 0 ? (
                  <ul className="nowheel flex max-h-[320px] flex-col gap-1 overflow-y-auto">
                    {filtradas.slice(0, 60).map((q) => (
                      <li key={q.id}>
                        <button
                          type="button"
                          onClick={() => adicionarQuestao(q)}
                          className="flex w-full flex-col gap-0.5 rounded-[10px] px-3 py-2 text-left transition-colors hover:bg-sunk"
                        >
                          <span className="flex items-center gap-2">
                            <span className="text-[0.84rem] font-semibold text-ink">
                              {q.edicao}º · questão {q.numero}
                            </span>
                            {q.acertou === false && (
                              <span className="rounded-full bg-vinho-100 px-1.5 text-[0.7rem] font-semibold text-vinho-600">
                                errou
                              </span>
                            )}
                          </span>
                          <span className="line-clamp-2 text-[0.8rem] text-muted">
                            {q.resumo}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-1 py-2 text-[0.85rem] text-muted">
                    {!temPlano ? (
                      <>
                        As questões fazem parte do plano.{" "}
                        <Link
                          href="/app/assinar"
                          className="font-semibold text-brand-600 underline decoration-brand-200 underline-offset-4"
                        >
                          Ver planos
                        </Link>
                        .
                      </>
                    ) : busca.trim() ? (
                      "Nada com esse termo entre as questões que você respondeu."
                    ) : (
                      <>
                        Só entram aqui questões que você já respondeu — e todas
                        as suas já estão no quadro.{" "}
                        <Link
                          href="/app/questoes"
                          className="font-semibold text-brand-600 underline decoration-brand-200 underline-offset-4"
                        >
                          Resolver mais
                        </Link>
                        .
                      </>
                    )}
                  </p>
                )}
              </div>
            )}
          </Panel>

          {/* ---- Tela vazia ---- */}
          {nos.length === 0 && (
            <Panel position="top-center" className="!mt-28">
              <div className="max-w-[46ch] text-center">
                <p className="text-[1.15rem] font-bold text-ink">
                  Um quadro em branco
                </p>
                <p className="mt-1.5 text-[0.93rem] text-body">
                  Crie anotações, traga questões que você já respondeu e ligue
                  umas às outras arrastando de uma borda à outra. A posição de
                  cada cartão é sua e fica salva.
                </p>
              </div>
            </Panel>
          )}
        </ReactFlow>
      </div>
    </Acoes.Provider>
  );
}

/** `ReactFlowProvider` é o que permite usar `useReactFlow` na própria tela. */
export function Quadro(props: {
  cartoesIniciais: CartaoSalvo[];
  ligacoesIniciais: LigacaoSalva[];
  questoesDisponiveis: QuestaoDisponivel[];
  temPlano: boolean;
}) {
  return (
    <ReactFlowProvider>
      <QuadroInterno {...props} />
    </ReactFlowProvider>
  );
}
