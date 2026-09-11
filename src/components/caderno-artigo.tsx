"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { TextoLegalDestacado } from "@/components/texto-legal-destacado";
import { adicionarDias, hojeEmBrasilia } from "@/lib/calendario";
import {
  CORES_DO_DESTAQUE,
  classeDaCor,
  type CorDoDestaque,
  type DestaqueLeiSeca,
  type EstadoDoCaderno,
} from "@/lib/caderno-lei-seca";
import { supabaseNavegador } from "@/lib/supabase/browser";

type Selecao = Omit<DestaqueLeiSeca, "cor">;

const ROTULOS_DAS_CORES: Record<CorDoDestaque, string> = {
  amarelo: "Amarelo",
  verde: "Verde",
  rosa: "Rosa",
};

function parteDoNo(no: Node, raiz: HTMLElement) {
  const elemento =
    no.nodeType === Node.ELEMENT_NODE
      ? (no as Element)
      : no.parentElement;
  const parte = elemento?.closest<HTMLElement>("[data-parte]") ?? null;
  return parte && raiz.contains(parte) ? parte : null;
}

export function CadernoDoArtigo({
  leiSlug,
  artigoSlug,
  partes,
}: {
  leiSlug: string;
  artigoSlug: string;
  partes: string[];
}) {
  const raiz = useRef<HTMLDivElement>(null);
  const [autenticado, setAutenticado] = useState<boolean | null>(null);
  const [estado, setEstado] = useState<EstadoDoCaderno | null>(null);
  const [selecao, setSelecao] = useState<Selecao | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const hoje = hojeEmBrasilia();
  const caminho = `/legislacao/${leiSlug}/${artigoSlug}`;
  const inicios = partes.map((_, indice) =>
    partes
      .slice(0, indice)
      .reduce((total, parte) => total + parte.length + 2, 0),
  );

  useEffect(() => {
    let ativa = true;
    async function carregar() {
      const supabase = supabaseNavegador();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!ativa) return;
      if (!user) {
        setAutenticado(false);
        return;
      }
      setAutenticado(true);
      const { data, error } = await supabase.rpc("meu_caderno_do_artigo", {
        p_lei_slug: leiSlug,
        p_artigo_slug: artigoSlug,
      });
      if (!ativa) return;
      if (error || !data) {
        setMensagem("Não consegui abrir seu caderno neste artigo.");
        return;
      }
      setEstado(data as EstadoDoCaderno);
    }
    void carregar();
    return () => {
      ativa = false;
    };
  }, [artigoSlug, leiSlug]);

  async function persistir(proximo: EstadoDoCaderno, sucesso: string) {
    if (salvando) return false;
    setSalvando(true);
    setMensagem(null);
    const { error } = await supabaseNavegador().rpc(
      "salvar_caderno_do_artigo",
      {
        p_lei_slug: leiSlug,
        p_artigo_slug: artigoSlug,
        p_nota: proximo.nota.trim().slice(0, 5000),
        p_lido: proximo.lido,
        p_revisar_em: proximo.revisarEm,
        p_favorito: proximo.favorito,
        p_importante_para: proximo.importantePara.trim().slice(0, 160),
        p_visto_em_questao: proximo.vistoEmQuestao,
        p_destaques: proximo.destaques,
      },
    );
    setSalvando(false);
    if (error) {
      setMensagem("Não consegui salvar. Confira a conexão e tente novamente.");
      return false;
    }
    setEstado({
      ...proximo,
      nota: proximo.nota.trim().slice(0, 5000),
      importantePara: proximo.importantePara.trim().slice(0, 160),
    });
    setMensagem(sucesso);
    return true;
  }

  function capturarSelecao() {
    const container = raiz.current;
    const selecaoDoNavegador = window.getSelection();
    if (!container || !selecaoDoNavegador || selecaoDoNavegador.isCollapsed) {
      return;
    }
    const intervalo = selecaoDoNavegador.getRangeAt(0);
    const parteInicial = parteDoNo(intervalo.startContainer, container);
    const parteFinal = parteDoNo(intervalo.endContainer, container);
    if (!parteInicial || parteInicial !== parteFinal) {
      setMensagem("Selecione um trecho dentro do mesmo parágrafo.");
      setSelecao(null);
      return;
    }

    const antes = document.createRange();
    antes.selectNodeContents(parteInicial);
    antes.setEnd(intervalo.startContainer, intervalo.startOffset);
    const ateOFim = document.createRange();
    ateOFim.selectNodeContents(parteInicial);
    ateOFim.setEnd(intervalo.endContainer, intervalo.endOffset);
    let inicio = antes.toString().length;
    let fim = ateOFim.toString().length;
    const bruto = intervalo.toString();
    const esquerda = bruto.length - bruto.trimStart().length;
    const direita = bruto.length - bruto.trimEnd().length;
    inicio += esquerda;
    fim -= direita;
    const trecho = parteInicial.textContent?.slice(inicio, fim) ?? "";
    if (!trecho) return;
    if (trecho.length > 1000) {
      setMensagem("O destaque pode ter no máximo 1.000 caracteres.");
      setSelecao(null);
      return;
    }
    const base = Number(parteInicial.dataset.inicio ?? 0);
    setMensagem(null);
    setSelecao({ inicio: base + inicio, fim: base + fim, trecho });
  }

  async function destacar(cor: CorDoDestaque) {
    if (!estado || !selecao) return;
    const sobrepoe = estado.destaques.some(
      (item) => selecao.inicio < item.fim && item.inicio < selecao.fim,
    );
    if (sobrepoe) {
      setMensagem("Esse trecho já cruza outro destaque.");
      return;
    }
    const proximo = {
      ...estado,
      destaques: [...estado.destaques, { ...selecao, cor }].sort(
        (a, b) => a.inicio - b.inicio,
      ),
    };
    if (await persistir(proximo, "Destaque salvo no caderno.")) {
      setSelecao(null);
      window.getSelection()?.removeAllRanges();
    }
  }

  async function removerDestaque(alvo: DestaqueLeiSeca) {
    if (!estado) return;
    await persistir(
      {
        ...estado,
        destaques: estado.destaques.filter(
          (item) => item.inicio !== alvo.inicio || item.fim !== alvo.fim,
        ),
      },
      "Destaque removido.",
    );
  }

  async function alternar(chave: "lido" | "favorito" | "vistoEmQuestao") {
    if (!estado) return;
    await persistir(
      { ...estado, [chave]: !estado[chave] },
      "Caderno atualizado.",
    );
  }

  return (
    <>
      <div
        ref={raiz}
        className="lei-texto mt-5"
        onMouseUp={capturarSelecao}
        onTouchEnd={() => window.setTimeout(capturarSelecao, 0)}
      >
        {partes.map((parte, indice) => (
          <p
            key={`${indice}-${parte}`}
            data-parte={indice}
            data-inicio={inicios[indice]}
            className={indice === 0 ? undefined : "text-[1.02rem] text-body"}
          >
            <TextoLegalDestacado
              texto={parte}
              inicio={inicios[indice]}
              destaques={estado?.destaques ?? []}
            />
          </p>
        ))}
      </div>

      {autenticado === null && (
        <p className="mt-6 text-[0.76rem] text-muted">Abrindo seu caderno…</p>
      )}

      {autenticado === false && (
        <aside className="mt-7 flex flex-wrap items-center justify-between gap-3 rounded-[15px] border border-brand-100 bg-brand-50 p-4">
          <div>
            <strong className="text-[0.88rem] text-brand-800">
              Transforme a leitura em material seu
            </strong>
            <p className="mt-0.5 text-[0.78rem] text-brand-700">
              Entre para destacar trechos, anotar e agendar a revisão.
            </p>
          </div>
          <Link
            href={`/entrar?proximo=${encodeURIComponent(caminho)}`}
            className="rounded-full bg-brand-700 px-4 py-2 text-[0.78rem] font-semibold text-white"
          >
            Entrar e usar o caderno
          </Link>
        </aside>
      )}

      {autenticado && estado && (
        <aside className="mt-7 overflow-hidden rounded-[18px] border border-brand-100 bg-brand-50/45">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-100 px-4 py-3.5 sm:px-5">
            <div>
              <span className="text-[0.68rem] font-bold tracking-[0.13em] text-brand-700 uppercase">
                Meu caderno de lei seca
              </span>
              <p className="mt-0.5 text-[0.76rem] text-muted">
                Selecione um trecho do texto acima para destacá-lo.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={`/app/flashcards?artigo=${encodeURIComponent(`${leiSlug}/${artigoSlug}`)}`}
                className="text-[0.76rem] font-semibold text-ouro-700 underline decoration-ouro-200 underline-offset-4"
              >
                Criar flashcard →
              </Link>
              <Link
                href="/app/lei-seca"
                className="text-[0.76rem] font-semibold text-brand-700 underline decoration-brand-200 underline-offset-4"
              >
                Abrir caderno completo →
              </Link>
            </div>
          </div>

          {selecao && (
            <div className="border-b border-ouro-200 bg-ouro-50 px-4 py-3.5 sm:px-5">
              <p className="line-clamp-2 text-[0.78rem] italic text-body">
                “{selecao.trecho}”
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[0.7rem] font-semibold text-muted">
                  Destacar em
                </span>
                {CORES_DO_DESTAQUE.map((cor) => (
                  <button
                    key={cor}
                    type="button"
                    onClick={() => void destacar(cor)}
                    disabled={salvando}
                    className={`rounded-full px-3 py-1.5 text-[0.72rem] font-semibold ${classeDaCor(cor)}`}
                  >
                    {ROTULOS_DAS_CORES[cor]}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[.9fr_1.1fr]">
            <div>
              <div className="flex flex-wrap gap-2">
                {[
                  ["lido", estado.lido, "Lido", "✓"],
                  ["favorito", estado.favorito, "Importante", "★"],
                  ["vistoEmQuestao", estado.vistoEmQuestao, "Vi em questão", "↗"],
                ].map(([chave, ativo, rotulo, icone]) => (
                  <button
                    key={String(chave)}
                    type="button"
                    onClick={() => void alternar(chave as "lido" | "favorito" | "vistoEmQuestao")}
                    aria-pressed={Boolean(ativo)}
                    disabled={salvando}
                    className={`rounded-full border px-3 py-2 text-[0.74rem] font-semibold ${ativo ? "border-brand-300 bg-brand-700 text-white" : "border-hairline bg-surface text-body"}`}
                  >
                    {icone} {rotulo}
                  </button>
                ))}
              </div>

              <label className="mt-4 block text-[0.72rem] font-semibold text-muted">
                Revisar em
                <input
                  type="date"
                  min={hoje}
                  value={estado.revisarEm ?? ""}
                  onChange={(evento) =>
                    setEstado({ ...estado, revisarEm: evento.target.value || null })
                  }
                  className="mt-1.5 block w-full rounded-[10px] border border-hairline bg-surface px-3 py-2 text-[0.82rem] font-normal text-ink"
                />
              </label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[1, 7, 30].map((dias) => (
                  <button
                    key={dias}
                    type="button"
                    onClick={() =>
                      setEstado({
                        ...estado,
                        revisarEm: adicionarDias(hoje, dias),
                      })
                    }
                    className="rounded-full bg-surface px-2.5 py-1 text-[0.68rem] font-semibold text-muted"
                  >
                    +{dias} {dias === 1 ? "dia" : "dias"}
                  </button>
                ))}
                {estado.revisarEm && (
                  <button
                    type="button"
                    onClick={() => setEstado({ ...estado, revisarEm: null })}
                    className="rounded-full px-2.5 py-1 text-[0.68rem] font-semibold text-vinho-600"
                  >
                    remover
                  </button>
                )}
              </div>

              <label className="mt-4 block text-[0.72rem] font-semibold text-muted">
                Importante para qual prova ou disciplina?
                <input
                  value={estado.importantePara}
                  onChange={(evento) =>
                    setEstado({ ...estado, importantePara: evento.target.value })
                  }
                  maxLength={160}
                  placeholder="Ex.: prova de Civil · 2º bimestre"
                  className="mt-1.5 block w-full rounded-[10px] border border-hairline bg-surface px-3 py-2 text-[0.82rem] font-normal text-ink"
                />
              </label>
            </div>

            <div>
              <label className="block text-[0.72rem] font-semibold text-muted">
                Minha nota sobre este artigo
                <textarea
                  value={estado.nota}
                  onChange={(evento) =>
                    setEstado({ ...estado, nota: evento.target.value })
                  }
                  rows={5}
                  maxLength={5000}
                  placeholder="Exemplo, exceção, dúvida ou explicação com suas palavras…"
                  className="mt-1.5 block w-full resize-y rounded-[10px] border border-hairline bg-surface px-3 py-2.5 text-[0.82rem] leading-relaxed font-normal text-ink"
                />
              </label>
              <div className="mt-2 flex justify-between text-[0.68rem] text-muted">
                <span>{estado.destaques.length} destaques</span>
                <span>{estado.nota.length}/5.000</span>
              </div>
              <button
                type="button"
                onClick={() => void persistir(estado, "Caderno salvo.")}
                disabled={salvando}
                className="mt-3 w-full rounded-full bg-brand-700 px-4 py-2.5 text-[0.8rem] font-semibold text-white disabled:opacity-50"
              >
                {salvando ? "Salvando…" : "Salvar nota e revisão"}
              </button>
            </div>
          </div>

          {estado.destaques.length > 0 && (
            <div className="border-t border-brand-100 px-4 py-4 sm:px-5">
              <span className="text-[0.68rem] font-bold tracking-[0.1em] text-brand-700 uppercase">
                Trechos guardados
              </span>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {estado.destaques.map((destaque) => (
                  <div
                    key={`${destaque.inicio}-${destaque.fim}`}
                    className="flex min-w-0 items-start gap-2 rounded-[10px] bg-surface p-3"
                  >
                    <p className="line-clamp-3 flex-1 text-[0.74rem] leading-relaxed text-body">
                      “{destaque.trecho}”
                    </p>
                    <span className="flex shrink-0 flex-col items-end gap-1.5">
                      <Link
                        href={`/app/flashcards?artigo=${encodeURIComponent(`${leiSlug}/${artigoSlug}`)}&trecho=${encodeURIComponent(destaque.trecho)}`}
                        className="text-[0.68rem] font-semibold text-brand-700"
                      >
                        virar cartão
                      </Link>
                      <button
                        type="button"
                        onClick={() => void removerDestaque(destaque)}
                        disabled={salvando}
                        className="text-[0.68rem] font-semibold text-vinho-600"
                        aria-label={`Remover destaque: ${destaque.trecho.slice(0, 40)}`}
                      >
                        remover
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {mensagem && (
            <p
              role="status"
              className="border-t border-brand-100 px-4 py-3 text-[0.76rem] text-brand-700 sm:px-5"
            >
              {mensagem}
            </p>
          )}
        </aside>
      )}

      {autenticado && !estado && mensagem && (
        <p role="alert" className="mt-5 text-[0.78rem] text-vinho-600">
          {mensagem}
        </p>
      )}
    </>
  );
}
