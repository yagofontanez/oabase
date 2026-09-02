"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseNavegador } from "@/lib/supabase/browser";
import { formatarData, tempoRelativo } from "@/lib/format";
import { Iniciais } from "./iniciais";

export type MensagemDoTicket = {
  id: string;
  corpo: string;
  da_equipe: boolean;
  criado_em: string;
};

export type StatusDoTicket = "aberto" | "respondido" | "fechado";

export type TicketNaTela = {
  id: string;
  assunto: string;
  status: StatusDoTicket;
  criado_em: string;
  atualizado_em: string;
  autor?: string | null;
  mensagens: MensagemDoTicket[];
};

/**
 * As colunas do quadro dizem **de quem é a vez**, não o estado interno.
 *
 * "Aberto / Respondido / Fechado" é a palavra do banco, e ela obriga quem lê
 * a traduzir: aberto quer dizer que a equipe deve resposta; respondido quer
 * dizer que a bola voltou para o cliente. Numa tela cujo trabalho é dizer se
 * alguém está esperando, a tradução é a informação — então ela vem pronta, e
 * muda de lado conforme quem está olhando.
 */
const COLUNAS: {
  status: StatusDoTicket;
  cliente: string;
  equipe: string;
  nota: string;
  tom: string;
  trilho: string;
}[] = [
  {
    status: "aberto",
    cliente: "Esperando a gente",
    equipe: "Na fila",
    nota: "Precisa de resposta da equipe.",
    tom: "text-ouro-700",
    trilho: "bg-ouro-400",
  },
  {
    status: "respondido",
    cliente: "Esperando você",
    equipe: "Esperando o cliente",
    nota: "A última palavra foi da equipe.",
    tom: "text-brand-700",
    trilho: "bg-brand-400",
  },
  {
    status: "fechado",
    cliente: "Encerrado",
    equipe: "Encerrado",
    nota: "Sem pendência dos dois lados.",
    tom: "text-muted",
    trilho: "bg-hairline",
  },
];

export function Suporte({
  tickets,
  equipe = false,
}: {
  tickets: TicketNaTela[];
  equipe?: boolean;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState<string | null>(tickets[0]?.id ?? null);
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [resposta, setResposta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [novo, setNovo] = useState(false);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<StatusDoTicket | null>(null);

  const atual = tickets.find((t) => t.id === aberto) ?? null;

  const porStatus = useMemo(
    () =>
      COLUNAS.map((c) => ({
        ...c,
        itens: tickets.filter((t) => t.status === c.status),
      })),
    [tickets],
  );

  const esperando = tickets.filter((t) =>
    equipe ? t.status === "aberto" : t.status === "respondido",
  ).length;

  async function enviar(corpo: Record<string, string>, limpar: () => void) {
    setEnviando(true);
    setErro(null);
    const res = await fetch("/api/suporte", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    const dados = (await res.json()) as { erro?: string };
    setEnviando(false);
    if (!res.ok) {
      setErro(dados.erro ?? "Não consegui enviar.");
      return;
    }
    limpar();
    router.refresh();
  }

  /** Mover o cartão é a forma direta de encerrar ou reabrir. Só a equipe. */
  async function mover(id: string, status: StatusDoTicket) {
    setArrastando(null);
    setAlvo(null);
    const { error } = await supabaseNavegador()
      .from("tickets")
      .update({ status, atualizado_em: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      setErro("Não consegui mover o chamado.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="painel-conteudo flex max-w-[1180px] flex-col gap-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex max-w-[52ch] flex-col gap-2">
          <h1 className="text-[clamp(1.75rem,3vw,2.15rem)] leading-[1.08] font-extrabold tracking-[-0.035em] text-ink">
            {equipe ? "Fila de suporte" : "Suporte"}
          </h1>
          {/* O subtítulo responde a pergunta que traz a pessoa à tela. */}
          <p className="text-body">
            {tickets.length === 0
              ? equipe
                ? "Nenhum chamado aberto até agora."
                : "Precisa de ajuda? Abra um chamado — a resposta chega aqui e no seu e-mail."
              : esperando > 0
                ? equipe
                  ? `${esperando} ${esperando === 1 ? "chamado espera" : "chamados esperam"} resposta sua.`
                  : `${esperando} ${esperando === 1 ? "resposta esperando" : "respostas esperando"} por você.`
                : equipe
                  ? "Nada na fila. Tudo respondido."
                  : "Nada pendente do seu lado."}
          </p>
        </div>
        {!equipe && (
          <button
            type="button"
            onClick={() => setNovo((v) => !v)}
            className="rounded-full bg-brand-600 px-5 py-2.5 text-[0.94rem] font-semibold text-white transition-colors hover:bg-brand-700"
          >
            {novo ? "Cancelar" : "Abrir chamado"}
          </button>
        )}
      </header>

      {erro && (
        <p
          role="alert"
          className="rounded-[12px] border border-vinho-200 bg-vinho-50 px-4 py-3 text-[0.9rem] text-vinho-700"
        >
          {erro}
        </p>
      )}

      {novo && !equipe && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void enviar({ assunto, mensagem }, () => {
              setAssunto("");
              setMensagem("");
              setNovo(false);
            });
          }}
          className="superficie flex flex-col gap-3 p-6"
        >
          <input
            value={assunto}
            onChange={(e) => setAssunto(e.target.value)}
            placeholder="Assunto — ex.: paguei e o plano não liberou"
            maxLength={140}
            autoFocus
            className="w-full rounded-[12px] border border-line bg-surface px-4 py-3 text-[0.96rem] text-ink outline-none focus:border-brand-400"
          />
          <textarea
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            placeholder="Conte o que aconteceu, com o máximo de detalhe que puder. Se for sobre pagamento, diga o dia e a forma."
            rows={6}
            maxLength={5000}
            className="w-full resize-none rounded-[12px] border border-line bg-surface px-4 py-3 text-[0.96rem] leading-relaxed text-ink outline-none focus:border-brand-400"
          />
          <button
            type="submit"
            disabled={enviando || assunto.trim().length < 3 || mensagem.trim().length < 5}
            className="self-start rounded-full bg-brand-600 px-6 py-2.5 text-[0.94rem] font-semibold text-white transition-colors hover:bg-brand-700 disabled:bg-brand-200"
          >
            {enviando ? "Enviando…" : "Enviar chamado"}
          </button>
        </form>
      )}

      {tickets.length > 0 && (
        <>
          {/* ---- O quadro ---- */}
          <div className="grid gap-4 lg:grid-cols-3">
            {porStatus.map((coluna) => (
              <section
                key={coluna.status}
                onDragOver={(e) => {
                  if (!equipe || !arrastando) return;
                  e.preventDefault();
                  setAlvo(coluna.status);
                }}
                onDragLeave={() => equipe && setAlvo(null)}
                onDrop={() => {
                  if (equipe && arrastando) void mover(arrastando, coluna.status);
                }}
                className={`flex flex-col gap-3 rounded-2xl border p-4 transition-colors ${
                  alvo === coluna.status
                    ? "border-brand-300 bg-brand-50/60"
                    : "border-line bg-paper"
                }`}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="flex items-baseline justify-between gap-2">
                    <span
                      className={`text-[0.78rem] font-bold tracking-[0.06em] uppercase ${coluna.tom}`}
                    >
                      {equipe ? coluna.equipe : coluna.cliente}
                    </span>
                    <span className="text-[0.8rem] text-muted tabular-nums">
                      {coluna.itens.length}
                    </span>
                  </span>
                  <span className="text-[0.78rem] text-muted">
                    {coluna.nota}
                  </span>
                </div>

                {coluna.itens.length === 0 ? (
                  <p className="rounded-[12px] border border-dashed border-hairline px-4 py-6 text-center text-[0.82rem] text-muted">
                    {equipe && arrastando ? "Solte aqui" : "vazio"}
                  </p>
                ) : (
                  coluna.itens.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      draggable={equipe}
                      onDragStart={() => setArrastando(t.id)}
                      onDragEnd={() => {
                        setArrastando(null);
                        setAlvo(null);
                      }}
                      onClick={() => setAberto(t.id)}
                      aria-current={t.id === aberto ? "true" : undefined}
                      className={`group relative flex flex-col gap-2 overflow-hidden rounded-[14px] border bg-surface p-4 pl-5 text-left transition-all ${
                        t.id === aberto
                          ? "border-brand-400 shadow-[var(--shadow-media)] ring-2 ring-brand-200"
                          : "border-line shadow-[var(--shadow-baixa)] hover:border-brand-200 hover:shadow-[var(--shadow-media)]"
                      } ${equipe ? "cursor-grab active:cursor-grabbing" : ""}`}
                    >
                      {/* Trilho: a cor da coluna presa ao cartão, para ele
                          continuar legível depois de arrastado. */}
                      <span
                        aria-hidden="true"
                        className={`absolute inset-y-0 left-0 w-1 ${coluna.trilho}`}
                      />
                      <span className="text-[0.95rem] leading-snug font-semibold text-ink">
                        {t.assunto}
                      </span>
                      <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.79rem] text-muted">
                        {equipe && t.autor && (
                          <>
                            <span className="break-all">{t.autor}</span>
                            <span aria-hidden="true">·</span>
                          </>
                        )}
                        <span>{tempoRelativo(t.atualizado_em)}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                          {t.mensagens.length}{" "}
                          {t.mensagens.length === 1 ? "mensagem" : "mensagens"}
                        </span>
                      </span>
                    </button>
                  ))
                )}
              </section>
            ))}
          </div>

          {equipe && (
            <p className="text-[0.82rem] text-muted">
              Arraste um cartão entre as colunas para encerrar ou reabrir.
              Responder move sozinho.
            </p>
          )}

          {/* ---- A conversa ---- */}
          {atual && (
            <section className="flex flex-col gap-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-line pt-6">
                <h2 className="text-[1.3rem] leading-snug font-bold tracking-[-0.02em] text-ink">
                  {atual.assunto}
                </h2>
                <span className="text-[0.82rem] text-muted">
                  aberto em {formatarData(atual.criado_em.slice(0, 10))}
                </span>
              </div>

              <ol className="flex flex-col gap-3">
                {atual.mensagens.map((m) => (
                  <li
                    key={m.id}
                    className={`flex gap-3 ${m.da_equipe ? "" : "sm:flex-row-reverse"}`}
                  >
                    <Iniciais
                      nome={m.da_equipe ? "OABase" : equipe ? (atual.autor ?? "Cliente") : "Você"}
                      tom={m.da_equipe ? "marca" : "neutro"}
                    />
                    {/* Sem `flex-1`: a bolha se ajusta ao texto. Esticada até
                        a margem, a mensagem de uma linha abria um vão morto do
                        outro lado e as duas vozes deixavam de se distinguir
                        pela forma. */}
                    <article
                      className={`flex max-w-[42rem] flex-col gap-1.5 rounded-2xl border p-4 ${
                        m.da_equipe
                          ? "border-brand-200 bg-brand-50"
                          : "border-line bg-surface"
                      }`}
                    >
                      <span className="text-[0.78rem] font-semibold text-muted">
                        {m.da_equipe ? "OABase" : equipe ? "Cliente" : "Você"} ·{" "}
                        {tempoRelativo(m.criado_em)}
                      </span>
                      <p className="text-[0.96rem] leading-relaxed whitespace-pre-wrap text-body">
                        {m.corpo}
                      </p>
                    </article>
                  </li>
                ))}
              </ol>

              {atual.status === "fechado" ? (
                <p className="rounded-2xl bg-paper p-5 text-[0.92rem] text-muted">
                  Este chamado está encerrado.{" "}
                  {equipe
                    ? "Arraste o cartão de volta para reabrir."
                    : "Se voltar a acontecer, abra um novo."}
                </p>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void enviar({ ticket: atual.id, mensagem: resposta }, () =>
                      setResposta(""),
                    );
                  }}
                  className="flex flex-col gap-2"
                >
                  <textarea
                    value={resposta}
                    onChange={(e) => setResposta(e.target.value)}
                    placeholder={
                      equipe ? "Responder ao cliente" : "Escrever de volta"
                    }
                    rows={4}
                    maxLength={5000}
                    className="w-full resize-none rounded-[12px] border border-line bg-surface px-4 py-3 text-[0.95rem] leading-relaxed text-ink outline-none focus:border-brand-400"
                  />
                  <button
                    type="submit"
                    disabled={enviando || resposta.trim().length < 5}
                    className="self-start rounded-full bg-brand-600 px-5 py-2.5 text-[0.92rem] font-semibold text-white transition-colors hover:bg-brand-700 disabled:bg-brand-200"
                  >
                    {enviando ? "Enviando…" : "Enviar"}
                  </button>
                </form>
              )}
            </section>
          )}
        </>
      )}

      {tickets.length === 0 && !novo && !equipe && (
        <div className="flex flex-col items-start gap-4 rounded-2xl border border-dashed border-hairline p-10">
          <p className="max-w-[46ch] text-[1rem] text-body">
            Problema com pagamento, questão com erro, dúvida sobre o plano — é
            aqui. Você acompanha o andamento neste quadro.
          </p>
          <button
            type="button"
            onClick={() => setNovo(true)}
            className="rounded-full bg-brand-600 px-6 py-2.5 text-[0.94rem] font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Abrir o primeiro chamado
          </button>
        </div>
      )}
    </div>
  );
}
