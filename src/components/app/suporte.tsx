"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatarData } from "@/lib/format";

export type MensagemDoTicket = {
  id: string;
  corpo: string;
  da_equipe: boolean;
  criado_em: string;
};

export type TicketNaTela = {
  id: string;
  assunto: string;
  status: "aberto" | "respondido" | "fechado";
  criado_em: string;
  atualizado_em: string;
  autor?: string | null;
  mensagens: MensagemDoTicket[];
};

const ROTULO: Record<TicketNaTela["status"], string> = {
  aberto: "aguardando resposta",
  respondido: "respondido",
  fechado: "fechado",
};

const COR: Record<TicketNaTela["status"], string> = {
  aberto: "bg-ouro-100 text-ouro-700",
  respondido: "bg-brand-50 text-brand-700",
  fechado: "bg-sunk text-muted",
};

/**
 * Conversa de suporte.
 *
 * A mesma tela serve os dois lados — a diferença é `equipe`, que muda o
 * rótulo de quem falou e libera o formulário de resposta em ticket de outra
 * pessoa. Duas telas quase iguais divergiriam na primeira mudança, e a que
 * divergiria em silêncio é a do cliente, que ninguém da equipe abre.
 */
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
  const [novo, setNovo] = useState(!equipe && tickets.length === 0);

  const atual = tickets.find((t) => t.id === aberto) ?? null;

  async function enviar(corpo: Record<string, string>, limpar: () => void) {
    setEnviando(true);
    setErro(null);
    const resposta = await fetch("/api/suporte", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    const dados = (await resposta.json()) as { erro?: string };
    setEnviando(false);
    if (!resposta.ok) {
      setErro(dados.erro ?? "Não consegui enviar.");
      return;
    }
    limpar();
    // A conversa é servidor: recarregar é mais honesto do que costurar a
    // mensagem na lista e torcer para o banco ter concordado.
    router.refresh();
  }

  return (
    <div className="painel-conteudo flex max-w-[1100px] flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex max-w-[54ch] flex-col gap-2">
          <h1 className="text-[clamp(1.75rem,3vw,2.15rem)] leading-[1.08] font-extrabold tracking-[-0.035em] text-ink">
            {equipe ? "Suporte · fila" : "Suporte"}
          </h1>
          <p className="text-body">
            {equipe
              ? "Tickets abertos pelas pessoas. Responder aqui avisa quem abriu por e-mail."
              : "Abra um chamado e acompanhe a resposta por aqui — você também recebe por e-mail."}
          </p>
        </div>
        {!equipe && (
          <button
            type="button"
            onClick={() => setNovo((n) => !n)}
            className="rounded-full bg-brand-600 px-5 py-2.5 text-[0.94rem] font-semibold text-white transition-colors hover:bg-brand-700"
          >
            {novo ? "Cancelar" : "Abrir chamado"}
          </button>
        )}
      </header>

      {erro && (
        <p className="rounded-[12px] border border-vinho-200 bg-vinho-50 px-4 py-3 text-[0.9rem] text-vinho-700">
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
            placeholder="Assunto — ex.: paguei e não liberou"
            maxLength={140}
            className="w-full rounded-[12px] border border-line bg-surface px-4 py-3 text-[0.96rem] text-ink outline-none focus:border-brand-400"
          />
          <textarea
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            placeholder="Conte o que aconteceu, com o máximo de detalhe que puder."
            rows={6}
            maxLength={5000}
            className="w-full resize-none rounded-[12px] border border-line bg-surface px-4 py-3 text-[0.96rem] leading-relaxed text-ink outline-none focus:border-brand-400"
          />
          <button
            type="submit"
            disabled={enviando}
            className="self-start rounded-full bg-brand-600 px-6 py-2.5 text-[0.94rem] font-semibold text-white transition-colors hover:bg-brand-700 disabled:bg-brand-200"
          >
            {enviando ? "Enviando…" : "Enviar chamado"}
          </button>
        </form>
      )}

      {tickets.length === 0 ? (
        !novo && (
          <p className="rounded-2xl bg-paper p-8 text-body">
            {equipe
              ? "Nenhum ticket na fila."
              : "Você ainda não abriu nenhum chamado."}
          </p>
        )
      ) : (
        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {tickets.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setAberto(t.id)}
                  className={`flex w-full flex-col gap-1.5 p-4 text-left transition-colors ${
                    t.id === aberto ? "bg-paper" : "hover:bg-paper"
                  }`}
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[0.94rem] font-semibold text-ink">
                      {t.assunto}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[0.72rem] font-semibold ${COR[t.status]}`}
                    >
                      {ROTULO[t.status]}
                    </span>
                  </span>
                  <span className="text-[0.8rem] text-muted tabular-nums">
                    {equipe && t.autor ? `${t.autor} · ` : ""}
                    {formatarData(t.atualizado_em.slice(0, 10))} ·{" "}
                    {t.mensagens.length}{" "}
                    {t.mensagens.length === 1 ? "mensagem" : "mensagens"}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {atual && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3">
                {atual.mensagens.map((m) => (
                  <article
                    key={m.id}
                    className={`flex flex-col gap-1.5 rounded-2xl border p-5 ${
                      m.da_equipe
                        ? "border-brand-200 bg-brand-50"
                        : "border-line bg-surface"
                    }`}
                  >
                    <span className="text-[0.78rem] font-semibold text-muted">
                      {m.da_equipe ? "OABase" : equipe ? "Cliente" : "Você"} ·{" "}
                      {formatarData(m.criado_em.slice(0, 10))}
                    </span>
                    <p className="text-[0.96rem] leading-relaxed whitespace-pre-wrap text-body">
                      {m.corpo}
                    </p>
                  </article>
                ))}
              </div>

              {atual.status !== "fechado" && (
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
                    placeholder={equipe ? "Responder ao cliente" : "Responder"}
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
            </div>
          )}
        </div>
      )}
    </div>
  );
}
